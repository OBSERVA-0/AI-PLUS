const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, adminAuth } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateProfileUpdate = [
  body('firstName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('grade')
    .optional()
    .isIn(['6', '7', '8', '9', '10', '11', '12'])
    .withMessage('Grade must be between 6 and 12')
];

const validatePasswordUpdate = [
  body('currentPassword')
    .exists()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match new password');
      }
      return true;
    })
];

const validatePreferences = [
  body('language')
    .optional()
    .isIn(['en', 'zh'])
    .withMessage('Language must be either "en" or "zh"'),
  body('notifications.email')
    .optional()
    .isBoolean()
    .withMessage('Email notification preference must be boolean'),
  body('notifications.progress')
    .optional()
    .isBoolean()
    .withMessage('Progress notification preference must be boolean')
];

// Helper function to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// Helper function to aggregate category scores for any test type
const getAggregatedCategoryScores = (testProgress) => {
  if (!testProgress || !testProgress.categoryPerformance) {
    return {
      math: { averageScore: 0, totalCorrect: 0, totalQuestions: 0 },
      english: { averageScore: 0, totalCorrect: 0, totalQuestions: 0 }
    };
  }
  const aggregated = {
    math: { totalCorrect: 0, totalQuestions: 0 },
    english: { totalCorrect: 0, totalQuestions: 0 }
  };
  for (const [category, data] of testProgress.categoryPerformance.entries()) {
    const categoryLower = category.toLowerCase();
    let mainCategory;
    if (categoryLower.includes('math')) {
      mainCategory = 'math';
    } else if (categoryLower.includes('english')) {
      mainCategory = 'english';
    } else {
      continue;
    }
    aggregated[mainCategory].totalQuestions += data.totalQuestions;
    aggregated[mainCategory].totalCorrect += data.correctAnswers;
  }
  const calculateAverage = (subject) => {
    if (subject.totalQuestions === 0) return 0;
    return Math.round((subject.totalCorrect / subject.totalQuestions) * 100);
  };
  return {
    math: {
      averageScore: calculateAverage(aggregated.math),
      totalCorrect: aggregated.math.totalCorrect,
      totalQuestions: aggregated.math.totalQuestions
    },
    english: {
      averageScore: calculateAverage(aggregated.english),
      totalCorrect: aggregated.english.totalCorrect,
      totalQuestions: aggregated.english.totalQuestions
    }
  };
};

// Helper function to get overall Math and English averages across all tests
const getOverallCategoryAverages = (testProgress) => {
  const shsatAverages = getAggregatedCategoryScores(testProgress.shsat);
  const satAverages = getAggregatedCategoryScores(testProgress.sat);
  const overallMath = {
    totalCorrect: shsatAverages.math.totalCorrect + satAverages.math.totalCorrect,
    totalQuestions: shsatAverages.math.totalQuestions + satAverages.math.totalQuestions
  };
  const overallEnglish = {
    totalCorrect: shsatAverages.english.totalCorrect + satAverages.english.totalCorrect,
    totalQuestions: shsatAverages.english.totalQuestions + satAverages.english.totalQuestions
  };
  const overallMathAverage = overallMath.totalQuestions > 0 ? Math.round((overallMath.totalCorrect / overallMath.totalQuestions) * 100) : 0;
  const overallEnglishAverage = overallEnglish.totalQuestions > 0 ? Math.round((overallEnglish.totalCorrect / overallEnglish.totalQuestions) * 100) : 0;
  return {
    math: overallMathAverage,
    english: overallEnglishAverage
  };
};

// @route   GET /api/user/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    const categoryAverages = getOverallCategoryAverages(user.testProgress);
    const totalMasteryAreas = Object.keys(user.getMasterySummary()).length;

    const userData = {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        grade: user.grade,
        role: user.role,
        emailVerified: user.emailVerified,
        preferences: user.preferences,
        testProgress: user.testProgress,
        stats: user.getStats(),
        categoryAverages: categoryAverages,
        totalMasteryAreas: totalMasteryAreas,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
    };

    res.json({
      success: true,
      data: {
        user: userData
      }
    });
  } catch (error) {
    console.error('❌ Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving profile information'
    });
  }
});

// @route   PUT /api/user/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, validateProfileUpdate, handleValidationErrors, async (req, res) => {
  try {
    const { firstName, lastName, grade } = req.body;
    
    const updateFields = {};
    if (firstName) updateFields.firstName = firstName.trim();
    if (lastName) updateFields.lastName = lastName.trim();
    if (grade) updateFields.grade = grade;
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateFields,
      { new: true, runValidators: true }
    );
    
    console.log('✅ Profile updated for:', user.email);
    
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          email: user.email,
          grade: user.grade,
          role: user.role,
          preferences: user.preferences,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('❌ Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile'
    });
  }
});

