const XLSX = require('xlsx');
const templateManager = require('../utils/templateManager');
const { pool } = require('../utils/db');
const path = require('path');
const fs = require('fs');
const config = require('../utils/config');
const logger = require('../utils/logger');
const { FileValidator, InputSanitizer, SQLSanitizer, DataValidator } = require('../utils/validation');
const validationCache = require('../utils/validationCache');

// Define a constant for the error column name to ensure consistency.
const ERROR_COLUMN_NAME = 'Error';
const BATCH_SIZE = 1000; // Process rows in batches for better performance

exports.uploadFile = async (req, res) => {
  const startTime = Date.now();
  
  try {
    // Log the upload attempt
    logger.logFileUpload(
      req.file.originalname, 
      req.file.size, 
      req.session?.userId
    );

    // Validate the uploaded file
    await FileValidator.validateExcelFile(req.file.path);

    // Read and parse the Excel file
    const workbook = XLSX.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    const uploadedColumns = data[0] || [];

    // Sanitize column names
    const sanitizedColumns = uploadedColumns.map(col => InputSanitizer.sanitizeColumnName(col));

    // Check if the re-uploaded file contains the error report column
    if (sanitizedColumns.includes(ERROR_COLUMN_NAME)) {
      logger.warn('Upload attempt with error column', {
        filename: req.file.originalname,
        userId: req.session?.userId
      });
      
      return res.status(400).json({
        success: false,
        error: `The uploaded file contains an '${ERROR_COLUMN_NAME}' column. Please remove it and re-upload.`,
        code: 'ERROR_COLUMN_DETECTED'
      });
    }

    // Get template definition and validate columns
    const template = await templateManager.getTemplateDefinition();
    const templateColumns = template.map(col => col.name);

    // Validate columns match template
    if (JSON.stringify(sanitizedColumns) !== JSON.stringify(templateColumns)) {
      logger.warn('Column mismatch detected', {
        filename: req.file.originalname,
        expected: templateColumns,
        received: sanitizedColumns
      });
      
      return res.status(400).json({ 
        error: 'Uploaded file columns do not match template',
        code: 'COLUMN_MISMATCH'
      });
    }

    // Get validation map from cache
    const { validationMap } = validationCache.getValidationMap();

    let inserted = 0;
    let errorReportData = [];
    const validRows = []; // To hold rows for batch insertion

    // Process rows in batches for better performance
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      const rowObj = {};
      let rowHasError = false;
      let errorMessage = '';

      // Validate row data structure
      const rowValidationErrors = DataValidator.validateRowData(row, templateColumns);
      if (rowValidationErrors.length > 0) {
        rowHasError = true;
        errorMessage = rowValidationErrors.join(', ');
      } else {
        // Process each cell in the row
        for (let j = 0; j < templateColumns.length; j++) {
          const colName = templateColumns[j];
          const cellValue = row[j] !== undefined ? row[j] : null;
          
          // Sanitize the cell value based on its type
          const sanitizedValue = sanitizeCellValue(cellValue, template[j]?.type);
          rowObj[colName] = sanitizedValue;

          // Validate against allowed values
          if (validationMap[colName]) {
            const cellValueStr = sanitizedValue ? sanitizedValue.toString().trim().toLowerCase() : '';
            if (cellValueStr && !validationMap[colName].has(cellValueStr) &&
                cellValueStr !== 'optional' && cellValueStr !== 'none') {
              errorMessage = `Invalid value "${sanitizedValue}" for column "${colName}". Allowed: ${Array.from(validationMap[colName]).join(', ')}`;
              rowHasError = true;
              
              logger.logValidationError(req.file.originalname, i + 1, colName, errorMessage);
              break;
            }
          }
        }
      }

      if (rowHasError) {
        // Add to error report
        const errorRow = { ...rowObj };
        errorRow['Row Number'] = i + 1;
        errorRow[ERROR_COLUMN_NAME] = `${errorMessage} -- Please remove this error column before re-uploading your file, otherwise it will give an error.`;
        errorReportData.push(errorRow);
      } else {
        // Collect valid rows for batch processing
        validRows.push({ rowObj, originalIndex: i + 1 });
      }
    }

    // Perform batch inserts for valid rows
    if (validRows.length > 0) {
      const insertStartTime = Date.now();
      
      try {
        // Process in batches for better performance
        for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
          const batch = validRows.slice(i, i + BATCH_SIZE);
          const valuesToInsert = batch.map(item => templateColumns.map(col => item.rowObj[col]));
          
          // Use safe SQL construction
          const sql = SQLSanitizer.buildSafeInsertQuery('uploaded_data', templateColumns);
          await pool.query(sql, [valuesToInsert]);
          
          inserted += batch.length;
        }
        
        const insertDuration = Date.now() - insertStartTime;
        logger.logDatabaseOperation('batch_insert', 'uploaded_data', inserted, insertDuration);
        
      } catch (err) {
        logger.error('Batch database insert failed', err, {
          filename: req.file.originalname,
          rowCount: validRows.length
        });
        
        // Add all rows from the failed batch to the error report
        validRows.forEach(item => {
          const errorRow = { ...item.rowObj };
          errorRow['Row Number'] = item.originalIndex;
          errorRow[ERROR_COLUMN_NAME] = `Database Error (during batch insert): ${err.message} -- Please remove this error column before re-uploading your file, otherwise it will give an error.`;
          errorReportData.push(errorRow);
        });
      }
    }

    // Generate error report if there are errors
    if (errorReportData.length > 0) {
      const reportFileName = `error-report-${Date.now()}.xlsx`;
      const reportsDir = path.join(__dirname, '..', config.upload.reportsDir);
      const reportFilePath = path.join(reportsDir, reportFileName);
      const reportUrl = `/reports/${reportFileName}`;

      // Ensure the reports directory exists
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      // Generate the Excel error report
      const reportHeaders = [...templateColumns, 'Row Number', ERROR_COLUMN_NAME];
      const ws = XLSX.utils.json_to_sheet(errorReportData, { header: reportHeaders });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Errors');
      XLSX.writeFile(wb, reportFilePath);

      const totalDuration = Date.now() - startTime;
      logger.info('File processed with errors', {
        filename: req.file.originalname,
        rowsInserted: inserted,
        rowsFailed: errorReportData.length,
        duration: totalDuration
      });

      return res.status(400).json({
        success: false,
        message: 'File processed with errors. Please download the error report and re-upload after correcting the issues.',
        rowsInserted: inserted,
        rowsFailed: errorReportData.length,
        reportUrl: reportUrl,
        code: 'PROCESSED_WITH_ERRORS'
      });
    }

    // Success response
    const totalDuration = Date.now() - startTime;
    logger.info('File processed successfully', {
      filename: req.file.originalname,
      rowsInserted: inserted,
      duration: totalDuration
    });

    res.json({
      success: true,
      message: 'File processed successfully. All rows inserted.',
      rowsInserted: inserted
    });

  } catch (err) {
    logger.error('Failed to process uploaded file', err, {
      filename: req.file?.originalname,
      userId: req.session?.userId
    });
    
    res.status(500).json({ 
      error: 'Failed to process uploaded file',
      code: 'PROCESSING_ERROR'
    });
  }
};

// Helper method to sanitize cell values based on type
function sanitizeCellValue(value, type) {
  if (value === null || value === undefined) {
    return null;
  }

  switch (type?.toUpperCase()) {
    case 'INT':
    case 'FLOAT':
    case 'DOUBLE':
      return InputSanitizer.sanitizeNumber(value);
    case 'DATE':
      return InputSanitizer.sanitizeDate(value);
    default:
      return InputSanitizer.sanitizeString(value);
  }
}