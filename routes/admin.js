const express = require('express');
const User = require('../models/User');
const TestCode = require('../models/TestCode');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Middleware to check admin role
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

// @route   GET /api/admin/students
// @desc    Get all students data for admin dashboard
// @access  Private (Admin only)
router.get('/students', auth, requireAdmin, async (req, res) => {
  try {
    const { search, grade, page = 1, limit = 20 } = req.query;
    
    // Build search query
    let query = { role: 'student' };
    
    // Add grade filter
    if (grade && grade !== 'all') {
      query.grade = grade;
    }
    
    // Add search filter
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get students with pagination
    const students = await User.find(query)
      .select('firstName lastName email grade createdAt lastLogin testProgress isActive')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    // Get total count for pagination
    const total = await User.countDocuments(query);
    
    // Transform data for admin dashboard
    const studentData = students.map(student => {
      const stats = student.getStats();
      const masterySummary = student.getMasterySummary();
      
      // Calculate total tests and best score across all test types
      const totalTests = student.testProgress.shsat.testsCompleted + 
                        student.testProgress.sat.testsCompleted + 
                        student.testProgress.stateTest.testsCompleted;
      
      const bestScores = [
        student.testProgress.shsat.bestScore,
        student.testProgress.sat.bestScore,
        student.testProgress.stateTest.bestScore
      ].filter(score => score > 0);
      
      const overallBestScore = bestScores.length > 0 ? Math.max(...bestScores) : 0;
      
      return {
        id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        grade: student.grade,
        joinDate: student.createdAt,
        lastLogin: student.lastLogin,
        isActive: student.isActive,
        testStats: {
          totalTests: totalTests,
          averageScore: stats.averageScore,
          bestScore: overallBestScore,
          timeSpent: stats.totalTimeSpent
        },
        testProgress: {
          shsat: {
            testsCompleted: student.testProgress.shsat.testsCompleted,
            averageScore: student.testProgress.shsat.averageScore,
            bestScore: student.testProgress.shsat.bestScore
          },
          sat: {
            testsCompleted: student.testProgress.sat.testsCompleted,
            averageScore: student.testProgress.sat.averageScore,
            bestScore: student.testProgress.sat.bestScore
          },
          stateTest: {
            testsCompleted: student.testProgress.stateTest.testsCompleted,
            averageScore: student.testProgress.stateTest.averageScore,
            bestScore: student.testProgress.stateTest.bestScore
          }
        },
        masteryLevels: masterySummary
      };
    });
    
    res.json({
      success: true,
      data: {
        students: studentData,
        pagination: {
          current: page,
          total: Math.ceil(total / limit),
          count: studentData.length,
          totalStudents: total
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Get students error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving students data'
    });
  }
});

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

// @route   GET /api/admin/student/:id
// @desc    Get detailed student data
// @access  Private (Admin only)
router.get('/student/:id', auth, requireAdmin, async (req, res) => {
  try {
    const student = await User.findById(req.params.id);
    
    if (!student || student.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    const stats = student.getStats();
    const masterySummary = student.getMasterySummary();
    const categoryAverages = getOverallCategoryAverages(student.testProgress);
    
    res.json({
      success: true,
      data: {
        user: {
            id: student._id,
            firstName: student.firstName,
            lastName: student.lastName,
            fullName: student.fullName,
            email: student.email,
            grade: student.grade,
            createdAt: student.createdAt,
            lastLogin: student.lastLogin,
            isActive: student.isActive,
            categoryAverages: categoryAverages
        },
        stats: stats,
        testProgress: student.testProgress,
        masterySummary: masterySummary
      }
    });
    
  } catch (error) {
    console.error('❌ Get student error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving student data'
    });
  }
});

// @route   GET /api/admin/dashboard-stats
// @desc    Get admin dashboard statistics
// @access  Private (Admin only)
router.get('/dashboard-stats', auth, requireAdmin, async (req, res) => {
  try {
    // Get overall statistics
    const totalStudents = await User.countDocuments({ role: 'student' });
    const activeStudents = await User.countDocuments({ role: 'student', isActive: true });
    const studentsThisMonth = await User.countDocuments({
      role: 'student',
      createdAt: { $gte: new Date(new Date().setDate(1)) }
    });
    
    // Get recent activity (students with recent login)
    const recentActivity = await User.countDocuments({
      role: 'student',
      lastLogin: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    
    // Get top performing students
    const topStudents = await User.find({ role: 'student' })
      .select('firstName lastName testProgress')
      .limit(100);
    
    // Calculate average scores and find top performers
    const studentsWithScores = topStudents.map(student => {
      const totalTests = student.testProgress.shsat.testsCompleted + 
                        student.testProgress.sat.testsCompleted + 
                        student.testProgress.stateTest.testsCompleted;
      
      if (totalTests === 0) return null;
      
      let totalScore = 0;
      let testsWithScores = 0;
      
      if (student.testProgress.shsat.testsCompleted > 0) {
        totalScore += student.testProgress.shsat.averageScore;
        testsWithScores++;
      }
      if (student.testProgress.sat.testsCompleted > 0) {
        totalScore += student.testProgress.sat.averageScore;
        testsWithScores++;
      }
      if (student.testProgress.stateTest.testsCompleted > 0) {
        totalScore += student.testProgress.stateTest.averageScore;
        testsWithScores++;
      }
      
      const averageScore = testsWithScores > 0 ? Math.round(totalScore / testsWithScores) : 0;
      
      return {
        name: `${student.firstName} ${student.lastName}`,
        averageScore: averageScore,
        totalTests: totalTests
      };
    }).filter(student => student !== null);
    
    const topPerformers = studentsWithScores
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 5);
    
    res.json({
      success: true,
      data: {
        totalStudents,
        activeStudents,
        studentsThisMonth,
        recentActivity,
        topPerformers
      }
    });
    
  } catch (error) {
    console.error('❌ Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving dashboard statistics'
    });
  }
});

// @route   GET /api/admin/test-code
// @desc    Get the current global test code
// @access  Private (Admin only)
router.get('/test-code', auth, requireAdmin, async (req, res) => {
  try {
    const testCode = await TestCode.findOne({ name: 'global' });
    if (!testCode) {
      return res.status(404).json({
        success: false,
        message: 'Global test code not found.'
      });
    }
    res.json({
      success: true,
      data: {
        code: testCode.code
      }
    });
  } catch (error) {
    console.error('❌ Get test code error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving test code'
    });
  }
});

// @route   POST /api/admin/generate-test-code
// @desc    Generate a new global test code
// @access  Private (Admin only)
router.post('/generate-test-code', auth, requireAdmin, async (req, res) => {
    try {
        const newCode = Math.floor(100 + Math.random() * 900).toString();

        const updatedCode = await TestCode.findOneAndUpdate(
            { name: 'global' },
            { code: newCode },
            { new: true, upsert: true }
        );

        res.json({
            success: true,
            message: 'New test code generated successfully.',
            data: {
                code: updatedCode.code
            }
        });

    } catch (error) {
        console.error('❌ Generate test code error:', error);
        res.status(500).json({
            success: false,
            message: 'Error generating new test code.'
        });
    }
});

// @route   GET /api/admin/user/:id/test-history
// @desc    Get test history for a specific user (admin only)
// @access  Private (Admin only)
router.get('/user/:id/test-history', auth, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user || user.role !== 'student') {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    // Sort test history by completion date (most recent first)
    const testHistory = (user.testHistory || []).sort((a, b) => 
      new Date(b.completedAt) - new Date(a.completedAt)
    );
    
    console.log(`📊 Admin retrieved ${testHistory.length} test history entries for user ${user.email}`);
    
    res.json({
      success: true,
      data: {
        student: {
          id: user._id,
          name: `${user.firstName} ${user.lastName}`,
          email: user.email,
          grade: user.grade
        },
        testHistory
      }
    });
    
  } catch (error) {
    console.error('❌ Get user test history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user test history'
    });
  }
});

// @route   DELETE /api/admin/user/:id
// @desc    Delete a user (admin only)
// @access  Private (Admin only)
router.delete('/user/:id', auth, requireAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Find the user to delete
    const userToDelete = await User.findById(userId);
    
    if (!userToDelete) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Prevent admin from deleting themselves
    if (userToDelete._id.toString() === req.user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot delete your own account'
      });
    }
    
    // Prevent deletion of other admin accounts (optional security measure)
    if (userToDelete.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete admin accounts'
      });
    }
    
    // Delete the user
    await User.findByIdAndDelete(userId);
    
    console.log(`🗑️ Admin ${req.user.email} deleted user: ${userToDelete.email}`);
    
    res.json({
      success: true,
      message: `User ${userToDelete.firstName} ${userToDelete.lastName} has been deleted successfully`,
      data: {
        deletedUser: {
          id: userToDelete._id,
          name: `${userToDelete.firstName} ${userToDelete.lastName}`,
          email: userToDelete.email
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting user'
    });
  }
});

module.exports = router; 