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
    
    console.log('Certificate loaded:', publicCert.substring(0, 100) + '...');
    
    // Clean the certificate (remove headers, footers, and whitespace)
    const cleanCert = publicCert.replace(/-----BEGIN CERTIFICATE-----|-----END CERTIFICATE-----|\s+/g, '');
    
    console.log('Clean certificate:', cleanCert.substring(0, 50) + '...');
    
    // Manually construct the metadata XML with certificate
    const metadata = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
 entityID="${process.env.SAML_ISSUER || 'http://localhost:4000'}" ID="http___localhost_4000">
  <SPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <KeyDescriptor use="signing">
      <ds:KeyInfo>
        <ds:X509Data>
          <ds:X509Certificate>${cleanCert}</ds:X509Certificate>
        </ds:X509Data>
      </ds:KeyInfo>
    </KeyDescriptor>
    <SingleLogoutService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${process.env.SAML_LOGOUT_CALLBACK_URL || 'http://localhost:4000/auth/sso/logout/callback'}"/>
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService index="1" isDefault="true" Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${process.env.SAML_CALLBACK_URL || 'http://localhost:4000/auth/sso/callback'}"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
    
    console.log('Generated metadata length:', metadata.length);
    console.log('Metadata contains certificate:', metadata.includes('<ds:X509Certificate>'));
    
    res.type('application/xml');
    res.send(metadata);
  } catch (err) {
    console.error('Metadata generation failed:', err);
    res.status(500).send('Failed to generate SAML metadata');
  }
});

module.exports = router;
