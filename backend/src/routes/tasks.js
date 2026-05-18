const router = require('express').Router();
const c = require('../controllers/taskController');
const attachments = require('../controllers/attachmentController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/summary',    authenticate, c.getSummary);
router.get('/my',         authenticate, c.getMyTasks);
router.get('/',           authenticate, c.getAll);
router.get('/:id',        authenticate, c.getOne);
router.post('/',          authenticate, requireRole('admin', 'teknik_muduru', 'order_taker'), c.create);
router.post(
  '/historical',
  authenticate,
  requireRole('admin', 'teknik_muduru', 'order_taker'),
  attachments.upload.array('files', 10),
  attachments.multerErrorHandler,
  c.createHistorical
);
router.post('/bulk-complete', authenticate, c.bulkComplete);
router.put('/:id/status', authenticate, c.updateStatus);

module.exports = router;
