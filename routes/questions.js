const express = require('express');
const { body, validationResult, query } = require('express-validator');
const fs = require('fs').promises;
const path = require('path');
const { readQuestionsFromJSON } = require('../utils/questionReader');
const { convertRawToScaled: convertShsatRawToScaled, calculateShsatScores } = require('../utils/shsatScoring');
const { convertSatRawToScaled, calculateSatResults } = require('../utils/satScoring');
const TestCode = require('../models/TestCode');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateGetQuestions = [
  query('testType')
    .isIn(['shsat', 'sat', 'state'])
    .withMessage('Invalid test type'),
  query('practiceSet')
    .optional()
    .isIn(['1', '2', '3','4', '5', '6', '7', '8','9', 'diagnostic'])
    .withMessage('Practice set must be 1, 2, 3, 4, 5, 6, 7, 8, 9, or diagnostic')
];

const validateSubmitAnswers = [
  body('testType')
    .isIn(['shsat', 'sat', 'state'])
    .withMessage('Invalid test type'),
  body('practiceSet')
    .optional()
    .isIn(['1', '2', '3','4', '5', '6', '7', '8', '9', 'diagnostic'])
    .withMessage('Practice set must be 1, 2, 3, 4, 5, 6, 7, 8, 9, or diagnostic'),
  body('answers')
    .isArray()
    .withMessage('Answers must be an array'),
  body('answers.*.questionId')
    .exists()
    .withMessage('Question ID is required'),
  body('answers.*.selectedAnswer')
    .exists()
    .withMessage('Selected answer is required')
];

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation errors:', errors.array()); // Add this for debugging
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// @route   GET /api/questions/test
// @desc    Get questions for a specific test
// @access  Public (temporarily)
router.get('/test', validateGetQuestions, handleValidationErrors, async (req, res) => {
  try {
    const { testType, practiceSet = '1' } = req.query;
    
    console.log(`🎯 Fetching questions from JSON: ${testType} practice set ${practiceSet}`);
    
    // Read questions from JSON file
    const questions = await readQuestionsFromJSON(testType, practiceSet);
    
    // Debug: count fill-in-the-blank questions
    const fillInBlankCount = questions.filter(q => q.answer_type === 'fill_in_the_blank').length;
    console.log(`📝 Found ${fillInBlankCount} fill-in-the-blank questions out of ${questions.length} total`);
    
    // Debug: log first few questions to verify structure
    console.log('First question sample:', JSON.stringify(questions[0], null, 2));
    if (fillInBlankCount > 0) {
      const firstFillInBlank = questions.find(q => q.answer_type === 'fill_in_the_blank');
      console.log('First fill-in-the-blank question:', JSON.stringify(firstFillInBlank, null, 2));
    }

    if (!questions || questions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No questions found for the specified criteria'
      });
    }
    
    // Format questions for frontend (don't expose correct_answer)
    const questionsWithoutAnswers = questions.map(q => ({
      _id: q._id,
      question_text: q.question_text,
      passage: q.passage,
      options: q.options,
      category: q.category,
      difficulty: q.difficulty,
      time_estimate: q.time_estimate,
      question_number: q.question_number,
      practice_set: q.practice_set,
      answer_type: q.answer_type
    }));
    
    // Debug: check what's being sent to frontend
    const sentFillInBlankCount = questionsWithoutAnswers.filter(q => q.answer_type === 'fill_in_the_blank').length;
    console.log(`📤 Sending ${sentFillInBlankCount} fill-in-the-blank questions to frontend`);
    if (sentFillInBlankCount > 0) {
      const firstSentFillInBlank = questionsWithoutAnswers.find(q => q.answer_type === 'fill_in_the_blank');
      console.log('First sent fill-in-the-blank question:', JSON.stringify(firstSentFillInBlank, null, 2));
    }
    
    res.json({
      success: true,
      data: {
        questions: questionsWithoutAnswers,
        testInfo: {
          testType,
          practiceSet,
          totalQuestions: questionsWithoutAnswers.length,
          estimatedTime: questionsWithoutAnswers.reduce((total, q) => total + (q.time_estimate || 60), 0)
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching questions from JSON:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching questions'
    });
  }
});

