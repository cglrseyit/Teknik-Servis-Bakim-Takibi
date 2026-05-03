const pool = require('../config/db');

async function getStats(req, res) {
  try {
    const tz = `AT TIME ZONE 'Europe/Istanbul'`;
    const [eq, plans, thisMonth, lastMonth, overdue] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS c FROM equipment`),
      pool.query(`SELECT COUNT(*)::int AS c FROM maintenance_plans WHERE is_active = true`),
      pool.query(`SELECT COUNT(*)::int AS c FROM maintenance_tasks
                  WHERE status='completed'
                    AND DATE_TRUNC('month', completed_at ${tz}) = DATE_TRUNC('month', NOW() ${tz})`),
      pool.query(`SELECT COUNT(*)::int AS c FROM maintenance_tasks
                  WHERE status='completed'
                    AND DATE_TRUNC('month', completed_at ${tz}) = DATE_TRUNC('month', NOW() ${tz} - INTERVAL '1 month')`),
      pool.query(`SELECT COUNT(*)::int AS c FROM maintenance_tasks WHERE status='overdue'`),
    ]);
    res.json({
      total_equipment: eq.rows[0].c,
      active_plans: plans.rows[0].c,
      completed_this_month: thisMonth.rows[0].c,
      completed_last_month: lastMonth.rows[0].c,
      overdue: overdue.rows[0].c,
    });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function getMonthlySummary(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT TO_CHAR(DATE_TRUNC('month', completed_at AT TIME ZONE 'Europe/Istanbul'), 'YYYY-MM') AS month,
             COUNT(*)::int AS count
      FROM maintenance_tasks
      WHERE status = 'completed'
        AND completed_at >= NOW() - INTERVAL '6 months'
      GROUP BY 1
      ORDER BY 1
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function getStatusDistribution(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT status, COUNT(*)::int AS count
      FROM maintenance_tasks
      GROUP BY status
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function getAuditLogs(req, res) {
  try {
    const { rows } = await pool.query(`
      SELECT a.*, u.name AS user_name
      FROM audit_logs a
      LEFT JOIN users u ON u.id = a.user_id
      ORDER BY a.created_at DESC LIMIT 20
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function getAuditLogDetail(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT a.*, u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id WHERE a.id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Bulunamadı' });
    const log = rows[0];

    let equipment = null;
    let last_task = null;

    // equipment_deleted: veriler JSON'da saklanır, DB'de artık yok
    if (log.action === 'equipment_deleted' && log.detail) {
      try {
        const parsed = JSON.parse(log.detail);
        equipment = parsed.equipment || null;
        last_task = parsed.last_task || null;
      } catch { /* detail eski formatta (plain text) */ }
      return res.json({ ...log, equipment, last_task });
    }

    let task_detail = null;
    if (log.entity_id) {
      if (log.entity === 'task') {
        const r = await pool.query(
          `SELECT e.*, t.maintained_by, t.responsible_person
           FROM maintenance_tasks t
           JOIN equipment e ON e.id = t.equipment_id
           WHERE t.id = $1`, [log.entity_id]
        );
        if (r.rows[0]) {
          const { maintained_by, responsible_person, ...equipmentData } = r.rows[0];
          equipment = equipmentData;
          task_detail = { maintained_by, responsible_person };
        }
      } else if (log.entity === 'equipment') {
        const r = await pool.query(
          `SELECT * FROM equipment WHERE id = $1`, [log.entity_id]
        );
        equipment = r.rows[0] || null;
      } else if (log.entity === 'plan') {
        const r = await pool.query(
          `SELECT e.* FROM maintenance_plans p
           JOIN equipment e ON e.id = p.equipment_id
           WHERE p.id = $1`, [log.entity_id]
        );
        equipment = r.rows[0] || null;
      }
    }

    res.json({ ...log, equipment, last_task, task_detail });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

module.exports = { getStats, getMonthlySummary, getStatusDistribution, getAuditLogs, getAuditLogDetail };
