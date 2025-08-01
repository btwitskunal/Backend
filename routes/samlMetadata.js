const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { Strategy: SamlStrategy } = require('passport-saml');
require('dotenv').config();

// Load certificate
const certPath = path.join(__dirname, '../cert.pem');
const publicCert = fs.readFileSync(certPath, 'utf-8');

// Initialize SAML strategy
const samlStrategy = new SamlStrategy(
  {
    entryPoint: process.env.SAML_ENTRY_POINT,
    issuer: process.env.SAML_ISSUER,
    callbackUrl: process.env.SAML_CALLBACK_URL,
    logoutCallbackUrl: process.env.SAML_LOGOUT_CALLBACK_URL,
    cert: publicCert,
  },
  (profile, done) => done(null, profile)
);

// ✅ Route to generate and serve SAML metadata
router.get('/metadata', (req, res) => {
  try {
    const metadata = samlStrategy.generateServiceProviderMetadata(publicCert, null);
    res.type('application/xml');
    res.send(metadata);
  } catch (err) {
    console.error('Metadata generation failed:', err);
    res.status(500).send('Failed to generate SAML metadata');
  }
});

module.exports = router;
