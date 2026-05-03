const router = require('express').Router();
const c = require('../controllers/departmentController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/',       authenticate, c.getAll);
router.post('/',      authenticate, requireRole('admin'), c.create);
router.put('/:id',    authenticate, requireRole('admin'), c.update);
router.delete('/:id', authenticate, requireRole('admin'), c.remove);

module.exports = router;
