# AI Plus Education - Backend Authentication System

A complete full-stack authentication system for the AI Plus Education platform, built with Node.js, Express, MongoDB, and JWT tokens.

## 🚀 Features

### Authentication
- ✅ User registration with validation
- ✅ Secure login with JWT tokens
- ✅ Password hashing with bcrypt
- ✅ Account lockout after failed attempts
- ✅ Email availability checking
- ✅ Session management

### Security
- ✅ Rate limiting for API endpoints
- ✅ CORS configuration
- ✅ Helmet security headers
- ✅ Input validation and sanitization
- ✅ SQL injection protection (NoSQL)
- ✅ Password strength validation

### User Management
- ✅ User profiles with test progress tracking
- ✅ Preferences management (language, notifications)
- ✅ Test statistics and progress
- ✅ Account deactivation
- ✅ Admin panel functionality

### Frontend Integration
- ✅ Bilingual support (English/Chinese)
- ✅ Real-time form validation
- ✅ Responsive design
- ✅ Error handling and user feedback
- ✅ Smooth animations and transitions

## 🛠️ Tech Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM for MongoDB
- **JWT** - Authentication tokens
- **bcryptjs** - Password hashing
- **express-validator** - Input validation
- **cors** - Cross-origin resource sharing
- **helmet** - Security headers
- **express-rate-limit** - Rate limiting

### Frontend
- **HTML5** - Markup
- **CSS3** - Styling with modern features
- **JavaScript (ES6+)** - Client-side logic
- **Fetch API** - HTTP requests
- **Local Storage** - Client-side storage

## 📋 Prerequisites

Before running this application, make sure you have:

- **Node.js** (version 16 or higher)
- **MongoDB** (running locally or remote connection)
- **npm** or **yarn** package manager

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd ai-plus-education
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Create a `.env` file in the root directory:
```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/AI-PLUS-EDUCATION

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d

# Security Configuration
BCRYPT_ROUNDS=12
```

### 4. Start MongoDB
Make sure MongoDB is running on your system:
```bash
# On macOS with Homebrew
brew services start mongodb/brew/mongodb-community

# On Ubuntu/Debian
sudo systemctl start mongod

# On Windows
net start MongoDB
```

### 5. Run the Application
```bash
# Development mode with auto-reload
npm run dev

# Or production mode
npm start
```

### 6. Access the Application
- **Website**: http://localhost:3000
- **Login Page**: http://localhost:3000/login
- **API Health Check**: http://localhost:3000/api/health

## 📡 API Endpoints

### Authentication Endpoints
```
POST   /api/auth/signup          - Register new user
POST   /api/auth/login           - User login
POST   /api/auth/logout          - User logout
GET    /api/auth/me              - Get current user
POST   /api/auth/refresh-token   - Refresh JWT token
POST   /api/auth/forgot-password - Request password reset
GET    /api/auth/check-email/:email - Check email availability
```

### User Management Endpoints
```
GET    /api/user/profile         - Get user profile
PUT    /api/user/profile         - Update user profile
PUT    /api/user/password        - Update password
PUT    /api/user/preferences     - Update preferences
GET    /api/user/stats           - Get user statistics
POST   /api/user/test-result     - Record test result
DELETE /api/user/account         - Deactivate account
```

### Admin Endpoints
```
GET    /api/user/admin/users     - Get all users (admin only)
GET    /api/user/admin/stats     - Get platform stats (admin only)
```

## 🗄️ Database Schema

### User Model
```javascript
{
  firstName: String,
  lastName: String,
  email: String (unique),
  password: String (hashed),
  grade: String (6-12),
  role: String (student/admin),
  isActive: Boolean,
  emailVerified: Boolean,
  lastLogin: Date,
  loginAttempts: Number,
  lockUntil: Date,
  testProgress: {
    shsat: { testsCompleted, averageScore, bestScore, timeSpent, lastAttempt },
    sat: { testsCompleted, averageScore, bestScore, timeSpent, lastAttempt },
    stateTest: { testsCompleted, averageScore, bestScore, timeSpent, lastAttempt }
  },
  preferences: {
    language: String (en/zh),
    notifications: { email: Boolean, progress: Boolean }
  },
  createdAt: Date,
  updatedAt: Date
}
```

## 🔒 Security Features

### Authentication Security
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens with expiration
- Account lockout after 5 failed login attempts
- Rate limiting on auth endpoints (5 requests per 15 minutes)

