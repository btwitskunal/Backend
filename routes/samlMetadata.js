const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { samlStrategy } = require('../controllers/authController');

// Load certificate with try-catch
const certPath = path.join(__dirname, '../cert.pem');
let publicCert;
try {
  publicCert = fs.readFileSync(certPath, 'utf-8');
} catch (err) {
  console.error('Certificate file missing:', err);
  publicCert = null;
}

// Route to generate and serve SAML metadata
router.get('/metadata', (req, res) => {
  try {
    if (!publicCert) throw new Error('Certificate not loaded');
    const metadata = samlStrategy.generateServiceProviderMetadata(publicCert, null);
    res.type('application/xml');
    res.send(metadata);
  } catch (err) {
    console.error('Metadata generation failed:', err);
    res.status(500).send('Failed to generate SAML metadata');
  }
});

module.exports = router;
