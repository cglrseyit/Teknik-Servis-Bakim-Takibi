const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { getMyNotifications, markAllRead } = require('../controllers/notificationController');

router.get('/',         authenticate, getMyNotifications);
router.put('/read-all', authenticate, markAllRead);

module.exports = router;
