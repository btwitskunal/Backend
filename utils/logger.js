const fs = require('fs');
const path = require('path');
const config = require('./config');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  getTimestamp() {
    return new Date().toISOString();
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = this.getTimestamp();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };
    return JSON.stringify(logEntry) + '\n';
  }

  writeToFile(filename, content) {
    const filePath = path.join(this.logDir, filename);
    fs.appendFileSync(filePath, content);
  }

  sanitizeError(error) {
    // Remove sensitive information from errors
    const sanitized = {
      message: error.message,
      stack: config.server.nodeEnv === 'development' ? error.stack : undefined,
      code: error.code
    };
    return sanitized;
  }

  info(message, meta = {}) {
    const logEntry = this.formatMessage('INFO', message, meta);
    console.log(`[INFO] ${message}`);
    this.writeToFile('app.log', logEntry);
  }

  warn(message, meta = {}) {
    const logEntry = this.formatMessage('WARN', message, meta);
    console.warn(`[WARN] ${message}`);
    this.writeToFile('app.log', logEntry);
  }

  error(message, error = null, meta = {}) {
    const sanitizedError = error ? this.sanitizeError(error) : null;
    const logEntry = this.formatMessage('ERROR', message, {
      ...meta,
      error: sanitizedError
    });
    console.error(`[ERROR] ${message}`);
    this.writeToFile('error.log', logEntry);
  }

  debug(message, meta = {}) {
    if (config.server.nodeEnv === 'development') {
      const logEntry = this.formatMessage('DEBUG', message, meta);
      console.debug(`[DEBUG] ${message}`);
      this.writeToFile('debug.log', logEntry);
    }
  }

  // Specific logging methods for different operations
  logFileUpload(filename, fileSize, userId = null) {
    this.info('File upload initiated', {
      filename,
      fileSize,
      userId,
      operation: 'file_upload'
    });
  }

  logFileValidation(filename, isValid, errors = []) {
    this.info('File validation completed', {
      filename,
      isValid,
      errorCount: errors.length,
      operation: 'file_validation'
    });
  }

  logDatabaseOperation(operation, table, rowCount, duration) {
    this.info('Database operation completed', {
      operation,
      table,
      rowCount,
      duration,
      operation: 'database_operation'
    });
  }

  logValidationError(filename, rowNumber, columnName, errorMessage) {
    this.warn('Data validation error', {
      filename,
      rowNumber,
      columnName,
      errorMessage,
      operation: 'data_validation'
    });
  }

  logSecurityEvent(event, details) {
    this.warn('Security event detected', {
      event,
      details,
      operation: 'security_event'
    });
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger; 