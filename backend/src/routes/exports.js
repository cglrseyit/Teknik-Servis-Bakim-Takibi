const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const c = require('../controllers/exportController');

router.get('/equipment/list.xlsx',         authenticate, c.equipmentList);
router.get('/equipment/:id/history.xlsx', authenticate, c.equipmentHistory);
router.get('/inventory/list.xlsx',         authenticate, c.inventoryList);

module.exports = router;
