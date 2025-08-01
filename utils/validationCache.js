const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

class ValidationCache {
  constructor() {
    this.cache = new Map();
    this.templatePath = path.join(__dirname, '../template.xlsx');
    this.lastModified = null;
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  getTemplateLastModified() {
    try {
      const stats = fs.statSync(this.templatePath);
      return stats.mtime.getTime();
    } catch (error) {
      logger.error('Failed to get template modification time', error);
      return null;
    }
  }

  isCacheValid() {
    const currentModified = this.getTemplateLastModified();
    if (!currentModified || !this.lastModified) {
      return false;
    }
    return currentModified === this.lastModified;
  }

  buildValidationMap() {
    try {
      const workbook = XLSX.readFile(this.templatePath);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const header = rows[0].map(h => h.toString().trim());
      const validationMap = {};
      
      for (let colIdx = 0; colIdx < header.length; colIdx++) {
        const allowedSet = new Set();
        for (let i = 1; i < rows.length; i++) {
          const cell = rows[i][colIdx];
          if (cell && typeof cell === 'string') {
            cell.split(',').forEach(val => {
              const v = val.trim().toLowerCase();
              if (v && v !== 'optional' && v !== 'none') {
                allowedSet.add(v);
              }
            });
          }
        }
        if (allowedSet.size > 0) {
          validationMap[header[colIdx]] = allowedSet;
        }
      }

      return { validationMap, header };
    } catch (error) {
      logger.error('Failed to build validation map', error);
      throw new Error('Failed to build validation map');
    }
  }

  getValidationMap() {
    const currentModified = this.getTemplateLastModified();
    
    // Check if cache is valid
    if (this.isCacheValid() && this.cache.has('validationMap')) {
      logger.debug('Using cached validation map');
      return this.cache.get('validationMap');
    }

    // Build new validation map
    logger.info('Building new validation map');
    const validationData = this.buildValidationMap();
    
    // Update cache
    this.cache.set('validationMap', validationData);
    this.lastModified = currentModified;
    
    return validationData;
  }

  clearCache() {
    this.cache.clear();
    this.lastModified = null;
    logger.info('Validation cache cleared');
  }

  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      lastModified: this.lastModified,
      isValid: this.isCacheValid()
    };
  }
}

// Create singleton instance
const validationCache = new ValidationCache();

module.exports = validationCache; 