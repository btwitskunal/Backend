const logger = require('../utils/logger');
const config = require('../utils/config');

// Simple authentication controller for testing
// In production, you would integrate with your actual authentication system

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Basic validation
    if (!username || !password) {
      return res.status(400).json({
        error: 'Username and password are required',
        code: 'MISSING_CREDENTIALS'
      });
    }

    // For testing purposes, accept any valid credentials
    // In production, validate against your user database
    if (username && password) {
      // Set session
      req.session.userId = username;
      req.session.authenticated = true;
      // Assign role based on username for demo
      let role = 'DO';
      if (username.toLowerCase() === 'admin' || username.toLowerCase() === 'sales') {
        role = 'ADMIN';
      }
      req.session.role = role;
      
      logger.info('User logged in successfully', {
        username,
        role,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Login successful',
        user: { username, role }
      });
    } else {
      logger.warn('Failed login attempt', {
        username,
        ip: req.ip
      });

      res.status(401).json({
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS'
      });
    }
  } catch (error) {
    logger.error('Login error', error);
    res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const username = req.session?.userId;
    
    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        logger.error('Session destruction error', err);
        return res.status(500).json({
          error: 'Logout failed',
          code: 'LOGOUT_ERROR'
        });
      }

      logger.info('User logged out', {
        username,
        ip: req.ip
      });

      res.json({
        success: true,
        message: 'Logout successful'
      });
    });
  } catch (error) {
    logger.error('Logout error', error);
    res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
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
        authenticated: req.session.authenticated,
        role: req.session.role || 'DO'
      }
    });
  } catch (error) {
    logger.error('Profile retrieval error', error);
    res.status(500).json({
      error: 'Failed to get profile',
      code: 'PROFILE_ERROR'
    });
  }
}; 