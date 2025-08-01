const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

// GET /api/customers/fields?field=FIELD_NAME
router.get('/fields', customerController.getUniqueFieldValues);

// GET /api/customers/search?STATE=Delhi,Haryana&CITY=Gurgaon,Delhi
router.get('/search', customerController.searchCustomers);

// GET /api/customers/:sapId
router.get('/:sapId', customerController.getCustomerBySapId);

module.exports = router; 