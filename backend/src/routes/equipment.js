const router = require('express').Router();
const c = require('../controllers/equipmentController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/',             authenticate, c.getAll);
router.get('/:id',          authenticate, c.getOne);
router.post('/',            authenticate, requireRole('admin', 'teknik_muduru', 'order_taker'), c.create);
router.put('/:id',          authenticate, requireRole('admin', 'teknik_muduru', 'order_taker'), c.update);
router.patch('/:id/status', authenticate, requireRole('admin', 'teknik_muduru', 'order_taker'), c.patchStatus);
router.delete('/:id',       authenticate, requireRole('admin', 'teknik_muduru', 'order_taker'), c.remove);

module.exports = router;
