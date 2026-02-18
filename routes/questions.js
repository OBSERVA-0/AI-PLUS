const express = require('express');
const { body, validationResult, query } = require('express-validator');
const fs = require('fs').promises;
const path = require('path');
const { readQuestionsFromJSON } = require('../utils/questionReader');
const { convertRawToScaled: convertShsatRawToScaled, calculateShsatScores } = require('../utils/shsatScoring');
const { convertSatRawToScaled, calculateSatResults } = require('../utils/satScoring');
const { convertPsatRawToScaled, calculatePsatResults } = require('../utils/psatScoring');
const TestCode = require('../models/TestCode');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Environment-aware logging to reduce overhead in production
const isDev = process.env.NODE_ENV === 'development';
const log = {
  debug: isDev ? console.log.bind(console) : () => {},
  info: console.log.bind(console),
  error: console.error.bind(console)
};

// Validation middleware
const validateGetQuestions = [
  query('testType')
    .isIn(['shsat', 'sat', 'psat', 'statetest'])
    .withMessage('Invalid test type'),
  query('practiceSet')
    .optional()
    .isIn(['1', '2', '3','4', '5', '6', '7', '8', '9','10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', 'diagnostic'])
    .withMessage('Practice set must be 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, or diagnostic'),
  query('sectionType')
    .optional()
    .matches(/^(full|ela|math|g[3-8](ela|math)?)$/)
    .withMessage('Section type must be full, ela, math, or grade/subject combination (e.g., g6math, g7ela)')
];

