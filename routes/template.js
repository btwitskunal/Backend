const express = require('express');
const router = express.Router();
const templateController = require('../controllers/templateController');
const { requireAuth, requireAnyRole } = require('../middleware/auth');

router.get('/download', requireAuth, requireAnyRole(['DO', 'ADMIN']), templateController.downloadTemplate);
router.get('/', templateController.getTemplate);
router.post('/', requireAuth, requireAnyRole(['ADMIN']), templateController.uploadTemplate);

// New routes for element visualization
router.get('/elements', requireAuth, requireAnyRole(['DO', 'ADMIN']), templateController.getElements);
router.get('/elements/:element', requireAuth, requireAnyRole(['DO', 'ADMIN']), templateController.getElementDetails);
router.get('/visualization', requireAuth, requireAnyRole(['DO', 'ADMIN']), templateController.getVisualizationData);

// Customer BTL activities route
router.get('/customer-btl-activities/:customerSapId', requireAuth, requireAnyRole(['DO', 'ADMIN']), templateController.getCustomerBTLActivities);

module.exports = router;