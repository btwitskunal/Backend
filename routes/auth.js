const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

// Public routes
router.post('/login', authController.login);
router.get('/sso', authController.initiateSSO);
router.post('/sso/callback', authController.handleSSOCallback);
router.get('/sso/logout', authController.initiateSSOLogout);
router.post('/sso/logout/callback', authController.handleSSOLogoutCallback);

// Protected routes
router.post('/logout', requireAuth, authController.logout);
router.get('/profile', requireAuth, authController.getProfile);

module.exports = router; 