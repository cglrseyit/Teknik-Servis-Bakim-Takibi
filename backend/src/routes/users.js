const router = require('express').Router();
const c = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/',       authenticate, requireRole('admin', 'teknik_muduru', 'order_taker'), c.getAll);
router.post('/',      authenticate, requireRole('admin'), c.create);
router.put('/:id',    authenticate, requireRole('admin'), c.update);
router.delete('/:id', authenticate, requireRole('admin'), c.remove);

module.exports = router;
