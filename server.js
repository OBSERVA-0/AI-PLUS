const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const app = express();

// Enable gzip compression for all responses
// This typically reduces payload size by 60-80%
app.use(compression({
    level: 6,                  // Balanced compression level (1-9, 6 is default)
    threshold: 1024,           // Only compress responses > 1KB
    filter: (req, res) => {
        // Compress all text-based responses
        if (req.headers['x-no-compression']) {
            return false;
        }
        return compression.filter(req, res);
    }
}));

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false // We'll handle CSP in our HTML files
}));

// Rate limiting with reasonable production values
// Note: 1000 requests per 15 min allows for ~10 concurrent users per IP (schools/offices)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000,                 // 1000 requests per 15 minutes per IP (allows shared IPs like schools)
    standardHeaders: true,     // Return rate limit info in headers
    legacyHeaders: false,      // Disable X-RateLimit headers
    handler: function (req, res) {
        res.status(429).json({
            success: false,
            message: 'Too many requests from this IP, please try again later.'
        });
    },
    skip: (req) => {
        // Skip rate limiting for health checks
        return req.path === '/api/health';
    }
});
app.use('/api/', limiter);

// Auth rate limiting (more restrictive to prevent brute force)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,                   // 20 auth attempts per 15 minutes (login, signup, etc.)
    standardHeaders: true,
    legacyHeaders: false,
    handler: function (req, res) {
        res.status(429).json({
            success: false,
            message: 'Too many authentication attempts, please try again later.'
        });
    }
});

// CORS configuration
app.use(cors({
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        // Allow localhost and file:// for development
        if (origin.startsWith('http://localhost') || 
            origin.startsWith('http://127.0.0.1') || 
            origin.startsWith('file://')) {
            return callback(null, true);
        }
        
        // Allow production domain
        if (origin === 'https://ai-plus-education.onrender.com') {
            return callback(null, true);
        }
        
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the public directory with optimized caching
app.use(express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',              // Cache JS/CSS for 1 day (they're versioned by content)
    etag: true,                // Enable ETag for cache validation
    lastModified: true,        // Enable Last-Modified header
    immutable: false,          // Allow revalidation
    setHeaders: (res, filePath) => {
        // Set longer cache for immutable assets (fonts, images)
        if (filePath.match(/\.(woff2?|ttf|eot|ico|png|jpg|jpeg|gif|svg)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=2592000, immutable'); // 30 days
        }
    }
}));

// Serve HTML files from the root directory (shorter cache since they may change)
app.use(express.static(path.join(__dirname), {
    maxAge: '10m',             // Cache HTML for 10 minutes
    etag: true,
    lastModified: true,
    index: false               // Disable automatic serving of index.html
}));

// MongoDB connection with optimized pooling for production performance
const MONGODB_URI = process.env.MONGODB_URI;

mongoose.connect(MONGODB_URI, {
    // Connection pool settings for better concurrency
    maxPoolSize: 50,           // Maximum connections in pool (default: 100)
    minPoolSize: 10,           // Minimum connections to maintain
    maxIdleTimeMS: 30000,      // Close idle connections after 30 seconds
    serverSelectionTimeoutMS: 5000,  // Timeout for server selection
    socketTimeoutMS: 45000,    // Timeout for socket operations
    // Performance optimizations
    compressors: ['zlib'],     // Enable compression for network traffic
    retryWrites: true,         // Automatic retry on transient errors
    retryReads: true,
})
    .then(() => {
        console.log('✅ Connected to MongoDB successfully');
        console.log(`📊 Connection pool: 10-50 connections`);
    })
    .catch((error) => {
        console.error('❌ MongoDB connection error:', error);
        process.exit(1);
    });

// Handle MongoDB connection events
mongoose.connection.on('disconnected', () => {
    console.log('📴 MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
    console.log('🔄 MongoDB reconnected');
});

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const questionRoutes = require('./routes/questions');
const adminRoutes = require('./routes/admin');

// API routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

// Handle all other routes - serve index.html for client-side routing
app.get('*', (req, res) => {
    // If it's an API route that wasn't caught by previous handlers, return 404
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: 'API endpoint not found'
        });
    }
    
    // For all other routes, serve the appropriate HTML file
    if (req.path === '/login' || req.path === '/login.html') {
        res.sendFile(path.join(__dirname, 'login.html'));
    } else if (req.path === '/dashboard' || req.path === '/dashboard.html') {
        res.sendFile(path.join(__dirname, 'dashboard.html'));
    } else if (req.path === '/profile' || req.path === '/profile.html') {
        res.sendFile(path.join(__dirname, 'profile.html'));
    } else if (req.path === '/admin' || req.path === '/admin.html') {
        res.sendFile(path.join(__dirname, 'admin.html'));
    } else {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// Global error handler
app.use((error, req, res, next) => {
    console.error('❌ Error:', error);
    
    // Don't leak error details in production
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    res.status(error.status || 500).json({
        success: false,
        message: error.message || 'Internal server error',
        ...(isDevelopment && { stack: error.stack })
    });
});

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    
    try {
        await mongoose.connection.close();
        console.log('📴 MongoDB connection closed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
});

const PORT = process.env.PORT;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Local: http://localhost:${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
}); 