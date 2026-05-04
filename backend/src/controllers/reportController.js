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
    const { type } = req.query;
    const params = [];
    let where = '';
    if (type === 'completed') {
      where = `WHERE a.action = $${params.push('task_completed')}`;
    } else if (type === 'audit') {
      where = `WHERE a.action != $${params.push('task_completed')}`;
    }
    const { rows } = await pool.query(
      `SELECT a.*, u.name AS user_name,
         CASE
           WHEN a.entity = 'equipment' AND a.action != 'equipment_deleted'
             THEN (SELECT e.name FROM equipment e WHERE e.id = a.entity_id)
           WHEN a.entity = 'task'
             THEN (SELECT e.name FROM maintenance_tasks t JOIN equipment e ON e.id = t.equipment_id WHERE t.id = a.entity_id)
           WHEN a.entity = 'plan'
             THEN (SELECT e.name FROM maintenance_plans p JOIN equipment e ON e.id = p.equipment_id WHERE p.id = a.entity_id)
           ELSE NULL
         END AS equipment_name
       FROM audit_logs a
       LEFT JOIN users u ON u.id = a.user_id
       ${where}
       ORDER BY a.created_at DESC LIMIT 50`,
      params
    );
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
          `SELECT e.id AS eq_id, e.name, e.brand, e.category, e.supplier,
                  e.status, e.notes, e.maintenance_period,
                  t.title, t.scheduled_date, t.completed_at,
                  t.performed_work, t.notes AS task_notes,
                  t.maintained_by, t.responsible_person,
                  t.is_one_time,
                  u.name AS completed_by_name
           FROM maintenance_tasks t
           JOIN equipment e ON e.id = t.equipment_id
           LEFT JOIN users u ON u.id = t.completed_by
           WHERE t.id = $1`, [log.entity_id]
        );
        if (r.rows[0]) {
          const row = r.rows[0];
          equipment = {
            id: row.eq_id,
            name: row.name,
            brand: row.brand,
            category: row.category,
            supplier: row.supplier,
            status: row.status,
            notes: row.notes,
            maintenance_period: row.maintenance_period,
          };
          task_detail = {
            title: row.title,
            scheduled_date: row.scheduled_date,
            completed_at: row.completed_at,
            performed_work: row.performed_work,
            notes: row.task_notes,
            maintained_by: row.maintained_by,
            responsible_person: row.responsible_person,
            completed_by_name: row.completed_by_name,
            is_one_time: row.is_one_time || false,
          };
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
