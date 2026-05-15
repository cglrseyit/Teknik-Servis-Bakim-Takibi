const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const c = require('../controllers/reportController');

router.get('/stats',        authenticate, requireRole('admin','teknik_muduru','order_taker'), c.getStats);
router.get('/summary',      authenticate, requireRole('admin','teknik_muduru','order_taker'), c.getMonthlySummary);
router.get('/by-status',    authenticate, requireRole('admin','teknik_muduru','order_taker'), c.getStatusDistribution);
router.get('/audit-logs',      authenticate, requireRole('admin','teknik_muduru','order_taker'), c.getAuditLogs);
router.get('/audit-logs/:id',  authenticate, requireRole('admin','teknik_muduru','order_taker'), c.getAuditLogDetail);
router.post('/test-email',         authenticate, requireRole('admin'), c.testEmail);
router.post('/test-digest-email',  authenticate, requireRole('admin'), c.testDigestEmail);

module.exports = router;
