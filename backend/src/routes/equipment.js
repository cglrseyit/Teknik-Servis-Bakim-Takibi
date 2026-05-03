const router = require('express').Router();
const c = require('../controllers/equipmentController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/',       authenticate, c.getAll);
router.get('/:id',    authenticate, c.getOne);
router.post('/',      authenticate, requireRole('admin', 'teknik_muduru', 'order_taker'), c.create);
router.put('/:id',    authenticate, requireRole('admin', 'teknik_muduru', 'order_taker'), c.update);
router.delete('/:id', authenticate, requireRole('admin'), c.remove);

module.exports = router;
