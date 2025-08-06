const logger = require('../utils/logger');
const config = require('../utils/config');
const passport = require('passport');
const { Strategy: SamlStrategy } = require('passport-saml');
const fs = require('fs');
const path = require('path');

// Load certificate
const certPath = path.join(__dirname, '../cert.pem');
let publicCert;
try {
  publicCert = fs.readFileSync(certPath, 'utf-8');
} catch (error) {
  logger.warn('SAML certificate not found, using dummy certificate for development');
  publicCert = '-----BEGIN CERTIFICATE-----\nDUMMY_CERTIFICATE\n-----END CERTIFICATE-----';
}

// Initialize SAML strategy
const samlStrategy = new SamlStrategy(
  {
    entryPoint: process.env.SAML_ENTRY_POINT || 'https://login.microsoftonline.com/common/saml2',
    issuer: process.env.SAML_ISSUER || 'http://localhost:4000',
    callbackUrl: process.env.SAML_CALLBACK_URL || 'http://localhost:4000/auth/sso/callback',
    logoutCallbackUrl: process.env.SAML_LOGOUT_CALLBACK_URL || 'http://localhost:4000/auth/sso/logout/callback',
    cert: publicCert,
    validateInResponseTo: false,
    requestIdExpirationPeriodMs: 28800000, // 8 hours
    acceptedClockSkewMs: -1,
  },
  (profile, done) => {
    try {
      // Extract user information from SAML profile
      const user = {
        id: profile.nameID || profile['http://schemas.microsoft.com/identity/claims/objectidentifier'],
        email: profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'] || 
               profile['http://schemas.microsoft.com/identity/claims/upn'],
        displayName: profile['http://schemas.microsoft.com/identity/claims/displayname'] ||
                    profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'],
        firstName: profile['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname'],
        lastName: profile['http://schemas.microsoft.com/identity/claims/surname'],
        groups: profile['http://schemas.microsoft.com/ws/2008/06/identity/claims/groups'] || []
      };

      // Determine role based on groups or email domain
      let role = 'DO'; // Default role
      if (user.groups && Array.isArray(user.groups)) {
        if (user.groups.some(group => group.toLowerCase().includes('admin') || group.toLowerCase().includes('sales'))) {
          role = 'ADMIN';
        }
      } else if (user.email) {
        // Fallback to email-based role assignment
        const emailLower = user.email.toLowerCase();
        if (emailLower.includes('admin') || emailLower.includes('sales') || emailLower.includes('manager')) {
          role = 'ADMIN';
        }
      }

      user.role = role;
      done(null, user);
    } catch (error) {
      logger.error('SAML profile processing error', error);
      done(error);
    }
  }
);

// Register SAML strategy with Passport
passport.use('saml', samlStrategy);

// Export for use in samlMetadata.js
exports.samlStrategy = samlStrategy;

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

// SSO Authentication Methods
exports.initiateSSO = (req, res, next) => {
  passport.authenticate('saml', { 
    failureRedirect: '/login',
    failureFlash: true 
  })(req, res, next);
};

exports.handleSSOCallback = (req, res, next) => {
  passport.authenticate('saml', { 
    failureRedirect: '/login',
    failureFlash: true 
  }, (err, user, info) => {
    if (err) {
      logger.error('SAML authentication error', err);
      return res.redirect('/login?error=auth_failed');
    }

    if (!user) {
      logger.warn('SAML authentication failed - no user returned');
      return res.redirect('/login?error=no_user');
    }

    try {
      // Set session data
      req.session.userId = user.id;
      req.session.authenticated = true;
      req.session.role = user.role;
      req.session.userEmail = user.email;
      req.session.displayName = user.displayName;

      logger.info('SSO login successful', {
        userId: user.id,
        email: user.email,
        role: user.role,
        ip: req.ip
      });

      // Redirect to frontend with success
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?login=success`);
    } catch (error) {
      logger.error('Session setup error after SSO', error);
      res.redirect('/login?error=session_error');
    }
  })(req, res, next);
};

exports.initiateSSOLogout = (req, res) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }

  const logoutUrl = samlStrategy.getLogoutUrl(req, {
    nameID: req.session.userId,
    nameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified'
  });

  res.redirect(logoutUrl);
};

exports.handleSSOLogoutCallback = (req, res) => {
  try {
    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        logger.error('Session destruction error during SSO logout', err);
      }

      logger.info('SSO logout successful', {
        ip: req.ip
      });

      // Redirect to frontend
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?logout=success`);
    });
  } catch (error) {
    logger.error('SSO logout callback error', error);
    res.redirect('/login?error=logout_error');
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
        email: req.session.userEmail,
        displayName: req.session.displayName,
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