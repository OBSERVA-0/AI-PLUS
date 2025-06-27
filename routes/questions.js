const express = require('express');
const { body, validationResult, query } = require('express-validator');
const fs = require('fs').promises;
const path = require('path');
const { readQuestionsFromJSON } = require('../utils/questionReader');
const { convertRawToScaled: convertShsatRawToScaled, calculateShsatScores } = require('../utils/shsatScoring');
const { convertSatRawToScaled } = require('../utils/satScoring');
const TestCode = require('../models/TestCode');

const router = express.Router();

// Validation middleware
const validateGetQuestions = [
  query('testType')
    .isIn(['shsat', 'sat', 'state'])
    .withMessage('Invalid test type'),
  query('practiceSet')
    .optional()
    .isIn(['1', '2', 'diagnostic'])
    .withMessage('Practice set must be 1, 2, or diagnostic')
];

const validateSubmitAnswers = [
  body('testType')
    .isIn(['shsat', 'sat', 'state'])
    .withMessage('Invalid test type'),
  body('practiceSet')
    .optional()
    .isIn(['1', '2', 'diagnostic'])
    .withMessage('Practice set must be 1 or 2'),
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
// @access  Public (temporarily)
router.post('/submit', validateSubmitAnswers, handleValidationErrors, async (req, res) => {
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
        // For fill-in-the-blank, compare with correct_answer
        const userAnswer = String(answer.selectedAnswer).trim().toLowerCase();
        const correctAnswer = String(question.correct_answer).trim().toLowerCase();
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
      
      // Track SHSAT section scores
      if (testType === 'shsat') {
        if (categoryLower.includes('math')) {
          shsatSectionScores.math.total++;
          if (isCorrect) shsatSectionScores.math.correct++;
        } else if (categoryLower.includes('english')) {
          shsatSectionScores.english.total++;
          if (isCorrect) shsatSectionScores.english.correct++;
        }
      }

      // Track SAT section scores
      if (testType === 'sat') {
        if (categoryLower.includes('math')) {
          satSectionScores.math.total++;
          if (isCorrect) satSectionScores.math.correct++;
        } else if (categoryLower.includes('english') || categoryLower.includes('reading') || categoryLower.includes('writing')) {
          satSectionScores.english.total++;
          if (isCorrect) satSectionScores.english.correct++;
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
        explanation: question.explanation
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
      const scaledMath = convertSatRawToScaled(satSectionScores.math.correct, 'math');
      const scaledEnglish = convertSatRawToScaled(satSectionScores.english.correct, 'reading_writing');
      
      responseData.results.satScores = {
        math: {
          rawScore: satSectionScores.math.correct,
          totalQuestions: satSectionScores.math.total,
          percentage: satSectionScores.math.total > 0 ? Math.round((satSectionScores.math.correct / satSectionScores.math.total) * 100) : 0,
          scaledScore: scaledMath
        },
        reading_writing: { // Changed from 'english' to be more specific
          rawScore: satSectionScores.english.correct,
          totalQuestions: satSectionScores.english.total,
          percentage: satSectionScores.english.total > 0 ? Math.round((satSectionScores.english.correct / satSectionScores.english.total) * 100) : 0,
          scaledScore: scaledEnglish
        },
        totalScaledScore: scaledMath + scaledEnglish
      };
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