const pool = require('../config/db');

async function getMyNotifications(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT n.*, t.scheduled_date
       FROM notifications n
       LEFT JOIN maintenance_tasks t ON t.id = n.task_id
       WHERE n.user_id = $1
       ORDER BY n.sent_at DESC LIMIT 30`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function markAllRead(req, res) {
  try {
    await pool.query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1`,
      [req.user.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

module.exports = { getMyNotifications, markAllRead };