// @route   PUT /api/user/password
// @desc    Update user password
// @access  Private
router.put('/password', auth, validatePasswordUpdate, handleValidationErrors, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    // Get user with password
    const user = await User.findById(req.user._id).select('+password');
    
    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    console.log('✅ Password updated for:', user.email);
    
    res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('❌ Update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating password'
    });
  }
});

// @route   PUT /api/user/preferences
// @desc    Update user preferences
// @access  Private
router.put('/preferences', auth, validatePreferences, handleValidationErrors, async (req, res) => {
  try {
    const { language, notifications } = req.body;
    
    const updateFields = {};
    if (language) updateFields['preferences.language'] = language;
    if (notifications) {
      if (notifications.email !== undefined) updateFields['preferences.notifications.email'] = notifications.email;
      if (notifications.progress !== undefined) updateFields['preferences.notifications.progress'] = notifications.progress;
    }
    
    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateFields,
      { new: true, runValidators: true }
    );
    
    console.log('✅ Preferences updated for:', user.email);
    
    res.json({
      success: true,
      message: 'Preferences updated successfully',
      data: {
        preferences: user.preferences
      }
    });
  } catch (error) {
    console.error('❌ Update preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating preferences'
    });
  }
});

// @route   GET /api/user/stats
// @desc    Get user statistics
// @access  Private
router.get('/stats', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const stats = user.getStats();
    
    res.json({
      success: true,
      data: {
        stats,
        testProgress: user.testProgress
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching user stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user statistics'
    });
  }
});

// @route   POST /api/user/update-stats
// @desc    Update user test statistics
// @access  Private
router.post('/update-stats', auth, async (req, res) => {
  try {
    const { testType, score, timeSpent, categoryScores, shsatScores, satScores } = req.body;
    
    // Get user
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Map test types to database fields
    const testTypeMap = {
      'shsat': 'shsat',
      'sat': 'sat',
      'state': 'stateTest',
      'stateTest': 'stateTest', // Allow both formats
      'statetest': 'stateTest'  // Allow lowercase format from frontend
    };
    
    const dbTestType = testTypeMap[testType];
    if (!dbTestType) {
      return res.status(400).json({
        success: false,
        message: 'Invalid test type'
      });
    }
    
    // Update test progress
    const testProgress = user.testProgress[dbTestType];
    
    // Initialize values if undefined
    testProgress.testsCompleted = testProgress.testsCompleted || 0;
    testProgress.averageScore = testProgress.averageScore || 0;
    testProgress.bestScore = testProgress.bestScore || 0;
    testProgress.timeSpent = testProgress.timeSpent || 0;
    // Calculate new stats
    const newTestsCompleted = testProgress.testsCompleted + 1;
    const totalScorePoints = (testProgress.averageScore * testProgress.testsCompleted) + score;
    const newAverageScore = Math.round((totalScorePoints / newTestsCompleted) * 100) / 100;
    
    // Update test progress
    testProgress.testsCompleted = newTestsCompleted;
    testProgress.averageScore = newAverageScore;
    testProgress.bestScore = Math.max(testProgress.bestScore, score);
    // Convert timeSpent from seconds to minutes before adding to testProgress
    testProgress.timeSpent = testProgress.timeSpent + Math.round(timeSpent / 60);
    testProgress.lastAttempt = new Date();
    
    // Update SHSAT scaled scores if provided
    if (testType === 'shsat' && shsatScores) {
      testProgress.latestScaledScore = {
        math: shsatScores.math.scaledScore,
        english: shsatScores.english.scaledScore,
        total: shsatScores.totalScaledScore
      };
      
      // Update best score if the new score is higher
      if (shsatScores.totalScaledScore > (testProgress.bestScaledScore.total || 0)) {
        testProgress.bestScaledScore = {
          math: shsatScores.math.scaledScore,
          english: shsatScores.english.scaledScore,
          total: shsatScores.totalScaledScore
        };
      }
    }

    // Update SAT scaled scores if provided
    if (testType === 'sat' && satScores) {
      testProgress.latestScaledScore = {
        math: satScores.math.scaledScore,
        reading_writing: satScores.reading_writing.scaledScore,
        total: satScores.totalScaledScore
      };
      
      // Update best score if the new score is higher
      if (satScores.totalScaledScore > (testProgress.bestScaledScore.total || 0)) {
        testProgress.bestScaledScore = {
          math: satScores.math.scaledScore,
          reading_writing: satScores.reading_writing.scaledScore,
          total: satScores.totalScaledScore
        };
      }
    }

    // Update category performance if provided
    if (categoryScores) {
      user.updateCategoryPerformance(testType, categoryScores);
    }
    
    await user.save();
    
    // Get updated stats for response
    const stats = user.getStats();
    
    res.json({
      success: true,
      data: {
        stats,
        testProgress: user.testProgress,
        message: 'Test statistics updated successfully'
      }
    });
    
  } catch (error) {
    console.error('❌ Error updating test stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating test statistics'
    });
  }
});