const validateSubmitAnswers = [
  body('testType')
    .isIn(['shsat', 'sat', 'psat', 'statetest'])
    .withMessage('Invalid test type'),
  body('practiceSet')
    .optional()
    .isIn(['1', '2', '3','4', '5', '6', '7', '8', '9','10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', 'diagnostic'])
    .withMessage('Practice set must be 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, or diagnostic'),
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
    const { testType, practiceSet = '1', sectionType = null } = req.query;
    log.debug(`🎯 Fetching questions: ${testType} set ${practiceSet}${sectionType ? ` (${sectionType})` : ''}`);
    
    // Read questions from JSON file (with caching)
    const questions = await readQuestionsFromJSON(testType, practiceSet, sectionType);

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
    
    log.debug(`📤 Sending ${questionsWithoutAnswers.length} questions to frontend`);
    
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
    const { testType, practiceSet = '1', answers, timeSpent, sectionType = null } = req.body;
    
    // Add timeout protection to prevent crashes
    const startTime = Date.now();
    const SCORING_TIMEOUT = 95000; // 95 seconds (increased for high load)
    
    // Get questions from JSON to check answers (with caching)
    const questions = await readQuestionsFromJSON(testType, practiceSet, sectionType);
    
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
    const psatSectionScores = {
      math: { correct: 0, total: 0 },
      english: { correct: 0, total: 0 } // english here means reading & writing
    };
    
    // Generate test name early for error handling
    let testName = '';
    if (testType === 'shsat') {
      testName = practiceSet === 'diagnostic' 
        ? 'SHSAT Diagnostic Test' 
        : `SHSAT Practice Test ${practiceSet}${sectionType ? ` (${sectionType.toUpperCase()})` : ''}`;
    } else if (testType === 'sat') {
      testName = `SAT Practice Test ${practiceSet}`;
    } else if (testType === 'psat') {
      testName = `PSAT Practice Test ${practiceSet}`;
    } else if (testType === 'statetest') {
      // Extract grade from sectionType (e.g., "g6math" -> "6", "g7ela" -> "7")
      if (sectionType && sectionType.startsWith('g')) {
        const grade = sectionType.charAt(1);
        const subject = sectionType.substring(2);
        const subjectName = subject === 'math' ? 'Math' : subject === 'ela' ? 'ELA' : subject.toUpperCase();
        testName = `State Test - Grade ${grade} ${subjectName} Practice ${practiceSet}`;
      } else {
        testName = `State Test - Grade 7 Practice ${practiceSet}`; // fallback
      }
    }
    
    // Create question lookup map for O(1) performance instead of O(n)
    const questionMap = new Map();
    questions.forEach(q => questionMap.set(q._id, q));
    
    // Check for timeout during processing
    const checkTimeout = () => {
      if (Date.now() - startTime > SCORING_TIMEOUT) {
        throw new Error('Score calculation timeout - please try again');
      }
    };
    
    for (const answer of answers) {
      // Check timeout every 20 questions to prevent hanging
      if (detailedResults.length % 20 === 0) {
        checkTimeout();
      }
      const question = questionMap.get(answer.questionId);
      
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
      } else if (question.answer_type === 'multiple_answers') {
        // For multiple answers, check if user selected all correct options and no incorrect ones
        const userAnswers = Array.isArray(answer.selectedAnswer) ? answer.selectedAnswer : [];
        const correctAnswers = Array.isArray(question.correct_answer) ? question.correct_answer : [question.correct_answer];
        
        // Sort both arrays for comparison
        const sortedUserAnswers = [...userAnswers].sort((a, b) => a - b);
        const sortedCorrectAnswers = [...correctAnswers].sort((a, b) => a - b);
        
        // Check if arrays are identical
        isCorrect = sortedUserAnswers.length === sortedCorrectAnswers.length &&
                   sortedUserAnswers.every((answer, index) => answer === sortedCorrectAnswers[index]);
      } else {
        // For single multiple choice, compare with correct_answer index
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
      
      // Track SHSAT section scores - handle both combined and section-specific tests
      if (testType === 'shsat') {
        // For ELA-only tests (sectionType === 'ela')
        if (sectionType === 'ela' || (categoryLower.includes('revising') || categoryLower.includes('reading'))) {
          shsatSectionScores.english.total++;
          if (isCorrect) shsatSectionScores.english.correct++;
        }
        // For Math-only tests (sectionType === 'math')
        else if (sectionType === 'math' || categoryLower.includes('math')) {
          shsatSectionScores.math.total++;
          if (isCorrect) shsatSectionScores.math.correct++;
        }
        // For combined tests, use question numbers (legacy behavior)
        else if (!sectionType || sectionType === 'full') {
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

      // Track PSAT section scores using question numbers (same structure as SAT)
      if (testType === 'psat') {
        if (question.question_number <= 54) {
          // Questions 1-54 are Reading & Writing
          psatSectionScores.english.total++;
          if (isCorrect) psatSectionScores.english.correct++;
        } else if (question.question_number <= 98) {
          // Questions 55-98 are Math
          psatSectionScores.math.total++;
          if (isCorrect) psatSectionScores.math.correct++;
        }
      }
      
      // Record detailed result for review with essential fields for client display
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
        question_number: question.question_number,
        hasAnswer: answer.selectedAnswer !== undefined && answer.selectedAnswer !== null && answer.selectedAnswer !== ''
      });
    }
    
    const percentage = answers.length > 0 ? Math.round((correctCount / answers.length) * 100) : 0;
    
    // Log performance metrics (only in development)
    const processingTime = Date.now() - startTime;
    log.debug(`⚡ Score calculation: ${processingTime}ms for ${answers.length} answers`);
    
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
      // Use the new accurate SHSAT scoring system with section type support
      const shsatScoreResults = calculateShsatScores(
        shsatSectionScores.math.correct,
        shsatSectionScores.english.correct,
        sectionType
      );

      responseData.results.shsatScores = {
        totalScaledScore: shsatScoreResults.totalScaledScore,
        sectionType: shsatScoreResults.sectionType || 'full'
      };

      // Add math scores if available (full test or math-only)
      if (shsatScoreResults.math) {
        responseData.results.shsatScores.math = {
          rawScore: shsatSectionScores.math.correct,
          totalQuestions: shsatSectionScores.math.total,
          percentage: shsatSectionScores.math.total > 0 ? Math.round((shsatSectionScores.math.correct / shsatSectionScores.math.total) * 100) : 0,
          scaledScore: shsatScoreResults.math.scaledScore
        };
      }

      // Add English scores if available (full test or ELA-only)
      if (shsatScoreResults.english) {
        responseData.results.shsatScores.english = {
          rawScore: shsatSectionScores.english.correct,
          totalQuestions: shsatSectionScores.english.total,
          percentage: shsatSectionScores.english.total > 0 ? Math.round((shsatSectionScores.english.correct / shsatSectionScores.english.total) * 100) : 0,
          scaledScore: shsatScoreResults.english.scaledScore
        };
      }
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

    // Add PSAT scaled scores if applicable
    if (testType === 'psat') {
      // Use the new comprehensive PSAT scoring system
      const psatScoreResults = calculatePsatResults(
        psatSectionScores.math.correct,
        psatSectionScores.english.correct
      );
      
      responseData.results.psatScores = {
        math: {
          rawScore: psatSectionScores.math.correct,
          totalQuestions: psatSectionScores.math.total,
          percentage: psatSectionScores.math.total > 0 ? Math.round((psatSectionScores.math.correct / psatSectionScores.math.total) * 100) : 0,
          scaledScore: psatScoreResults.math.scaledScore
        },
        reading_writing: {
          rawScore: psatSectionScores.english.correct,
          totalQuestions: psatSectionScores.english.total,
          percentage: psatSectionScores.english.total > 0 ? Math.round((psatSectionScores.english.correct / psatSectionScores.english.total) * 100) : 0,
          scaledScore: psatScoreResults.readingWriting.scaledScore
        },
        totalScaledScore: psatScoreResults.total.score,
        percentile: psatScoreResults.total.percentile,
        performanceLevel: psatScoreResults.total.performanceLevel,
        nationalMerit: psatScoreResults.nationalMerit
      };
    }

    // Build test history entry ONCE before save attempts
    // This avoids rebuilding on each retry and reduces logging overhead
    const testHistoryEntry = {
      testType: testType === 'statetest' ? 'state' : testType,
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
      detailedResults: detailedResults.map((result, index) => ({
        questionId: result.questionId,
        questionNumber: result.question_number || (index + 1),
        isCorrect: result.isCorrect,
        userAnswer: result.userAnswer,
        category: result.category,
        hasAnswer: result.hasAnswer
      }))
    };

    // Add scaled scores if available
    if (testType === 'shsat' && responseData.results.shsatScores) {
      testHistoryEntry.scaledScores = {};
      if (responseData.results.shsatScores.totalScaledScore !== undefined) {
        testHistoryEntry.scaledScores.total = responseData.results.shsatScores.totalScaledScore;
      }
      if (responseData.results.shsatScores.math?.scaledScore !== undefined) {
        testHistoryEntry.scaledScores.math = responseData.results.shsatScores.math.scaledScore;
      }
      if (responseData.results.shsatScores.english?.scaledScore !== undefined) {
        testHistoryEntry.scaledScores.english = responseData.results.shsatScores.english.scaledScore;
      }
    } else if (testType === 'sat' && responseData.results.satScores) {
      testHistoryEntry.scaledScores = {
        total: responseData.results.satScores.totalScaledScore
      };
      if (responseData.results.satScores.math?.scaledScore !== undefined) {
        testHistoryEntry.scaledScores.math = responseData.results.satScores.math.scaledScore;
      }
      if (responseData.results.satScores.reading_writing?.scaledScore !== undefined) {
        testHistoryEntry.scaledScores.reading_writing = responseData.results.satScores.reading_writing.scaledScore;
      }
    } else if (testType === 'psat' && responseData.results.psatScores) {
      testHistoryEntry.scaledScores = {
        total: responseData.results.psatScores.totalScaledScore
      };
      if (responseData.results.psatScores.math?.scaledScore !== undefined) {
        testHistoryEntry.scaledScores.math = responseData.results.psatScores.math.scaledScore;
      }
      if (responseData.results.psatScores.reading_writing?.scaledScore !== undefined) {
        testHistoryEntry.scaledScores.reading_writing = responseData.results.psatScores.reading_writing.scaledScore;
      }
    }

    // PERFORMANCE OPTIMIZATION: Use atomic $push instead of findById + save
    // This avoids loading the entire user document (which grows with test history)
    // and directly appends to the testHistory array in a single database operation
    let saveAttempts = 0;
    const maxRetries = 3;
    let saveSuccessful = false;
    let lastError = null;
    
    while (saveAttempts < maxRetries && !saveSuccessful) {
      try {
        saveAttempts++;
        
        // Use findByIdAndUpdate with $push for atomic, efficient update
        // This is O(1) regardless of testHistory size, vs O(n) with save()
        const updateResult = await User.findByIdAndUpdate(
          req.user._id,
          { $push: { testHistory: testHistoryEntry } },
          { 
            new: true, 
            runValidators: true,
            maxTimeMS: 15000 // 15 second timeout
          }
        ).select('_id email testHistory');
        
        if (!updateResult) {
          throw new Error('User not found');
        }
        
        console.log(`✅ Test history saved for user ${req.user._id}: ${testName} (${updateResult.testHistory.length} total tests)`);
        saveSuccessful = true;
        
      } catch (historyError) {
        lastError = historyError;
        console.error(`❌ Error saving test history (attempt ${saveAttempts}/${maxRetries}):`, historyError.message);
        
        if (saveAttempts < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const backoffMs = Math.pow(2, saveAttempts - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }
    
    // Check if save was successful after all retries
    if (!saveSuccessful) {
      console.error(`❌ CRITICAL: Failed to save test history after ${maxRetries} attempts for user ${req.user._id}`);
      console.error(`❌ Last error:`, lastError);
      
      // Log critical data for manual recovery
      const backupData = {
        timestamp: new Date().toISOString(),
        userId: req.user._id,
        userEmail: req.user.email || 'unknown',
        testType,
        practiceSet,
        testName: testName || `${testType} practice ${practiceSet}`,
        results: {
          percentage,
          correctCount,
          totalQuestions: answers.length,
          timeSpent
        },
        scaledScores: responseData.results.shsatScores || responseData.results.satScores || null,
        error: {
          message: lastError?.message,
          name: lastError?.name,
          attempts: saveAttempts
        }
      };
      
      console.error(`🚨 BACKUP DATA FOR MANUAL RECOVERY:`, JSON.stringify(backupData));
      
      // Return error to user instead of false success
      return res.status(500).json({
        success: false,
        message: 'Your test was completed but there was an error saving your results. Please contact support with this error code: SAVE_FAILED',
        errorCode: 'SAVE_FAILED',
        retryable: true,
        backupId: `${req.user._id}_${Date.now()}` // For support tracking
      });
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