// @route   POST /api/questions/submit
// @desc    Submit test answers and get results
// @access  Private
router.post('/submit', auth, validateSubmitAnswers, handleValidationErrors, async (req, res) => {
  try {
    const { testType, practiceSet = '1', answers, timeSpent } = req.body;
    
    console.log(`📝 Checking answers for test: ${testType} practice set ${practiceSet}`);
    
    // Get questions from JSON to check answers
    const questions = await readQuestionsFromJSON(testType, practiceSet);
    
    // Calculate results
    let correctCount = 0;
    const categoryScores = {};
    const detailedResults = [];
    const shsatSectionScores = {
      math: { correct: 0, total: 0 },
      english: { correct: 0, total: 0 }
    };
    const satSectionScores = {
      math: { correct: 0, total: 0 },
      english: { correct: 0, total: 0 } // english here means reading & writing
    };
    
    for (const answer of answers) {
      const question = questions.find(q => q._id === answer.questionId);
      
      if (!question) {
        continue;
      }
      
      // Handle different question types
      let isCorrect = false;
      if (question.answer_type === 'fill_in_the_blank') {
        // For fill-in-the-blank, compare with correct_answer_value
        const userAnswer = String(answer.selectedAnswer).trim().toLowerCase();
        const correctAnswer = String(question.correct_answer_value || question.correct_answer).trim().toLowerCase();
        isCorrect = userAnswer === correctAnswer;
      } else {
        // For multiple choice, compare with correct_answer index
        isCorrect = answer.selectedAnswer === question.correct_answer;
      }
      
      if (isCorrect) {
        correctCount++;
      }
      
      // Track by category
      if (!categoryScores[question.category]) {
        categoryScores[question.category] = { correct: 0, total: 0 };
      }
      categoryScores[question.category].total++;
      if (isCorrect) {
        categoryScores[question.category].correct++;
      }

      const categoryLower = question.category.toLowerCase();
      
      // Track SHSAT section scores using question numbers
      if (testType === 'shsat') {
        if (question.question_number <= 57) {
          // Questions 1-57 are ELA
          shsatSectionScores.english.total++;
          if (isCorrect) shsatSectionScores.english.correct++;
        } else if (question.question_number <= 114) {
          // Questions 58-114 are Math
          shsatSectionScores.math.total++;
          if (isCorrect) shsatSectionScores.math.correct++;
        }
      }

      // Track SAT section scores using question numbers
      if (testType === 'sat') {
        if (question.question_number <= 54) {
          // Questions 1-54 are Reading & Writing
          satSectionScores.english.total++;
          if (isCorrect) satSectionScores.english.correct++;
        } else if (question.question_number <= 98) {
          // Questions 55-98 are Math
          satSectionScores.math.total++;
          if (isCorrect) satSectionScores.math.correct++;
        }
      }
      
      // Record detailed result for review
      detailedResults.push({
        questionId: question._id,
        question_text: question.question_text,
        passage: question.passage,
        options: question.options,
        correct_answer: question.correct_answer,
        answer_type: question.answer_type,
        userAnswer: answer.selectedAnswer,
        isCorrect,
        category: question.category,
        explanation: question.explanation,
        question_number: question.question_number
      });
    }
    
    const percentage = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;
    
    const responseData = {
      results: {
        correctCount,
        totalQuestions: answers.length,
        percentage,
        timeSpent,
        categoryScores
      },
      detailedResults
    };

    // Add SHSAT scaled scores if applicable
    if (testType === 'shsat') {
      // Use the new accurate SHSAT scoring system
      const shsatScoreResults = calculateShsatScores(
        shsatSectionScores.math.correct,
        shsatSectionScores.english.correct
      );

      responseData.results.shsatScores = {
        math: {
          rawScore: shsatSectionScores.math.correct,
          totalQuestions: shsatSectionScores.math.total,
          percentage: shsatSectionScores.math.total > 0 ? Math.round((shsatSectionScores.math.correct / shsatSectionScores.math.total) * 100) : 0,
          scaledScore: shsatScoreResults.math.scaledScore
        },
        english: {
          rawScore: shsatSectionScores.english.correct,
          totalQuestions: shsatSectionScores.english.total,
          percentage: shsatSectionScores.english.total > 0 ? Math.round((shsatSectionScores.english.correct / shsatSectionScores.english.total) * 100) : 0,
          scaledScore: shsatScoreResults.english.scaledScore
        },
        totalScaledScore: shsatScoreResults.totalScaledScore
      };
    }

    // Add SAT scaled scores if applicable
    if (testType === 'sat') {
      // Use the new comprehensive SAT scoring system
      const satScoreResults = calculateSatResults(
        satSectionScores.math.correct,
        satSectionScores.english.correct
      );
      
      responseData.results.satScores = {
        math: {
          rawScore: satSectionScores.math.correct,
          totalQuestions: satSectionScores.math.total,
          percentage: satSectionScores.math.total > 0 ? Math.round((satSectionScores.math.correct / satSectionScores.math.total) * 100) : 0,
          scaledScore: satScoreResults.math.scaledScore
        },
        reading_writing: {
          rawScore: satSectionScores.english.correct,
          totalQuestions: satSectionScores.english.total,
          percentage: satSectionScores.english.total > 0 ? Math.round((satSectionScores.english.correct / satSectionScores.english.total) * 100) : 0,
          scaledScore: satScoreResults.readingWriting.scaledScore
        },
        totalScaledScore: satScoreResults.total.score,
        percentile: satScoreResults.total.percentile,
        performanceLevel: satScoreResults.total.performanceLevel
      };
    }

    // Save test attempt to user's test history
    try {
      console.log(`🔍 Attempting to save test history for user ID: ${req.user._id}`);
      
      const user = await User.findById(req.user._id);
      if (!user) {
        console.error(`❌ User not found when saving test history: ${req.user._id}`);
        throw new Error('User not found');
      }
      
      console.log(`📋 User found: ${user.email}, current test history count: ${user.testHistory ? user.testHistory.length : 0}`);
      
      // Generate test name based on type and practice set
      let testName = '';
      if (testType === 'shsat') {
        testName = practiceSet === 'diagnostic' 
          ? 'SHSAT Diagnostic Test' 
          : `SHSAT Practice Test ${practiceSet}`;
      } else if (testType === 'sat') {
        testName = `SAT Practice Test ${practiceSet}`;
      } else if (testType === 'state') {
        testName = `State Test Practice ${practiceSet}`;
      }

      console.log(`📝 Generated test name: ${testName}`);
      console.log(`📊 Test results: ${answers.length} answers, ${correctCount} correct (${percentage}%)`);
      
      // Create test history entry
      const testHistoryEntry = {
        testType,
        practiceSet,
        testName,
        completedAt: new Date(),
        results: {
          percentage,
          correctCount,
          totalQuestions: answers.length,
          timeSpent,
          categoryScores: new Map(Object.entries(categoryScores))
        },
        // Store detailed question results for the visual breakdown
        detailedResults: detailedResults.map((result, index) => {
          const questionNum = result.question_number || (index + 1);
          console.log(`📝 Processing question ${questionNum}: ${result.category}, correct: ${result.isCorrect}`);
          return {
            questionId: result.questionId,
            questionNumber: questionNum,
            isCorrect: result.isCorrect,
            userAnswer: result.userAnswer,
            category: result.category,
            hasAnswer: result.userAnswer !== undefined && result.userAnswer !== null && result.userAnswer !== ''
          };
        })
      };

      console.log(`📋 Test history entry created with ${testHistoryEntry.detailedResults.length} detailed results`);

      // Add scaled scores if available
      if (testType === 'shsat' && responseData.results.shsatScores) {
        testHistoryEntry.scaledScores = {
          math: responseData.results.shsatScores.math.scaledScore,
          english: responseData.results.shsatScores.english.scaledScore,
          total: responseData.results.shsatScores.totalScaledScore
        };
        console.log(`📊 Added SHSAT scaled scores: Math ${testHistoryEntry.scaledScores.math}, English ${testHistoryEntry.scaledScores.english}, Total ${testHistoryEntry.scaledScores.total}`);
      } else if (testType === 'sat' && responseData.results.satScores) {
        testHistoryEntry.scaledScores = {
          math: responseData.results.satScores.math.scaledScore,
          reading_writing: responseData.results.satScores.reading_writing.scaledScore,
          total: responseData.results.satScores.totalScaledScore
        };
        console.log(`📊 Added SAT scaled scores: Math ${testHistoryEntry.scaledScores.math}, Reading/Writing ${testHistoryEntry.scaledScores.reading_writing}, Total ${testHistoryEntry.scaledScores.total}`);
      }

      // Initialize testHistory array if it doesn't exist
      if (!user.testHistory) {
        user.testHistory = [];
        console.log(`📋 Initialized empty test history array for user ${user.email}`);
      }

      // Add to user's test history
      console.log(`📝 Adding test history entry to user's history (current count: ${user.testHistory.length})`);
      user.testHistory.push(testHistoryEntry);
      console.log(`📝 Test history array now has ${user.testHistory.length} entries`);
      
      // Save user with validation
      console.log(`💾 Saving user with updated test history...`);
      const savedUser = await user.save();
      console.log(`✅ User saved successfully. Final test history count: ${savedUser.testHistory.length}`);
      
      console.log(`✅ Test history saved for user ${user.email}: ${testName}`);
      console.log(`📊 Detailed results count: ${testHistoryEntry.detailedResults.length}`);
    } catch (historyError) {
      console.error('❌ Error saving test history:', historyError);
      console.error('❌ Error details:', {
        name: historyError.name,
        message: historyError.message,
        stack: historyError.stack
      });
      
      // Log validation errors specifically
      if (historyError.name === 'ValidationError') {
        console.error('❌ Validation errors:', historyError.errors);
      }
      
      // Don't fail the whole request if history saving fails
    }

    res.json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    console.error('❌ Error submitting answers:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing test submission'
    });
  }
});

// @route   POST /api/questions/validate-code
// @desc    Validate a test code
// @access  Public (for now)
router.post('/validate-code', async (req, res) => {
    const { testCode } = req.body;

    try {
        const storedCode = await TestCode.findOne({ name: 'global' });

        if (!storedCode) {
            return res.status(500).json({ success: false, message: 'Test code not configured.' });
        }
    
        if (testCode === storedCode.code) {
            res.json({ success: true, message: 'Test code is valid.' });
        } else {
            res.status(400).json({ success: false, message: 'Invalid test code.' });
        }
    } catch (error) {
        console.error('Error validating test code:', error);
        res.status(500).json({ success: false, message: 'Server error during code validation.' });
    }
});

module.exports = router; 
