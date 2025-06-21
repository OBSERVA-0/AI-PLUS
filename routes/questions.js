const express = require('express');
const { body, validationResult, query } = require('express-validator');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Validation middleware
const validateGetQuestions = [
  query('testType')
    .isIn(['shsat', 'sat', 'state'])
    .withMessage('Invalid test type')
];

const validateSubmitAnswers = [
  body('testType')
    .isIn(['shsat', 'sat', 'state'])
    .withMessage('Invalid test type'),
  body('answers')
    .isArray()
    .withMessage('Answers must be an array'),
  body('answers.*.questionId')
    .exists()
    .withMessage('Question ID is required'),
  body('answers.*.selectedAnswer')
    .isInt({ min: 0 })
    .withMessage('Selected answer must be a valid index')
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

// Helper function to read questions from JSON file
async function readQuestionsFromJSON(testType) {
  try {
    const filePath = path.join(__dirname, '..', 'data', `${testType}practice1questions.json`);
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading questions file:', error);
    throw new Error('Failed to load questions');
  }
}

// @route   GET /api/questions/test
// @desc    Get questions for a specific test
// @access  Public (temporarily)
router.get('/test', validateGetQuestions, handleValidationErrors, async (req, res) => {
  try {
    const { testType } = req.query;
    
    console.log(`🎯 Fetching questions from JSON: ${testType}`);
    
    // Read questions from JSON file
    const questions = await readQuestionsFromJSON(testType);
    
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
    const { testType, answers, timeSpent } = req.body;
    
    console.log(`📝 Checking answers for test: ${testType}`);
    
    // Get questions from JSON to check answers
    const questions = await readQuestionsFromJSON(testType);
    
    // Calculate results
    let correctCount = 0;
    const categoryScores = {};
    const detailedResults = [];
    
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
    
    const percentage = Math.round((correctCount / answers.length) * 100);
    
    res.json({
      success: true,
      data: {
        results: {
          correctCount,
          totalQuestions: answers.length,
          percentage,
          timeSpent,
          categoryScores
        },
        detailedResults
      }
    });
    
  } catch (error) {
    console.error('❌ Error submitting answers:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing test submission'
    });
  }
});

module.exports = router; 