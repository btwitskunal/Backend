
require('dotenv').config();
const config = require('./utils/config');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const logger = require('./utils/logger');
const { testConnection } = require('./utils/db');
const passport = require('passport');

const uploadRoutes = require('./routes/upload');
const templateRoutes = require('./routes/template');
const samlMetadataRoutes = require('./routes/samlMetadata');
const { syncDataTableSchema } = require('./utils/templateManager');
const session = require('express-session');
const { errorHandler, requireAuth, requireAnyRole } = require('./middleware/auth');
const customerRoutes = require('./routes/customer');

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

const app = express();

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport session configuration
passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// Ensure required directories exist
const uploadsDir = path.join(__dirname, config.upload.uploadsDir);
const reportsDir = path.join(__dirname, config.upload.reportsDir);

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  logger.info('Created uploads directory', { path: uploadsDir });
}

if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
  logger.info('Created reports directory', { path: reportsDir });
}

// Test database connection on startup
async function initializeDatabase() {
  try {
    const isConnected = await testConnection();
    if (!isConnected) {
      logger.error('Database connection failed during startup');
      process.exit(1);
    }

    // Sync DB schema
    await syncDataTableSchema();
    logger.info('Database schema synchronized with template.xlsx');
  } catch (err) {
    logger.error('Failed to initialize database', err);
    process.exit(1);
  }
}

// Initialize database
initializeDatabase();

// Watch template for changes
const TEMPLATE_FILE_PATH = path.join(__dirname, 'template.xlsx');
fs.watchFile(TEMPLATE_FILE_PATH, { interval: 1000 }, (curr, prev) => {
  if (curr.mtime !== prev.mtime) {
    logger.info('Template file changed, syncing database schema');
    syncDataTableSchema()
      .then(() => logger.info('Database schema synchronized with updated template.xlsx'))
      .catch(err => logger.error('Failed to synchronize database schema', err));
  }
});

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

// Serve static files with security
app.use('/reports', requireAuth, requireAnyRole(['DO', 'ADMIN']), express.static(reportsDir, {
  setHeaders: (res, path) => {
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
}));

// Routes
app.use('/auth', require('./routes/auth'));
app.use('/upload', uploadRoutes);
app.use('/api/template', templateRoutes); // Changed from '/template' to '/api/template'
app.use('/saml', samlMetadataRoutes);
app.use('/api/customers', customerRoutes);

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
    message: 'Excel Upload API Server',
    version: '1.0.0',
    environment: config.server.nodeEnv
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

// Global error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Unhandled promise rejection handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

const PORT = config.server.port;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`, {
    environment: config.server.nodeEnv,
    port: PORT
  });
});
