const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth, sendTokenResponse } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const validateSignup = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long'),
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error('Password confirmation does not match password');
      }
      return true;
    }),
  body('grade')
    .isIn(['6', '7', '8', '9', '10', '11', '12'])
    .withMessage('Grade must be between 6 and 12')
];

const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .exists()
    .withMessage('Password is required')
];

const validateEmail = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address')
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

// @route   POST /api/auth/signup
// @desc    Register a new user
// @access  Public
router.post('/signup', validateSignup, handleValidationErrors, async (req, res) => {
  try {
    const { firstName, lastName, email, password, grade } = req.body;

    console.log('📝 Signup attempt for:', email);

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }

    // Create new user
    const user = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email,
      password,
      grade
    });

    await user.save();

    console.log('✅ User created successfully:', user.email);

    // Send token response
    sendTokenResponse(user, 201, res, 'Account created successfully');

  } catch (error) {
    console.error('❌ Signup error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Error creating account. Please try again.'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user and get token
// @access  Public
router.post('/login', validateLogin, handleValidationErrors, async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 Login attempt for:', email);

    // Find user and include password field
    const user = await User.findByEmail(email).select('+password +loginAttempts +lockUntil');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      return res.status(423).json({
        success: false,
        message: 'Account is temporarily locked due to too many failed login attempts. Please try again later.'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Validate password
    const isMatch = await user.comparePassword(password);
    
    if (!isMatch) {
      // Increment login attempts
      await user.incLoginAttempts();
      
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Reset login attempts on successful login
    if (user.loginAttempts && user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }

    // Update last login
    await user.updateLastLogin();

    console.log('✅ Login successful for:', user.email);

    // Send token response
    sendTokenResponse(user, 200, res, 'Login successful');

  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login. Please try again.'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', auth, async (req, res) => {
  try {
    console.log('👋 Logout for user:', req.user.email);
    
    // In a more complex system, you might want to:
    // - Add token to a blacklist
    // - Store logout time
    // - Clean up any session data
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('❌ Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during logout'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user info
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    res.json({
      success: true,
      data: {
        user: {
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
          createdAt: user.createdAt,
          lastLogin: user.lastLogin
        }
      }
    });
  } catch (error) {
    console.error('❌ Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user information'
    });
  }
});

// @route   POST /api/auth/verify-email
// @desc    Verify email address (placeholder)
// @access  Private
router.post('/verify-email', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (user.emailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email is already verified'
      });
    }

    // In production, you would:
    // 1. Generate verification token
    // 2. Send verification email
    // 3. Implement verification endpoint

    res.json({
      success: true,
      message: 'Verification email sent'
    });

  } catch (error) {
    console.error('❌ Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error sending verification email'
    });
  }
});

// @route   POST /api/auth/forgot-password
// @desc    Request password reset (placeholder - would send email in production)
// @access  Public
router.post('/forgot-password', validateEmail, handleValidationErrors, async (req, res) => {
  try {
    const { email } = req.body;

    console.log('📧 Password reset request for:', email);

    const user = await User.findByEmail(email);
    
    // Don't reveal if user exists or not for security
    res.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.'
    });

    // In production, you would:
    // 1. Generate a secure reset token
    // 2. Store it in the database with expiration
    // 3. Send email with reset link
    // 4. Implement reset password endpoint

  } catch (error) {
    console.error('❌ Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing password reset request'
    });
  }
});

// @route   POST /api/auth/verify-security-questions
// @desc    Verify security questions answers
// @access  Public
router.post('/verify-security-questions', async (req, res) => {
  try {
    const { email, answers } = req.body;
    
    if (!email || !answers || !answers.question1 || !answers.question2) {
      return res.status(400).json({
        success: false,
        message: 'Email and security question answers are required'
      });
    }
    
    console.log('🔐 Verifying security questions for:', email);
    
    // Get user with security answers
    const user = await User.findByEmail(email).select('+securityQuestions.question1.answer +securityQuestions.question2.answer');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Compare answers (case-insensitive)
    const isQuestion1Correct = user.securityQuestions.question1.answer.toLowerCase() === answers.question1.toLowerCase();
    const isQuestion2Correct = user.securityQuestions.question2.answer.toLowerCase() === answers.question2.toLowerCase();
    
    if (!isQuestion1Correct || !isQuestion2Correct) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect security answers'
      });
    }
    
    res.json({
      success: true,
      verified: true,
      message: 'Security questions verified successfully'
    });
  } catch (error) {
    console.error('❌ Security questions verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Error verifying security questions'
    });
  }
});

// @route   POST /api/auth/reset-password
// @desc    Reset password after security verification
// @access  Public
router.post('/reset-password', async (req, res) => {
  try {
    const { email, newPassword } = req.body;
    
    if (!email || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Email and new password are required'
      });
    }
    
    // Validate password
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long'
      });
    }
    
    console.log('🔄 Resetting password for:', email);
    
    // Get user
    const user = await User.findByEmail(email);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Update password
    user.password = newPassword;
    await user.save();
    
    // Reset login attempts if any
    if (user.loginAttempts && user.loginAttempts > 0) {
      await user.resetLoginAttempts();
    }
    
    console.log('✅ Password reset successful for:', email);
    
    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('❌ Password reset error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password'
    });
  }
});

// @route   POST /api/auth/refresh-token
// @desc    Refresh JWT token
// @access  Private
router.post('/refresh-token', auth, async (req, res) => {
  try {
    // Generate new token
    sendTokenResponse(req.user, 200, res, 'Token refreshed successfully');
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Error refreshing token'
    });
  }
});

// @route   GET /api/auth/check-email/:email
// @desc    Check if email is available
// @access  Public
router.get('/check-email/:email', async (req, res) => {
  try {
    const { email } = req.params;
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    const existingUser = await User.findByEmail(email);
    
    res.json({
      success: true,
      available: !existingUser,
      message: existingUser ? 'Email is already taken' : 'Email is available'
    });

  } catch (error) {
    console.error('❌ Email check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking email availability'
    });
  }
});

module.exports = router; 