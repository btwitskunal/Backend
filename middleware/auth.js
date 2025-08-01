const session = require('express-session');
const config = require('../utils/config');
const logger = require('../utils/logger');

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

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.userId) {
    logger.logSecurityEvent('unauthorized_access', {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path
    });
    return res.status(401).json({ 
      error: 'Authentication required',
      code: 'UNAUTHORIZED'
    });
  }
  next();
};

// Role-based authorization middleware
const requireRole = (role) => (req, res, next) => {
  if (!req.session || !req.session.role) {
    return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
  }
  if (req.session.role !== role) {
    return res.status(403).json({ error: 'Forbidden: insufficient role', code: 'FORBIDDEN' });
  }
  next();
};

// Allow any of the specified roles
const requireAnyRole = (roles) => (req, res, next) => {
  if (!req.session || !req.session.role) {
    return res.status(401).json({ error: 'Authentication required', code: 'UNAUTHORIZED' });
  }
  if (!roles.includes(req.session.role)) {
    return res.status(403).json({ error: 'Forbidden: insufficient role', code: 'FORBIDDEN' });
  }
  next();
};

// Rate limiting middleware
const rateLimit = require('express-rate-limit');

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 uploads per windowMs
  message: {
    error: 'Too many upload requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.logSecurityEvent('rate_limit_exceeded', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });
    res.status(429).json({
      error: 'Too many upload requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED'
    });
  }
});

// CSRF protection middleware
const csrf = require('csurf');
const csrfProtection = csrf({ 
  cookie: {
    httpOnly: true,
    secure: config.server.nodeEnv === 'production'
  }
});

// Input validation middleware
const validateUploadRequest = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      error: 'No file uploaded',
      code: 'NO_FILE'
    });
  }

  // Validate file type
  const { FileValidator } = require('../utils/validation');
  if (!FileValidator.validateFileType(req.file.originalname)) {
    logger.logSecurityEvent('invalid_file_type', {
      filename: req.file.originalname,
      ip: req.ip
    });
    return res.status(400).json({
      error: 'Invalid file type. Only Excel files (.xlsx, .xls) are allowed.',
      code: 'INVALID_FILE_TYPE'
    });
  }

  // Validate file size
  if (!FileValidator.validateFileSize(req.file.size)) {
    logger.logSecurityEvent('file_too_large', {
      filename: req.file.originalname,
      size: req.file.size,
      ip: req.ip
    });
    return res.status(400).json({
      error: `File size exceeds maximum allowed size of ${config.upload.maxFileSize} bytes`,
      code: 'FILE_TOO_LARGE'
    });
  }

  // Validate filename
  if (!FileValidator.validateFileName(req.file.originalname)) {
    logger.logSecurityEvent('invalid_filename', {
      filename: req.file.originalname,
      ip: req.ip
    });
    return res.status(400).json({
      error: 'Invalid filename',
      code: 'INVALID_FILENAME'
    });
  }

  next();
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  logger.error('Request error', err, {
    path: req.path,
    method: req.method,
    ip: req.ip
  });

  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).json({
      error: 'CSRF token validation failed',
      code: 'CSRF_ERROR'
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    code: 'INTERNAL_ERROR'
  });
};

module.exports = {
  sessionConfig,
  requireAuth,
  requireRole,
  requireAnyRole,
  uploadLimiter,
  csrfProtection,
  validateUploadRequest,
  errorHandler
}; 