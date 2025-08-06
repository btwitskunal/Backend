const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Environment variable validation
const requiredEnvVars = [
  'DB_HOST',
  'DB_USER', 
  'DB_PASSWORD',
  'DB_NAME',
  'PORT',
  'SAML_ENTRY_POINT',
  'SAML_ISSUER',
  'SAML_CALLBACK_URL',
  'SAML_LOGOUT_CALLBACK_URL',
  'SESSION_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error('Missing required environment variables:', missingVars.join(', '));
  process.exit(1);
}

// Configuration object
const config = {
  database: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 0
  },
  server: {
    port: parseInt(process.env.PORT) || 4000,
    nodeEnv: process.env.NODE_ENV || 'development'
  },
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    allowedFileTypes: ['.xlsx', '.xls'],
    uploadsDir: process.env.UPLOADS_DIR || 'uploads',
    reportsDir: process.env.REPORTS_DIR || 'reports'
  },
  security: {
    sessionSecret: process.env.SESSION_SECRET || 'your-secret-key-change-in-production',
    jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-change-in-production',
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 12
  }
};

module.exports = config; 