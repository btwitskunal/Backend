const { pool } = require('../utils/db');

exports.getUniqueFieldValues = async (req, res) => {
  try {
    const { field } = req.query;
    if (!field) {
      return res.status(400).json({ error: 'Field parameter is required' });
    }
    // Sanitize field name to prevent SQL injection (allow only alphanumeric and underscore)
    if (!/^\w+$/.test(field)) {
      return res.status(400).json({ error: 'Invalid field name' });
    }
    const [rows] = await pool.query(`SELECT DISTINCT \`${field}\` FROM customer_data WHERE \`${field}\` IS NOT NULL AND \`${field}\` != '' ORDER BY \`${field}\``);
    const values = rows.map(row => row[field]);
    res.json({ values });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unique field values', details: err.message });
  }
};

exports.searchCustomers = async (req, res) => {
  try {
    // Build query string for all selected filters
    const filters = req.query;
    const allowedFields = [
      'CUSTOMER_NAME', 'STATE', 'CITY', 'REGION', 'ZONE', 'T_ZONE', 
      'DISTIRCT', 'TALUKA', 'TERRITORY_CODE'
    ];
    
    let whereConditions = [];
    let queryParams = [];
    
    for (const [field, values] of Object.entries(filters)) {
      if (allowedFields.includes(field) && values) {
        const valueArray = Array.isArray(values) ? values : values.split(',');
        if (valueArray.length > 0) {
          const placeholders = valueArray.map(() => '?').join(',');
          whereConditions.push(`\`${field}\` IN (${placeholders})`);
          queryParams.push(...valueArray);
        }
      }
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    const sqlQuery = `SELECT CUSTOMER_NUMBER, CUSTOMER_NAME, TALUKA, T_ZONE, ZONE, REGION, DISTIRCT, CITY, TERRITORY_CODE, STATE FROM customer_data ${whereClause} ORDER BY CUSTOMER_NAME ASC`;
    
    const [rows] = await pool.query(sqlQuery, queryParams);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to search customers', details: err.message });
  }
};

exports.getCustomerBySapId = async (req, res) => {
  try {
    const { sapId } = req.params;
    if (!sapId) {
      return res.status(400).json({ error: 'Customer Number (SAP ID) is required' });
    }
    
    const [rows] = await pool.query('SELECT * FROM customer_data WHERE CUSTOMER_NUMBER = ?', [sapId]);
    
    if (rows && rows.length > 0) {
      const customerData = rows[0];
      const result = {
        customer_number: customerData.CUSTOMER_NUMBER,
        customer_name: customerData.CUSTOMER_NAME,
        territory_code: customerData.TERRITORY_CODE,
        t_zone: customerData.T_ZONE,
        zone: customerData.ZONE,
        state: customerData.STATE,
        region: customerData.REGION,
        district: customerData.DISTIRCT,
        taluka: customerData.TALUKA,
        city: customerData.CITY,
      };
      res.json(result);
    } else {
      res.status(404).json({ message: 'Customer not found for the given Customer Number' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer data', details: err.message });
  }
};