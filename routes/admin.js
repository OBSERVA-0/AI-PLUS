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

// @route   GET /api/admin/students/test-scores
// @desc    Get students sorted by their scores for a specific test
// @access  Private (Admin only)
router.get('/students/test-scores', auth, requireAdmin, async (req, res) => {
  try {
    const { testType, practiceSet, page = 1, limit = 50 } = req.query;
    
    if (!testType || !practiceSet) {
      return res.status(400).json({
        success: false,
        message: 'testType and practiceSet are required'
      });
    }
    
         // Get all students with test history for the specific test
     const students = await User.find({
       role: 'student',
       'testHistory': {
         $elemMatch: {
           testType: testType,
           practiceSet: practiceSet
         }
       }
     }).select('firstName lastName email grade testHistory testProgress isActive');
    
         // Process students and extract their best score for this specific test
     const studentScores = students.map(student => {
       // Find all attempts for this specific test with scaled scores
       const testAttempts = student.testHistory.filter(test => 
         test.testType === testType && 
         test.practiceSet === practiceSet &&
         test.scaledScores && 
         test.scaledScores.total && 
         test.scaledScores.total > 0
       );
       
       // Skip students without any scaled score attempts
       if (testAttempts.length === 0) {
         return null;
       }
       
       // Get the best scaled score
       let bestScaledTotal = 0;
       let bestPercentage = 0;
       let latestAttempt = null;
       let totalAttempts = testAttempts.length;
       let bestScaledScore = null;
       let bestAttempt = null;
       
       testAttempts.forEach(attempt => {
         if (attempt.scaledScores.total > bestScaledTotal) {
           bestScaledTotal = attempt.scaledScores.total;
           bestPercentage = attempt.results.percentage;
           latestAttempt = attempt;
           bestAttempt = attempt;
           bestScaledScore = attempt.scaledScores;
         }
       });
      
             return {
         id: student._id,
         name: `${student.firstName} ${student.lastName}`,
         email: student.email,
         grade: student.grade,
         isActive: student.isActive,
         bestPercentage: bestPercentage,
         bestScaledTotal: bestScaledTotal,
         bestScaledScore: bestScaledScore,
         totalAttempts: totalAttempts,
         latestAttempt: latestAttempt ? {
           date: latestAttempt.completedAt,
           correctCount: latestAttempt.results.correctCount,
           totalQuestions: latestAttempt.results.totalQuestions,
           timeSpent: latestAttempt.results.timeSpent
         } : null,
         overallStats: {
           totalTests: student.testProgress.shsat.testsCompleted + 
                      student.testProgress.sat.testsCompleted + 
                      student.testProgress.stateTest.testsCompleted,
           averageScore: student.getStats().averageScore
         }
       };
         }).filter(student => student !== null); // Remove students without scaled scores
     
     // Sort by best scaled score (highest first)
     studentScores.sort((a, b) => b.bestScaledTotal - a.bestScaledTotal);
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedStudents = studentScores.slice(startIndex, endIndex);
    
    // Generate test name for display
    let testName = '';
    if (testType === 'shsat') {
      testName = practiceSet === 'Diagnostic_Test' 
        ? 'SHSAT Diagnostic Test' 
        : `SHSAT Practice Test ${practiceSet}`;
    } else if (testType === 'sat') {
      testName = `SAT Practice Test ${practiceSet}`;
    } else if (testType === 'state') {
      testName = `State Test Practice ${practiceSet}`;
    }
    
    res.json({
      success: true,
      data: {
        testInfo: {
          testType,
          practiceSet,
          testName
        },
        students: paginatedStudents,
        pagination: {
          current: parseInt(page),
          total: Math.ceil(studentScores.length / limit),
          count: paginatedStudents.length,
          totalStudents: studentScores.length
        },
                 summary: {
           totalStudentsWhoTook: studentScores.length,
           averageScaledScore: studentScores.length > 0 ? 
             Math.round(studentScores.reduce((sum, s) => sum + s.bestScaledTotal, 0) / studentScores.length) : 0,
           averagePercentage: studentScores.length > 0 ? 
             Math.round(studentScores.reduce((sum, s) => sum + s.bestPercentage, 0) / studentScores.length) : 0,
           highestScaledScore: studentScores.length > 0 ? studentScores[0].bestScaledTotal : 0,
           lowestScaledScore: studentScores.length > 0 ? studentScores[studentScores.length - 1].bestScaledTotal : 0
         }
      }
    });
    
  } catch (error) {
    console.error('❌ Get students test scores error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving students test scores'
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

// @route   GET /api/admin/question-analytics
// @desc    Get question breakdown analytics for all tests
// @access  Private (Admin only)
router.get('/question-analytics', auth, requireAdmin, async (req, res) => {
  try {
    console.log('📊 Admin requesting question analytics...');
    
    // Get all students with test history
    const students = await User.find({ 
      role: 'student',
      'testHistory.0': { $exists: true } // Only students with test history
    }).select('testHistory firstName lastName');
    
    console.log(`📊 Found ${students.length} students with test history`);
    
    // Group test results by testType and practiceSet
    const testGroups = new Map();
    
    students.forEach(student => {
      student.testHistory.forEach(test => {
        const testKey = `${test.testType}_${test.practiceSet}`;
        
        if (!testGroups.has(testKey)) {
          testGroups.set(testKey, {
            testType: test.testType,
            practiceSet: test.practiceSet,
            testName: test.testName,
            attempts: [],
            questions: new Map(), // Map of questionNumber -> { total: N, correct: N }
            categories: new Set() // Track all categories in this test
          });
        }
        
        const testGroup = testGroups.get(testKey);
        testGroup.attempts.push({
          studentId: student._id,
          studentName: `${student.firstName} ${student.lastName}`,
          completedAt: test.completedAt,
          results: test.results
        });
        
        // Process detailed results for question analytics
        if (test.detailedResults && test.detailedResults.length > 0) {
          test.detailedResults.forEach(questionResult => {
            const questionNum = questionResult.questionNumber;
            
            // Normalize category name - handle different formats
            let normalizedCategory = questionResult.category || 'Unknown';
            // Add to categories set
            testGroup.categories.add(normalizedCategory);
            
            if (!testGroup.questions.has(questionNum)) {
              testGroup.questions.set(questionNum, {
                questionNumber: questionNum,
                category: normalizedCategory,
                totalAttempts: 0,
                correctAnswers: 0,
                incorrectAnswers: 0,
                skippedAnswers: 0,
                percentage: 0
              });
            }
            
            const questionData = testGroup.questions.get(questionNum);
            questionData.totalAttempts++;
            
            // Handle different answer types
            if (!questionResult.hasAnswer) {
              questionData.skippedAnswers++;
            } else if (questionResult.isCorrect) {
              questionData.correctAnswers++;
            } else {
              questionData.incorrectAnswers++;
            }
            
            // Update percentage
            questionData.percentage = Math.round((questionData.correctAnswers / questionData.totalAttempts) * 100);
          });
        }
      });
    });
    
    // Convert to response format
    const testAnalytics = Array.from(testGroups.values()).map(testGroup => {
      // Convert questions Map to sorted array
      const questions = Array.from(testGroup.questions.values())
        .sort((a, b) => a.questionNumber - b.questionNumber);
      
      // Calculate overall test statistics
      const totalQuestions = questions.length;
      const averageAccuracy = totalQuestions > 0 ? 
        Math.round(questions.reduce((sum, q) => sum + q.percentage, 0) / totalQuestions) : 0;
      
      // Find hardest and easiest questions
      const sortedByDifficulty = [...questions].sort((a, b) => a.percentage - b.percentage);
      const hardestQuestion = sortedByDifficulty[0];
      const easiestQuestion = sortedByDifficulty[sortedByDifficulty.length - 1];
      
      // Count category distribution
      const categoryStats = {};
      questions.forEach(q => {
        const mainCategory = q.category.split(':')[0]; // Get main category (English, Math, etc.)
        if (!categoryStats[mainCategory]) {
          categoryStats[mainCategory] = { count: 0, avgAccuracy: 0 };
        }
        categoryStats[mainCategory].count++;
      });
      
      // Calculate average accuracy per category
      Object.keys(categoryStats).forEach(category => {
        const categoryQuestions = questions.filter(q => q.category.startsWith(category));
        const totalAccuracy = categoryQuestions.reduce((sum, q) => sum + q.percentage, 0);
        categoryStats[category].avgAccuracy = Math.round(totalAccuracy / categoryQuestions.length);
      });
      
      return {
        testType: testGroup.testType,
        practiceSet: testGroup.practiceSet,
        testName: testGroup.testName,
        totalAttempts: testGroup.attempts.length,
        totalQuestions: totalQuestions,
        averageAccuracy: averageAccuracy,
        categoryStats: categoryStats,
        categories: Array.from(testGroup.categories),
        hardestQuestion: hardestQuestion ? {
          number: hardestQuestion.questionNumber,
          percentage: hardestQuestion.percentage,
          category: hardestQuestion.category
        } : null,
        easiestQuestion: easiestQuestion ? {
          number: easiestQuestion.questionNumber,
          percentage: easiestQuestion.percentage,
          category: easiestQuestion.category
        } : null,
        questions: questions
      };
    });
    
    // Sort by test type and practice set
    testAnalytics.sort((a, b) => {
      if (a.testType !== b.testType) {
        return a.testType.localeCompare(b.testType);
      }
      
      // Handle different practice set formats (numbers vs strings like "Diagnostic_Test")
      const aSet = a.practiceSet;
      const bSet = b.practiceSet;
      
      // If both are numbers, sort numerically
      if (!isNaN(aSet) && !isNaN(bSet)) {
        return parseInt(aSet) - parseInt(bSet);
      }
      
      // Otherwise sort alphabetically, but put "Diagnostic_Test" first
      if (aSet === 'Diagnostic_Test') return -1;
      if (bSet === 'Diagnostic_Test') return 1;
      
      return aSet.localeCompare(bSet);
    });
    
    console.log(`📊 Generated analytics for ${testAnalytics.length} test variants`);
    
    // Calculate summary statistics
    const allTestTypes = [...new Set(testAnalytics.map(t => t.testType))];
    const totalQuestions = testAnalytics.reduce((sum, test) => sum + test.totalQuestions, 0);
    const totalAttempts = testAnalytics.reduce((sum, test) => sum + test.totalAttempts, 0);
    
    res.json({
      success: true,
      data: {
        testAnalytics,
        summary: {
          totalTests: testAnalytics.length,
          totalStudents: students.length,
          totalQuestions: totalQuestions,
          totalAttempts: totalAttempts,
          testTypes: allTestTypes,
          generatedAt: new Date()
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Get question analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving question analytics'
    });
  }
});

// @route   GET /api/admin/question-analytics/:testType/:practiceSet
// @desc    Get detailed question breakdown for a specific test
// @access  Private (Admin only)
router.get('/question-analytics/:testType/:practiceSet', auth, requireAdmin, async (req, res) => {
  try {
    const { testType, practiceSet } = req.params;
    
    console.log(`📊 Admin requesting detailed analytics for ${testType} - ${practiceSet}`);
    
    // Get all students who took this specific test
    const students = await User.find({
      role: 'student',
      'testHistory': {
        $elemMatch: {
          testType: testType,
          practiceSet: practiceSet
        }
      }
    }).select('testHistory firstName lastName email grade');
    
    console.log(`📊 Found ${students.length} students who took ${testType} - ${practiceSet}`);
    
    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No data found for this test'
      });
    }
    
    const questions = new Map();
    const studentAttempts = [];
    let testName = '';
    
    students.forEach(student => {
      const testAttempts = student.testHistory.filter(test => 
        test.testType === testType && test.practiceSet === practiceSet
      );
      
      testAttempts.forEach(test => {
        if (!testName) testName = test.testName;
        
        studentAttempts.push({
          studentId: student._id,
          studentName: `${student.firstName} ${student.lastName}`,
          studentEmail: student.email,
          studentGrade: student.grade,
          completedAt: test.completedAt,
          percentage: test.results.percentage,
          correctCount: test.results.correctCount,
          totalQuestions: test.results.totalQuestions,
          timeSpent: test.results.timeSpent
        });
        
        // Process detailed results
        if (test.detailedResults && test.detailedResults.length > 0) {
          test.detailedResults.forEach(questionResult => {
            const questionNum = questionResult.questionNumber;
            
            if (!questions.has(questionNum)) {
              questions.set(questionNum, {
                questionNumber: questionNum,
                category: questionResult.category,
                totalAttempts: 0,
                correctAnswers: 0,
                incorrectAnswers: 0,
                skippedAnswers: 0,
                percentage: 0,
                studentResponses: []
              });
            }
            
            const questionData = questions.get(questionNum);
            questionData.totalAttempts++;
            
            const studentResponse = {
              studentId: student._id,
              studentName: `${student.firstName} ${student.lastName}`,
              isCorrect: questionResult.isCorrect,
              hasAnswer: questionResult.hasAnswer,
              userAnswer: questionResult.userAnswer
            };
            
            questionData.studentResponses.push(studentResponse);
            
            if (!questionResult.hasAnswer) {
              questionData.skippedAnswers++;
            } else if (questionResult.isCorrect) {
              questionData.correctAnswers++;
            } else {
              questionData.incorrectAnswers++;
            }
            
            // Update percentage
            questionData.percentage = Math.round((questionData.correctAnswers / questionData.totalAttempts) * 100);
          });
        }
      });
    });
    
    // Convert to array and sort by question number
    const questionArray = Array.from(questions.values())
      .sort((a, b) => a.questionNumber - b.questionNumber);
    
    // Calculate overall statistics
    const totalQuestions = questionArray.length;
    const averageAccuracy = totalQuestions > 0 ? 
      Math.round(questionArray.reduce((sum, q) => sum + q.percentage, 0) / totalQuestions) : 0;
    
    // Sort student attempts by performance
    studentAttempts.sort((a, b) => b.percentage - a.percentage);
    
    res.json({
      success: true,
      data: {
        testInfo: {
          testType,
          practiceSet,
          testName,
          totalAttempts: studentAttempts.length,
          totalQuestions,
          averageAccuracy
        },
        questions: questionArray,
        studentAttempts,
        statistics: {
          averageScore: studentAttempts.length > 0 ? 
            Math.round(studentAttempts.reduce((sum, s) => sum + s.percentage, 0) / studentAttempts.length) : 0,
          highestScore: studentAttempts.length > 0 ? Math.max(...studentAttempts.map(s => s.percentage)) : 0,
          lowestScore: studentAttempts.length > 0 ? Math.min(...studentAttempts.map(s => s.percentage)) : 0,
          totalStudents: studentAttempts.length
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Get detailed question analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving detailed question analytics'
    });
  }
});

module.exports = router; 