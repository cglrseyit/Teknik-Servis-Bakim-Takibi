const bcrypt = require('bcryptjs');
const pool = require('../config/db');

async function getAll(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, role, is_active, created_at FROM users ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function create(req, res) {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Ad, e-posta, şifre ve rol zorunlu' });
  }
  try {
    const hashed = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password, role)
       VALUES ($1,$2,$3,$4) RETURNING id, name, email, role, is_active, created_at`,
      [name, email, hashed, role]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Bu e-posta zaten kayıtlı' });
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { name, email, role, is_active, password } = req.body;
  try {
    let query, params;
    if (password) {
      const hashed = await bcrypt.hash(password, 12);
      query = `UPDATE users SET name=$1,email=$2,role=$3,is_active=$4,password=$5 WHERE id=$6
               RETURNING id,name,email,role,is_active,created_at`;
      params = [name, email, role, is_active !== false, hashed, id];
    } else {
      query = `UPDATE users SET name=$1,email=$2,role=$3,is_active=$4 WHERE id=$5
               RETURNING id,name,email,role,is_active,created_at`;
      params = [name, email, role, is_active !== false, id];
    }
    const { rows } = await pool.query(query, params);
    if (!rows[0]) return res.status(404).json({ error: 'Bulunamadı' });
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ error: 'Bu e-posta zaten kayıtlı' });
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  if (Number(id) === req.user.id) {
    return res.status(400).json({ error: 'Kendinizi silemezsiniz' });
  }
  try {
    const { rowCount } = await pool.query('DELETE FROM users WHERE id=$1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Bulunamadı' });
    res.json({ message: 'Silindi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

module.exports = { getAll, create, update, remove };
