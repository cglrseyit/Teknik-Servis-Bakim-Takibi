const pool = require('../config/db');

async function getAll(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT d.*, COUNT(e.id)::int AS equipment_count
       FROM departments d
       LEFT JOIN equipment e ON e.department_id = d.id
       GROUP BY d.id ORDER BY d.name`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function create(req, res) {
  const { name, description } = req.body;
  if (!name) return res.status(400).json({ error: 'Departman adı gerekli' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO departments (name, description) VALUES ($1, $2) RETURNING *',
      [name, description]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { name, description } = req.body;
  try {
    const { rows } = await pool.query(
      'UPDATE departments SET name=$1, description=$2 WHERE id=$3 RETURNING *',
      [name, description, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Bulunamadı' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  try {
    const { rowCount } = await pool.query('DELETE FROM departments WHERE id=$1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Bulunamadı' });
    res.json({ message: 'Silindi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

module.exports = { getAll, create, update, remove };
