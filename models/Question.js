const mongoose = require('mongoose');

const questionSchema = new mongoose.Schema({
  // Basic question info
  question_text: {
    type: String,
    required: [true, 'Question text is required'],
    trim: true
  },
  
  // Optional passage for reading comprehension questions
  passage: {
    type: String,
    trim: true
  },
  
  // Multiple choice options (simple string array)
  options: [{
    type: String,
    required: true,
    trim: true
  }],
  
  // Correct answer index (0-based)
  correct_answer: {
    type: Number,
    required: [true, 'Correct answer index is required'],
    min: 0
  },
  
  // Test categorization
  test_type: {
    type: String,
    required: [true, 'Test type is required'],
    enum: ['shsat', 'sat', 'state'],
    lowercase: true
  },
  
  subject: {
    type: String,
    required: [true, 'Subject is required'],
    enum: ['english_language_arts', 'mathematics', 'reading', 'writing', 'science'],
    lowercase: true
  },
  
  // Grade level (single value instead of array)
  grade: {
    type: Number,
    required: [true, 'Grade is required'],
    min: 6,
    max: 12
  },
  
  // Practice set identifier
  practice_set: {
    type: String,
    required: [true, 'Practice set is required'],
    trim: true
  },
  
  // Question number within the practice set
  question_number: {
    type: Number,
    required: [true, 'Question number is required'],
    min: 1
  },
  
  // Difficulty level
  difficulty: {
    type: String,
    enum: ['easy', 'medium', 'hard'],
    default: 'medium'
  },
  
  // Optional metadata (keeping some useful fields from old schema)
  category: {
    type: String,
    trim: true
  },
  
  time_estimate: {
    type: Number, // in seconds
    default: 60
  },
  
  explanation: {
    type: String,
    trim: true
  },
  
  tags: [String],
  
  // Usage statistics
  times_used: {
    type: Number,
    default: 0
  },
  
  average_score: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  
  // Status
  is_active: {
    type: Boolean,
    default: true
  },
  
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      return ret;
    }
  }
});

// Indexes for efficient querying
questionSchema.index({ test_type: 1, subject: 1 });
questionSchema.index({ test_type: 1, subject: 1, difficulty: 1 });
questionSchema.index({ grade: 1 });
questionSchema.index({ practice_set: 1 });
questionSchema.index({ test_type: 1, subject: 1, practice_set: 1 });

// Method to get correct answer index
questionSchema.methods.getCorrectAnswerIndex = function() {
  return this.correct_answer;
};

// Method to check if an answer is correct
questionSchema.methods.checkAnswer = function(answerIndex) {
  return answerIndex === this.correct_answer;
};

// Static method to get random questions
questionSchema.statics.getRandomQuestions = async function(testType, subject, count = 20, difficulty = null, grade = null) {
  const matchCriteria = {
    test_type: testType.toLowerCase(),
    subject: subject.toLowerCase(),
    is_active: true
  };
  
  if (difficulty) {
    matchCriteria.difficulty = difficulty;
  }
  
  if (grade) {
    matchCriteria.grade = parseInt(grade);
  }
  
  const questions = await this.aggregate([
    { $match: matchCriteria },
    { $sample: { size: count } }
  ]);
  
  return questions;
};

// Static method to get questions by practice set
questionSchema.statics.getQuestionsByPracticeSet = async function(testType, subject, practiceSet, grade = null) {
  const matchCriteria = {
    test_type: testType.toLowerCase(),
    subject: subject.toLowerCase(),
    practice_set: practiceSet,
    is_active: true
  };
  
  if (grade) {
    matchCriteria.grade = parseInt(grade);
  }
  
  return await this.find(matchCriteria).sort({ question_number: 1 });
};

// Static method to get questions by category
questionSchema.statics.getQuestionsByCategory = async function(testType, subject, categories = []) {
  const matchCriteria = {
    test_type: testType.toLowerCase(),
    subject: subject.toLowerCase(),
    is_active: true
  };
  
  if (categories.length > 0) {
    matchCriteria.category = { $in: categories };
  }
  
  return await this.find(matchCriteria);
};

// Update usage statistics
questionSchema.methods.recordUsage = async function(wasCorrect) {
  this.times_used += 1;
  
  // Update average score
  const newAverageScore = ((this.average_score * (this.times_used - 1)) + (wasCorrect ? 100 : 0)) / this.times_used;
  this.average_score = Math.round(newAverageScore * 100) / 100;
  
  await this.save();
};

module.exports = mongoose.model('Question', questionSchema); 