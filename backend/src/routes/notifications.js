const router = require('express').Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { getMyNotifications, markAllRead } = require('../controllers/notificationController');
const { sendDailyDigestEmails } = require('../services/notificationService');

router.get('/',              authenticate, getMyNotifications);
router.put('/read-all',      authenticate, markAllRead);
router.post('/test-digest',  authenticate, requireRole('admin', 'teknik_muduru'), async (req, res) => {
  try {
    await sendDailyDigestEmails();
    res.json({ ok: true, message: 'Digest gönderildi (log\'a bak)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
