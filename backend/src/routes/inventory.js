const router = require('express').Router();
const c = require('../controllers/inventoryController');
const attachments = require('../controllers/attachmentController');
const { authenticate, requireRole } = require('../middleware/auth');

const ALL_TECH = ['admin', 'teknik_muduru', 'order_taker'];

// Liste + özet
router.get('/',                  authenticate, c.getAll);
router.get('/summary/category',  authenticate, c.categorySummary);
router.get('/summary/location',  authenticate, c.locationSummary);

// Excel toplu içe aktarma (?preview=1 ile kuru deneme)
router.post('/import',           authenticate, requireRole(...ALL_TECH),
            attachments.upload.single('file'), attachments.multerErrorHandler,
            c.importExcel);

// Attachment alt-yolları (parametrik /:id'den ÖNCE tanımlanmalı)
router.get('/attachments/:id/download',  authenticate, c.downloadAttachment);
router.delete('/attachments/:id',        authenticate, requireRole(...ALL_TECH), c.deleteAttachment);

// CRUD
router.get('/:id',     authenticate, c.getOne);
router.post('/',       authenticate, requireRole(...ALL_TECH),
            attachments.upload.array('files', 10), attachments.multerErrorHandler,
            c.create);
router.put('/:id',     authenticate, requireRole(...ALL_TECH), c.update);
router.delete('/:id',  authenticate, requireRole(...ALL_TECH), c.remove);

// Foto işlemleri (kayıt bazlı)
router.post('/:id/attachments',
            authenticate, requireRole(...ALL_TECH),
            attachments.upload.array('files', 10), attachments.multerErrorHandler,
            c.uploadAttachments);
router.put('/:id/attachments/:attId/primary',
            authenticate, requireRole(...ALL_TECH),
            c.setPrimaryAttachment);

module.exports = router;