// @route   GET /api/user/mastery
// @desc    Get user mastery levels for all categories
// @access  Private
router.get('/mastery', auth, async (req, res) => {
  try {
    console.log('🎯 Fetching mastery data for user:', req.user._id);
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('👤 User found, getting category performance...');
    const categoryPerformance = user.getCategoryPerformance();
    const masterySummary = user.getMasterySummary();
    
    console.log('📊 Sending mastery response:', {
      categoryPerformance,
      masterySummary
    });
    
    res.json({
      success: true,
      data: {
        categoryPerformance,
        masterySummary
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching user mastery:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching mastery data'
    });
  }
});

// @route   POST /api/user/seed-mastery
// @desc    Seed sample mastery data for testing (temporary)
// @access  Private
router.post('/seed-mastery', auth, async (req, res) => {
  try {
    console.log('🌱 Seeding mastery data for user:', req.user._id);
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Sample category scores for testing
    const sampleCategoryScores = {
      'Reading Comprehension': { correct: 8, total: 10 },
      'Grammar': { correct: 6, total: 8 },
      'Algebra': { correct: 7, total: 9 },
      'Geometry': { correct: 5, total: 7 }
    };

    // Update category performance
    user.updateCategoryPerformance('shsat', sampleCategoryScores);
    await user.save();

    console.log('✅ Sample mastery data seeded successfully');
    
    res.json({
      success: true,
      message: 'Sample mastery data seeded successfully'
    });
    
  } catch (error) {
    console.error('❌ Error seeding mastery data:', error);
    res.status(500).json({
      success: false,
      message: 'Error seeding mastery data'
    });
  }
});

// @route   GET /api/user/test-history
// @desc    Get user test history
// @access  Private
router.get('/test-history', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Sort test history by completion date (most recent first)
    const testHistory = (user.testHistory || []).sort((a, b) => 
      new Date(b.completedAt) - new Date(a.completedAt)
    );

    console.log(`📊 Retrieved ${testHistory.length} test history entries for user ${user.email}`);
    testHistory.forEach((test, index) => {
      console.log(`📋 Test ${index + 1}: ${test.testName}, detailed results: ${test.detailedResults ? test.detailedResults.length : 'undefined'}`);
    });

    res.json({
      success: true,
      data: {
        testHistory
      }
    });
  } catch (error) {
    console.error('❌ Error fetching test history:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching test history'
    });
  }
});

// @route   DELETE /api/user/account
// @desc    Deactivate user account
// @access  Private
router.delete('/account', auth, async (req, res) => {
  try {
    const { password } = req.body;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required to deactivate account'
      });
    }
    
    // Get user with password
    const user = await User.findById(req.user._id).select('+password');
    
    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Incorrect password'
      });
    }
    
    // Deactivate account (don't actually delete for data retention)
    user.isActive = false;
    await user.save();
    
    console.log('❌ Account deactivated for:', user.email);
    
    res.json({
      success: true,
      message: 'Account deactivated successfully'
    });
  } catch (error) {
    console.error('❌ Deactivate account error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deactivating account'
    });
  }
});

// Admin routes
// @route   GET /api/user/admin/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/admin/users', adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const users = await User.find()
      .select('-password -loginAttempts -lockUntil')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    
    const total = await User.countDocuments();
    
    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('❌ Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving users'
    });
  }
});

// @route   GET /api/user/admin/stats
// @desc    Get platform statistics (admin only)
// @access  Private/Admin
router.get('/admin/stats', adminAuth, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const newUsersThisMonth = await User.countDocuments({
      createdAt: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
    });
    
    res.json({
      success: true,
      data: {
        stats: {
          totalUsers,
          activeUsers,
          inactiveUsers: totalUsers - activeUsers,
          newUsersThisMonth
        }
      }
    });
  } catch (error) {
    console.error('❌ Get admin stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving platform statistics'
    });
  }
});

module.exports = router; 