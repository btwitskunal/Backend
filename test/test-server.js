require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const config = require('./utils/config');
const logger = require('./utils/logger');

const app = express();

// Session configuration
const sessionConfig = {
  secret: config.security.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: config.server.nodeEnv === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
};

// Security middleware
app.use(cors({ 
  origin: config.server.nodeEnv === 'production' ? process.env.ALLOWED_ORIGINS?.split(',') : true, 
  credentials: true 
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Session middleware
app.use(session(sessionConfig));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    environment: config.server.nodeEnv
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Excel Upload API Server (Test Mode)',
    version: '1.0.0',
    environment: config.server.nodeEnv
  });
});

// Simple auth endpoints for testing
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username && password) {
    req.session.userId = username;
    req.session.authenticated = true;
    
    logger.info('User logged in successfully', { username, ip: req.ip });
    
    res.json({
      success: true,
      message: 'Login successful',
      user: { username }
    });
  } else {
    res.status(401).json({
      error: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS'
    });
  }
});

app.get('/auth/profile', (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({
      error: 'Not authenticated',
      code: 'NOT_AUTHENTICATED'
    });
  }

  res.json({
    success: true,
    user: {
      username: req.session.userId,
      authenticated: req.session.authenticated
    }
  });
});

// Protected endpoint for testing
app.post('/upload', (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }

  res.json({
    success: true,
    message: 'Upload endpoint protected (test mode)',
    authenticated: true
  });
});

// 404 handler
app.use((req, res) => {
  logger.warn('Route not found', { 
    path: req.path, 
    method: req.method,
    ip: req.ip 
  });
  res.status(404).json({ 
    error: 'Route not found',
    code: 'NOT_FOUND'
  });
});

const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`Test server running on port ${PORT}`, {
    environment: config.server.nodeEnv,
    port: PORT
  });
  console.log(`🚀 Test server running on http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
}); 