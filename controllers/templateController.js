const templateManager = require('../utils/templateManager');
const path = require('path');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const { pool } = require('../utils/db');
const logger = require('../utils/logger');

exports.downloadTemplate = async (req, res) => {
  try {
    const filePath = path.join(__dirname, '../template.xlsx');
    res.download(filePath, 'template.xlsx');
  } catch (err) {
    res.status(500).json({ error: 'Failed to download template: ' + err.message });
  }
};

exports.getTemplate = async (req, res) => {
  try {
    const columns = await templateManager.getTemplateDefinition();
    res.json({ columns });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get template: ' + err.message });
  }
};

exports.uploadTemplate = [upload.single('template'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    // Validate file type
    if (!req.file.originalname.endsWith('.xlsx')) {
      return res.status(400).json({ error: 'Only .xlsx files are allowed' });
    }
    // Replace the template file
    const fs = require('fs');
    const path = require('path');
    const TEMPLATE_FILE_PATH = path.join(__dirname, '../template.xlsx');
    fs.copyFileSync(req.file.path, TEMPLATE_FILE_PATH);
    // Optionally, remove the uploaded file
    fs.unlinkSync(req.file.path);
    // Sync DB schema
    await templateManager.syncDataTableSchema();
    res.json({ success: true, message: 'Template updated and schema synced.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update template: ' + err.message });
  }
}];

/**
 * Get all unique elements from uploaded data
 */
exports.getElements = async (req, res) => {
  try {
    const template = await templateManager.getTemplateDefinition();
    
    // Find the element column (assuming it's named 'element' or contains 'element')
    const elementColumn = template.find(col => 
      col.name.toLowerCase().includes('element') || 
      col.name.toLowerCase() === 'element'
    );

    if (!elementColumn) {
      return res.status(404).json({ 
        error: 'No element column found in template',
        available_columns: template.map(col => col.name)
      });
    }

    const [rows] = await pool.query(
      `SELECT DISTINCT \`${elementColumn.name}\` as element FROM uploaded_data WHERE \`${elementColumn.name}\` IS NOT NULL AND \`${elementColumn.name}\` != '' ORDER BY \`${elementColumn.name}\``
    );

    const elements = rows.map(row => row.element).filter(Boolean);
    
    res.json({
      success: true,
      elements: elements,
      element_column: elementColumn.name
    });
  } catch (error) {
    logger.error('Failed to get elements:', error);
    res.status(500).json({ error: 'Failed to fetch elements' });
  }
};

/**
 * Get attributes and UOM for a specific element
 */
exports.getElementDetails = async (req, res) => {
  try {
    const { element } = req.params;
    
    if (!element) {
      return res.status(400).json({ error: 'Element parameter is required' });
    }

    const template = await templateManager.getTemplateDefinition();
    
    // Find the element, attribute, and UOM columns
    const elementColumn = template.find(col => 
      col.name.toLowerCase().includes('element') || 
      col.name.toLowerCase() === 'element'
    );
    
    const attributeColumn = template.find(col => 
      col.name.toLowerCase().includes('attribute') || 
      col.name.toLowerCase() === 'attribute'
    );
    
    const uomColumn = template.find(col => 
      col.name.toLowerCase().includes('uom') || 
      col.name.toLowerCase() === 'uom'
    );

    if (!elementColumn) {
      return res.status(404).json({ error: 'No element column found in template' });
    }

    let query = `SELECT DISTINCT \`${elementColumn.name}\` as element`;
    let whereClause = `WHERE \`${elementColumn.name}\` = ?`;

    if (attributeColumn) {
      query += `, \`${attributeColumn.name}\` as attribute`;
    }
    
    if (uomColumn) {
      query += `, \`${uomColumn.name}\` as uom`;
    }

    query += ` FROM uploaded_data ${whereClause} ORDER BY \`${elementColumn.name}\``;
    
    if (attributeColumn) {
      query += `, \`${attributeColumn.name}\``;
    }
    
    if (uomColumn) {
      query += `, \`${uomColumn.name}\``;
    }

    const [rows] = await pool.query(query, [element]);

    const attributes = attributeColumn ? [...new Set(rows.map(row => row.attribute).filter(Boolean))] : [];
    const uoms = uomColumn ? [...new Set(rows.map(row => row.uom).filter(Boolean))] : [];

    res.json({
      success: true,
      element: element,
      attributes: attributes,
      uoms: uoms,
      element_column: elementColumn.name,
      attribute_column: attributeColumn?.name,
      uom_column: uomColumn?.name
    });
  } catch (error) {
    logger.error('Failed to get element details:', error);
    res.status(500).json({ error: 'Failed to fetch element details' });
  }
};

/**
 * Get visualization data for element, attribute, and UOM combination
 */
