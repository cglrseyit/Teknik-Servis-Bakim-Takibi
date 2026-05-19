const router = require('express').Router();
const c = require('../controllers/inventoryController');
const attachments = require('../controllers/attachmentController');
const { authenticate, requireRole } = require('../middleware/auth');

// Liste + özet
router.get('/',                  authenticate, c.getAll);
router.get('/summary/category',  authenticate, c.categorySummary);
router.get('/summary/location',  authenticate, c.locationSummary);

// Attachment alt-yolları (parametrik /:id'den ÖNCE tanımlanmalı)
router.get('/attachments/:id/download',  authenticate, c.downloadAttachment);
router.delete('/attachments/:id',        authenticate, requireRole('admin', 'teknik_muduru'), c.deleteAttachment);

// CRUD
router.get('/:id',     authenticate, c.getOne);
router.post('/',       authenticate, requireRole('admin', 'teknik_muduru'),
            attachments.upload.array('files', 10), attachments.multerErrorHandler,
            c.create);
router.put('/:id',     authenticate, requireRole('admin', 'teknik_muduru'), c.update);
router.delete('/:id',  authenticate, requireRole('admin', 'teknik_muduru'), c.remove);

// Foto işlemleri (kayıt bazlı)
router.post('/:id/attachments',
            authenticate, requireRole('admin', 'teknik_muduru'),
            attachments.upload.array('files', 10), attachments.multerErrorHandler,
            c.uploadAttachments);
router.put('/:id/attachments/:attId/primary',
            authenticate, requireRole('admin', 'teknik_muduru'),
            c.setPrimaryAttachment);

module.exports = router;
