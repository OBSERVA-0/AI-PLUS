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

### User Model

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

