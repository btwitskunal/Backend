const path = require('path');
const fs = require('fs');
const config = require('./config');

// File validation utilities
class FileValidator {
  static validateFileType(filename) {
    const ext = path.extname(filename).toLowerCase();
    return config.upload.allowedFileTypes.includes(ext);
  }

  static validateFileSize(fileSize) {
    return fileSize <= config.upload.maxFileSize;
  }

  static validateFileName(filename) {
    // Prevent path traversal and ensure safe filenames
    const safeName = path.basename(filename);
    const allowedChars = /^[a-zA-Z0-9._-]+$/;
    return allowedChars.test(safeName) && safeName.length <= 255;
  }

  static async validateExcelFile(filePath) {
    try {
      // Basic file existence check
      if (!fs.existsSync(filePath)) {
        throw new Error('File does not exist');
      }

      // File size check
      const stats = fs.statSync(filePath);
      if (!this.validateFileSize(stats.size)) {
        throw new Error(`File size exceeds maximum allowed size of ${config.upload.maxFileSize} bytes`);
      }

      return true;
    } catch (error) {
      throw new Error(`File validation failed: ${error.message}`);
    }
  }
}

// Input sanitization utilities
class InputSanitizer {
  static sanitizeColumnName(columnName) {
    // Remove any potentially dangerous characters and limit length
    return columnName
      .replace(/[^a-zA-Z0-9_]/g, '')
      .substring(0, 64);
  }

  static sanitizeString(input) {
    if (typeof input !== 'string') return '';
    return input.trim().substring(0, 1000); // Limit length
  }

  static sanitizeNumber(input) {
    const num = parseFloat(input);
    return isNaN(num) ? null : num;
  }

  static sanitizeDate(input) {
    if (!input) return null;
    const date = new Date(input);
    return isNaN(date.getTime()) ? null : date;
  }
}

// SQL injection prevention
class SQLSanitizer {
  static sanitizeTableName(tableName) {
    // Only allow alphanumeric and underscore characters for table names
    return tableName.replace(/[^a-zA-Z0-9_]/g, '');
  }

  static sanitizeColumnNames(columnNames) {
    return columnNames.map(col => this.sanitizeColumnName(col));
  }

  static sanitizeColumnName(columnName) {
    // Remove any potentially dangerous characters
    return columnName.replace(/[^a-zA-Z0-9_]/g, '');
  }

  static buildSafeInsertQuery(tableName, columns) {
    const sanitizedTable = this.sanitizeTableName(tableName);
    const sanitizedColumns = this.sanitizeColumnNames(columns);
    const columnList = sanitizedColumns.map(col => `\`${col}\``).join(',');
    return `INSERT INTO ${sanitizedTable} (${columnList}) VALUES ?`;
  }
}

// Data validation utilities
class DataValidator {
  static validateRowData(rowData, templateColumns) {
    const errors = [];
    
    if (!Array.isArray(rowData)) {
      errors.push('Row data must be an array');
      return errors;
    }

    if (rowData.length !== templateColumns.length) {
      errors.push(`Expected ${templateColumns.length} columns, got ${rowData.length}`);
      return errors;
    }

    return errors;
  }

  static validateCellValue(value, columnName, validationRules) {
    const errors = [];
    
    if (validationRules.required && (value === null || value === undefined || value === '')) {
      errors.push(`${columnName} is required`);
    }

    if (validationRules.type === 'number' && value !== null && value !== undefined) {
      const num = parseFloat(value);
      if (isNaN(num)) {
        errors.push(`${columnName} must be a valid number`);
      }
    }

    if (validationRules.type === 'date' && value !== null && value !== undefined) {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        errors.push(`${columnName} must be a valid date`);
      }
    }

    return errors;
  }
}

module.exports = {
  FileValidator,
  InputSanitizer,
  SQLSanitizer,
  DataValidator
}; 