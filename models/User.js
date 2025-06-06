const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters long'],
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters long'],
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please provide a valid email address'
    ]
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in queries by default
  },
  grade: {
    type: String,
    required: [true, 'Grade level is required'],
    enum: {
      values: ['6', '7', '8', '9', '10', '11', '12'],
      message: 'Grade must be between 6 and 12'
    }
  },
  role: {
    type: String,
    enum: ['student', 'admin'],
    default: 'student'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: null
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  // Test progress and statistics
  testProgress: {
    shsat: {
      testsCompleted: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      bestScore: { type: Number, default: 0 },
      timeSpent: { type: Number, default: 0 }, // in minutes
      lastAttempt: { type: Date, default: null }
    },
    sat: {
      testsCompleted: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      bestScore: { type: Number, default: 0 },
      timeSpent: { type: Number, default: 0 },
      lastAttempt: { type: Date, default: null }
    },
    stateTest: {
      testsCompleted: { type: Number, default: 0 },
      averageScore: { type: Number, default: 0 },
      bestScore: { type: Number, default: 0 },
      timeSpent: { type: Number, default: 0 },
      lastAttempt: { type: Date, default: null }
    }
  },
  preferences: {
    language: {
      type: String,
      enum: ['en', 'zh'],
      default: 'en'
    },
    notifications: {
      email: { type: Boolean, default: true },
      progress: { type: Boolean, default: true }
    }
  }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.loginAttempts;
      delete ret.lockUntil;
      delete ret.__v;
      return ret;
    }
  }
});

// Indexes for better performance
userSchema.index({ createdAt: -1 });
userSchema.index({ lastLogin: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for account locked status
userSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

// Method to increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Method to reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Method to update last login
userSchema.methods.updateLastLogin = function() {
  return this.updateOne({
    $set: { lastLogin: new Date() }
  });
};

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find active users
userSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Method to get user stats
userSchema.methods.getStats = function() {
  // Calculate total tests
  const totalTests = this.testProgress.shsat.testsCompleted + 
                    this.testProgress.sat.testsCompleted + 
                    this.testProgress.stateTest.testsCompleted;
  
  // Calculate total time spent
  const totalTimeSpent = this.testProgress.shsat.timeSpent + 
                        this.testProgress.sat.timeSpent + 
                        this.testProgress.stateTest.timeSpent;
  
  // Calculate average score only from tests that have been taken
  let totalScore = 0;
  let testsWithScores = 0;
  
  if (this.testProgress.shsat.testsCompleted > 0) {
    totalScore += this.testProgress.shsat.averageScore;
    testsWithScores++;
  }
  if (this.testProgress.sat.testsCompleted > 0) {
    totalScore += this.testProgress.sat.averageScore;
    testsWithScores++;
  }
  if (this.testProgress.stateTest.testsCompleted > 0) {
    totalScore += this.testProgress.stateTest.averageScore;
    testsWithScores++;
  }
  
  const averageScore = testsWithScores > 0 ? Math.round(totalScore / testsWithScores) : 0;
  
  return {
    totalTests,
    totalTimeSpent,
    averageScore,
    joinDate: this.createdAt,
    lastActive: this.lastLogin,
    favoriteTest: this.getFavoriteTest()
  };
};

// Method to get favorite test type
userSchema.methods.getFavoriteTest = function() {
  const tests = [
    { name: 'SHSAT', completed: this.testProgress.shsat.testsCompleted },
    { name: 'SAT', completed: this.testProgress.sat.testsCompleted },
    { name: 'State Test', completed: this.testProgress.stateTest.testsCompleted }
  ];
  
  return tests.reduce((max, test) => 
    test.completed > max.completed ? test : max
  ).name;
};

module.exports = mongoose.model('User', userSchema); 