### API Security
- CORS configuration for cross-origin requests
- Helmet for security headers
- Input validation and sanitization
- NoSQL injection protection
- Request size limits

### Frontend Security
- XSS protection through input validation
- CSRF protection via SameSite cookies
- Secure token storage in localStorage
- Input sanitization before API calls

## 🎨 Frontend Features

### Responsive Design
- Mobile-first approach
- Tablet and desktop optimized
- Touch-friendly interface
- Smooth animations and transitions

### User Experience
- Real-time form validation
- Password strength indicators
- Loading states and feedback
- Error handling with user-friendly messages
- Bilingual support (English/Chinese)

### Form Features
- Email availability checking
- Password visibility toggle
- Remember me functionality
- Terms of service agreement
- Grade level selection

## 🧪 Testing the System

### Manual Testing Steps

1. **Registration Flow**
   ```bash
   # Navigate to login page
   http://localhost:3000/login
   
   # Click "Sign Up" to switch to registration
   # Fill out the form with valid data
   # Submit and verify account creation
   ```

2. **Login Flow**
   ```bash
   # Use credentials from registration
   # Test "Remember me" functionality
   # Verify successful login and redirection
   ```

3. **API Testing with curl**
   ```bash
   # Test user registration
   curl -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{
       "firstName": "John",
       "lastName": "Doe",
       "email": "john@example.com",
       "password": "Password123",
       "confirmPassword": "Password123",
       "grade": "10"
     }'
   
   # Test user login
   curl -X POST http://localhost:3000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{
       "email": "john@example.com",
       "password": "Password123"
     }'
   ```

## 🚨 Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   ```
   Error: MongoDB connection failed
   ```
   - Ensure MongoDB is running
   - Check the connection string in .env
   - Verify network connectivity

2. **Port Already in Use**
   ```
   Error: listen EADDRINUSE: address already in use :::3000
   ```
   - Change PORT in .env file
   - Or kill the process using the port:
     ```bash
     # Find process using port 3000
     lsof -i :3000
     # Kill the process
     kill -9 <PID>
     ```

3. **CORS Errors**
   ```
   Access to fetch at 'http://localhost:3000/api/auth/login' blocked by CORS
   ```
   - Ensure frontend is served from allowed origin
   - Check CORS configuration in server.js

### Environment Variables Issues

1. Create `.env` file if missing
2. Verify all required variables are set
3. Restart server after changing .env

## 📈 Performance Considerations

### Database Optimization
- Indexes on email, createdAt, and lastLogin fields
- Connection pooling with Mongoose
- Query optimization for user lookups

### API Optimization
- Rate limiting to prevent abuse
- Request compression with gzip
- Efficient JWT token validation
- Minimal data transfer in responses

### Frontend Optimization
- Lazy loading of form validation
- Debounced email availability checking
- Efficient DOM manipulation
- Minimal API calls

## 🔄 Development Workflow

### File Structure
```
├── server.js              # Main server file
├── package.json           # Dependencies and scripts
├── models/
│   └── User.js            # User database model
├── routes/
│   ├── auth.js            # Authentication routes
│   └── user.js            # User management routes
├── middleware/
│   └── auth.js            # Authentication middleware
├── index.html             # Main landing page
├── login.html             # Login/signup page
├── styles.css             # Main page styles
├── login-styles.css       # Login page styles
├── script.js              # Main page JavaScript
├── login-script.js        # Login page JavaScript
└── README.md              # This file
```

### Development Scripts
```bash
# Start with auto-reload
npm run dev

# Start production server
npm start

# Install dependencies
npm install

# Check for security vulnerabilities
npm audit
```

## 🚀 Deployment

### Production Environment Variables
```env
NODE_ENV=production
PORT=80
MONGODB_URI=mongodb://your-production-db-url/AI-PLUS-EDUCATION
JWT_SECRET=your-very-long-and-random-production-secret
JWT_EXPIRE=7d
```

### Security Checklist for Production
- [ ] Change default JWT secret
- [ ] Use HTTPS in production
- [ ] Set up proper CORS origins
- [ ] Configure MongoDB authentication
- [ ] Set up SSL certificates
- [ ] Enable MongoDB replica sets
- [ ] Configure proper logging
- [ ] Set up monitoring and alerting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues or have questions:

1. Check the troubleshooting section above
2. Review the API documentation
3. Check the console for error messages
4. Create an issue in the repository

---

**Happy coding! 🎉** 