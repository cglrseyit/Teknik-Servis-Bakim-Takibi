const pool = require('../config/db');

async function logAction(userId, action, entity, entityId, detail) {
  try {
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, detail) VALUES ($1,$2,$3,$4,$5)`,
      [userId || null, action, entity || null, entityId || null, detail || null]
    );
  } catch (err) {
    console.error('[audit]', err.message);
  }
}

module.exports = { logAction };
