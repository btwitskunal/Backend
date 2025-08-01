const { pool } = require('./db');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const TEMPLATE_FILE_PATH = path.join(__dirname, '../template.xlsx');

async function getTemplateDefinition() {
  if (!fs.existsSync(TEMPLATE_FILE_PATH)) {
    throw new Error('Template file not found at ' + TEMPLATE_FILE_PATH);
  }
  
  const workbook = XLSX.readFile(TEMPLATE_FILE_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  const headers = rows[0];
  const types = rows[1] || headers.map(() => 'TEXT');
  
  return headers.map((name, index) => ({
    name: name,
    type: (types[index] || 'TEXT').toUpperCase(),
    position: index
  }));
}

async function syncDataTableSchema() {
  const DATA_TABLE = 'uploaded_data';
  const columns = await getTemplateDefinition();
  
  const [currentColsRows] = await pool.query(`SHOW COLUMNS FROM ${DATA_TABLE}`);
  const currentCols = currentColsRows.map(col => ({
    name: col.Field,
    type: col.Type.toUpperCase()
  }));

  // Helper to map template types to MySQL types
  function mapType(templateType) {
    const typeMap = {
      'INT': 'INT',
      'DATE': 'DATE',
      'FLOAT': 'DOUBLE',
      'DOUBLE': 'DOUBLE'
    };
    return typeMap[templateType] || 'VARCHAR(255)';
  }

  // Add/update columns
  for (const col of columns) {
    const existingCol = currentCols.find(c => c.name === col.name);
    const desiredType = mapType(col.type);
    
    if (!existingCol) {
      await pool.query(`ALTER TABLE ${DATA_TABLE} ADD COLUMN \`${col.name}\` ${desiredType} NULL`);
    } else if (!existingCol.type.includes(desiredType)) {
      await pool.query(`ALTER TABLE ${DATA_TABLE} MODIFY COLUMN \`${col.name}\` ${desiredType} NULL`);
    }
  }

  // Remove columns not in template
  for (const dbCol of currentCols) {
    if (!columns.find(col => col.name === dbCol.name)) {
      await pool.query(`ALTER TABLE ${DATA_TABLE} DROP COLUMN \`${dbCol.name}\``);
    }
  }
}

module.exports = {
  getTemplateDefinition,
  syncDataTableSchema
};