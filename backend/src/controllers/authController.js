const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// Kullanıcı bulunamadığında da bcrypt.compare çalışsın diye sabit dummy hash
const DUMMY_HASH = '$2a$12$JHEvKtvahPMSECVpeMzpzOpNWb18XfrKNisAtgMlN/7hHZ5dY2K/y';

async function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'E-posta ve şifre gerekli' });
  }

  try {
    const { rows } = await pool.query(
      `SELECT * FROM users WHERE email = $1 AND is_active = true`,
      [email.toLowerCase().trim()]
    );

    const user = rows[0];
    const hashToCompare = user ? user.password : DUMMY_HASH;
    const valid = await bcrypt.compare(password, hashToCompare);
    if (!user || !valid) {
      return res.status(401).json({ error: 'E-posta veya şifre hatalı' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    const { password: _, ...safeUser } = user;
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function me(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, is_active, created_at FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (!rows[0]) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

module.exports = { login, me };
