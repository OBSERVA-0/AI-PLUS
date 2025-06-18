const express = require('express');
const User = require('../models/User');
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
    const categoryPerformance = student.getCategoryPerformance();
    
    res.json({
      success: true,
      data: {
        student: {
          id: student._id,
          firstName: student.firstName,
          lastName: student.lastName,
          fullName: student.fullName,
          email: student.email,
          grade: student.grade,
          joinDate: student.createdAt,
          lastLogin: student.lastLogin,
          isActive: student.isActive,
          stats: stats,
          testProgress: student.testProgress,
          masteryLevels: masterySummary,
          categoryPerformance: categoryPerformance
        }
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

module.exports = router; 