const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();
const uploadController = require('../controllers/uploadController');
const { 
  requireAuth, 
  requireRole, 
  uploadLimiter, 
  csrfProtection, 
  validateUploadRequest 
} = require('../middleware/auth');
const config = require('../utils/config');

// Configure multer with security settings
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, config.upload.uploadsDir);
  },
  filename: function (req, file, cb) {
    // Generate safe filename with timestamp
    const timestamp = Date.now();
    const safeName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    const ext = path.extname(safeName);
    const name = path.basename(safeName, ext);
    const sanitizedName = name.replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${timestamp}-${sanitizedName}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  // Additional file type validation
  const allowedTypes = config.upload.allowedFileTypes;
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (!allowedTypes.includes(ext)) {
    return cb(new Error('Invalid file type. Only Excel files are allowed.'), false);
  }
  
  cb(null, true);
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: config.upload.maxFileSize,
    files: 1 // Only allow one file per request
  }
});

// Apply security middleware to upload route
router.post('/', 
  requireAuth,           // Require authentication
  requireRole('DO'),     // Only DO can upload
  uploadLimiter,        // Rate limiting
  csrfProtection,       // CSRF protection
  upload.single('file'), // File upload
  validateUploadRequest, // Additional validation
  uploadController.uploadFile
);

module.exports = router;