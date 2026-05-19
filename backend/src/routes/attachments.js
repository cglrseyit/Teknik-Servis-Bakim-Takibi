const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const c = require('../controllers/attachmentController');

router.post(
  '/tasks/:id/attachments',
  authenticate,
  requireRole('admin', 'teknik_muduru', 'order_taker'),
  c.upload.array('files', 10),
  c.multerErrorHandler,
  c.uploadAttachments
);

router.get('/tasks/:id/attachments', authenticate, c.listAttachments);
router.get('/attachments/:id/download', authenticate, c.downloadAttachment);
router.delete('/attachments/:id', authenticate, requireRole('admin', 'teknik_muduru', 'order_taker'), c.deleteAttachment);

module.exports = router;
