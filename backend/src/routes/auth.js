const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { login, me } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: true,
  validate: { ipKeyGenerator: false },
  keyGenerator: (req) => {
    const ip = (req.ip || req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/, '');
    return `${ip}::${(req.body?.username || '').toLowerCase()}`;
  },
  message: { error: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/login', loginLimiter, login);
router.get('/me', authenticate, me);

module.exports = router;