exports.getVisualizationData = async (req, res) => {
  try {
    const { element, attribute, uom } = req.query;
    
    if (!element) {
      return res.status(400).json({ error: 'Element parameter is required' });
    }

    const template = await templateManager.getTemplateDefinition();
    
    // Find the relevant columns
    const elementColumn = template.find(col => 
      col.name.toLowerCase().includes('element') || 
      col.name.toLowerCase() === 'element'
    );
    
    const attributeColumn = template.find(col => 
      col.name.toLowerCase().includes('attribute') || 
      col.name.toLowerCase() === 'attribute'
    );
    
    const uomColumn = template.find(col => 
      col.name.toLowerCase().includes('uom') || 
      col.name.toLowerCase() === 'uom'
    );

    if (!elementColumn) {
      return res.status(404).json({ error: 'No element column found in template' });
    }

    let query = `SELECT * FROM uploaded_data WHERE \`${elementColumn.name}\` = ?`;
    const params = [element];

    if (attribute && attributeColumn) {
      query += ` AND \`${attributeColumn.name}\` = ?`;
      params.push(attribute);
    }

    if (uom && uomColumn) {
      query += ` AND \`${uomColumn.name}\` = ?`;
      params.push(uom);
    }

    const [rows] = await pool.query(query, params);

    // Generate analytics data
    const analytics = generateAnalytics(rows, template);

    res.json({
      success: true,
      data: rows,
      analytics: analytics,
      filters: {
        element: element,
        attribute: attribute || null,
        uom: uom || null
      }
    });
  } catch (error) {
    logger.error('Failed to get visualization data:', error);
    res.status(500).json({ error: 'Failed to fetch visualization data' });
  }
};

/**
 * Helper function to generate analytics from data
 */
function generateAnalytics(data, template) {
  if (!data || data.length === 0) {
    return {
      total_records: 0,
      summary: {},
      distributions: {}
    };
  }

  const analytics = {
    total_records: data.length,
    summary: {},
    distributions: {}
  };

  // Generate distributions for each column
  template.forEach(col => {
    const values = data.map(row => row[col.name]).filter(Boolean);
    if (values.length > 0) {
      const distribution = {};
      values.forEach(value => {
        distribution[value] = (distribution[value] || 0) + 1;
      });
      analytics.distributions[col.name] = distribution;
    }
  });

  return analytics;
}

/**
 * Get BTL activities for a specific customer
 */
exports.getCustomerBTLActivities = async (req, res) => {
  try {
    const { customerSapId } = req.params;
    
    if (!customerSapId) {
      return res.status(400).json({ error: 'Customer SAP ID is required' });
    }

    const template = await templateManager.getTemplateDefinition();
    
    // Find customer-related columns (SAP ID, customer number, etc.)
    const customerColumns = template.filter(col => 
      col.name.toLowerCase().includes('customer') || 
      col.name.toLowerCase().includes('sap') ||
      col.name.toLowerCase().includes('number')
    );

    if (customerColumns.length === 0) {
      return res.status(404).json({ 
        error: 'No customer identification columns found in template',
        available_columns: template.map(col => col.name)
      });
    }

    // Try to find customer data using different possible column names
    let customerData = null;
    let btlActivities = [];

    for (const customerCol of customerColumns) {
      try {
        // First, try to get customer info from customer database
        const customerResponse = await fetch(`http://localhost:2000/api/customer/${customerSapId}`);
        if (customerResponse.ok) {
          customerData = await customerResponse.json();
          break;
        }
      } catch (error) {
        console.log(`Failed to fetch customer data for column ${customerCol.name}:`, error.message);
      }
    }

    // Get BTL activities for this customer
    const whereConditions = customerColumns.map(col => `\`${col.name}\` = ?`).join(' OR ');
    const query = `SELECT * FROM uploaded_data WHERE ${whereConditions}`;
    const params = customerColumns.map(() => customerSapId);

    const [rows] = await pool.query(query, params);
    btlActivities = rows;

    // Generate analytics for BTL activities
    const analytics = generateBTLActivityAnalytics(btlActivities, template);

    res.json({
      success: true,
      customer_info: customerData,
      btl_activities: btlActivities,
      analytics: analytics,
      total_activities: btlActivities.length
    });
  } catch (error) {
    logger.error('Failed to get customer BTL activities:', error);
    res.status(500).json({ error: 'Failed to fetch customer BTL activities' });
  }
};

/**
 * Helper function to generate BTL activity analytics
 */
function generateBTLActivityAnalytics(data, template) {
  if (!data || data.length === 0) {
    return {
      total_activities: 0,
      activity_summary: {},
      element_distribution: {},
      attribute_distribution: {},
      uom_distribution: {}
    };
  }

  const analytics = {
    total_activities: data.length,
    activity_summary: {},
    element_distribution: {},
    attribute_distribution: {},
    uom_distribution: {}
  };

  // Find element, attribute, and UOM columns
  const elementColumn = template.find(col => 
    col.name.toLowerCase().includes('element') || 
    col.name.toLowerCase() === 'element'
  );
  
  const attributeColumn = template.find(col => 
    col.name.toLowerCase().includes('attribute') || 
    col.name.toLowerCase() === 'attribute'
  );
  
  const uomColumn = template.find(col => 
    col.name.toLowerCase().includes('uom') || 
    col.name.toLowerCase() === 'uom'
  );

  // Generate distributions
  if (elementColumn) {
    const elementCount = {};
    data.forEach(row => {
      const element = row[elementColumn.name];
      if (element) {
        elementCount[element] = (elementCount[element] || 0) + 1;
      }
    });
    analytics.element_distribution = elementCount;
  }

  if (attributeColumn) {
    const attributeCount = {};
    data.forEach(row => {
      const attribute = row[attributeColumn.name];
      if (attribute) {
        attributeCount[attribute] = (attributeCount[attribute] || 0) + 1;
      }
    });
    analytics.attribute_distribution = attributeCount;
  }

  if (uomColumn) {
    const uomCount = {};
    data.forEach(row => {
      const uom = row[uomColumn.name];
      if (uom) {
        uomCount[uom] = (uomCount[uom] || 0) + 1;
      }
    });
    analytics.uom_distribution = uomCount;
  }

  return analytics;
}