const router = require('express').Router();
const c = require('../controllers/taskController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/summary',    authenticate, c.getSummary);
router.get('/my-all',     authenticate, c.getMyAllTasks);
router.get('/my',         authenticate, c.getMyTasks);
router.get('/',           authenticate, c.getAll);
router.get('/:id',        authenticate, c.getOne);
router.post('/',          authenticate, requireRole('admin', 'teknik_muduru', 'order_taker'), c.create);
router.put('/:id/status', authenticate, c.updateStatus);

module.exports = router;
