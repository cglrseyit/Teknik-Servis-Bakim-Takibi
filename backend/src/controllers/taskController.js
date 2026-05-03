const pool = require('../config/db');
const { generateTasksForPlan, getIntervalDays } = require('../services/taskGenerator');
const { logAction } = require('../services/auditLogger');

async function getAll(req, res) {
  const { status, assigned_to, date_from, date_to, equipment_id, search } = req.query;
  const conditions = [];
  const params = [];

  if (status)             { params.push(status);       conditions.push(`t.status = $${params.length}`); }
  if (req.query.active === 'true') {
    conditions.push(
      `(t.status IN ('in_progress','overdue') OR ` +
      `(t.status = 'pending' AND t.scheduled_date <= CURRENT_DATE + (COALESCE(p.advance_notice_days, 3) || ' days')::interval))`
    );
  }
  if (req.query.this_month === 'true') {
    conditions.push(
      `t.status NOT IN ('completed','skipped') AND ` +
      `(DATE_TRUNC('month', t.scheduled_date) = DATE_TRUNC('month', CURRENT_DATE) OR t.status IN ('overdue','in_progress'))`
    );
  }
  if (req.query.undone === 'true') {
    conditions.push(`t.status NOT IN ('completed','skipped')`);
  }
  if (assigned_to)  { params.push(assigned_to);  conditions.push(`t.assigned_to = $${params.length}`); }
  if (equipment_id) { params.push(equipment_id); conditions.push(`t.equipment_id = $${params.length}`); }
  if (date_from)    { params.push(date_from);    conditions.push(`t.scheduled_date >= $${params.length}`); }
  if (date_to)      { params.push(date_to);      conditions.push(`t.scheduled_date <= $${params.length}`); }
  if (search)       { params.push(`%${search}%`); conditions.push(`e.name ILIKE $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(
      `SELECT t.*, e.name AS equipment_name, e.location, e.category,
              u.name AS assigned_name
       FROM maintenance_tasks t
       LEFT JOIN equipment e ON e.id = t.equipment_id
       LEFT JOIN users u ON u.id = t.assigned_to
       LEFT JOIN maintenance_plans p ON p.id = t.plan_id
       ${where}
       ORDER BY t.scheduled_date ASC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function getMyTasks(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT t.*, e.name AS equipment_name, e.location
       FROM maintenance_tasks t
       LEFT JOIN equipment e ON e.id = t.equipment_id
       LEFT JOIN maintenance_plans p ON p.id = t.plan_id
       WHERE t.assigned_to = $1
         AND t.status NOT IN ('completed','skipped')
         AND (t.status IN ('in_progress','overdue')
              OR t.scheduled_date <= CURRENT_DATE + (COALESCE(p.advance_notice_days, 3) || ' days')::interval)
       ORDER BY t.scheduled_date ASC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function getMyAllTasks(req, res) {
  const { status } = req.query;
  try {
    const { rows } = await pool.query(
      `SELECT t.*, e.name AS equipment_name, e.location
       FROM maintenance_tasks t
       LEFT JOIN equipment e ON e.id = t.equipment_id
       WHERE t.assigned_to = $1 ${status ? `AND t.status = $2` : ''}
       ORDER BY t.scheduled_date DESC LIMIT 50`,
      status ? [req.user.id, status] : [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function getOne(req, res) {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT t.*, e.name AS equipment_name, e.location,
              e.brand, e.model, e.serial_number, e.category,
              u.name AS assigned_name
       FROM maintenance_tasks t
       LEFT JOIN equipment e ON e.id = t.equipment_id
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Bulunamadı' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function create(req, res) {
  const { equipment_id, title, description, scheduled_date, assigned_to } = req.body;
  if (!equipment_id || !title || !scheduled_date) {
    return res.status(400).json({ error: 'Ekipman, başlık ve tarih zorunlu' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO maintenance_tasks (equipment_id, title, description, scheduled_date, assigned_to, status)
       VALUES ($1,$2,$3,$4,$5,'pending') RETURNING *`,
      [equipment_id, title, description, scheduled_date, assigned_to || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function updateStatus(req, res) {
  const { id } = req.params;
  const { status, notes, performed_work, maintained_by, responsible_person, performed_date, approved_by_manager } = req.body;
  const allowed = ['pending', 'in_progress', 'completed', 'skipped', 'postponed'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Geçersiz durum' });
  }
  if (status === 'completed') {
    if (!maintained_by?.trim()) return res.status(400).json({ error: 'Bakımı yapan kişi/firma zorunludur' });
    if (!responsible_person?.trim()) return res.status(400).json({ error: 'Sorumlu kişi zorunludur' });
  }
  try {
    // Başlatma/tamamlama için sıra ve tarih kontrolü
    if (status === 'in_progress' || status === 'completed') {
      const { rows: existing } = await pool.query(
        'SELECT scheduled_date, plan_id, status FROM maintenance_tasks WHERE id = $1',
        [id]
      );
      if (!existing[0]) return res.status(404).json({ error: 'Bulunamadı' });
      const cur = existing[0];

      if (cur.scheduled_date) {
        // 1) Tarih kontrolü: scheduled_date gelecek bir aya aitse engelle
        const istanbulNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }));
        const sd = new Date(cur.scheduled_date);
        const curYM = istanbulNow.getFullYear() * 12 + istanbulNow.getMonth();
        const taskYM = sd.getFullYear() * 12 + sd.getMonth();
        if (taskYM > curYM) {
          return res.status(400).json({
            error: 'Bu bakımın zamanı henüz gelmedi. İçinde bulunulan ay sonunda yapılabilir.'
          });
        }

        // 2) Sıra kontrolü: aynı plana ait daha eski tamamlanmamış görev varsa engelle
        if (cur.plan_id) {
          const { rows: older } = await pool.query(
            `SELECT id, scheduled_date FROM maintenance_tasks
             WHERE plan_id = $1
               AND id <> $2
               AND scheduled_date < $3::date
               AND status IN ('pending','in_progress','overdue')
             ORDER BY scheduled_date ASC LIMIT 1`,
            [cur.plan_id, id, cur.scheduled_date]
          );
          if (older[0]) {
            const olderDate = new Date(older[0].scheduled_date).toLocaleDateString('tr-TR');
            return res.status(400).json({
              error: `Önce ${olderDate} tarihli tamamlanmamış bakımı yapmalısınız.`
            });
          }
        }
      }
    }

    const completed_at = status === 'completed'
      ? (performed_date ? new Date(performed_date) : new Date())
      : null;
    const completed_by = status === 'completed' ? req.user.id : null;

    const { rows } = await pool.query(
      `UPDATE maintenance_tasks
       SET status=$1, notes=COALESCE($2,notes),
           performed_work=COALESCE($3,performed_work),
           maintained_by=COALESCE($4,maintained_by),
           responsible_person=COALESCE($5,responsible_person),
           completed_at=$6, completed_by=$7,
           approved_by_manager=COALESCE($8, approved_by_manager)
       WHERE id=$9 RETURNING *`,
      [status, notes, performed_work, maintained_by || null, responsible_person || null, completed_at, completed_by,
       typeof approved_by_manager === 'boolean' ? approved_by_manager : null, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Bulunamadı' });

    // Tamamlandıysa: sonraki görevi üret + audit log
    if (status === 'completed') {
      await logAction(req.user.id, 'task_completed', 'task', rows[0].id, rows[0].title);
      if (rows[0].plan_id) {
        const { rows: plans } = await pool.query(
          'SELECT * FROM maintenance_plans WHERE id = $1', [rows[0].plan_id]
        );
        if (plans[0]) {
          if (plans[0].is_one_time) {
            await pool.query('UPDATE maintenance_plans SET is_active = false WHERE id = $1', [plans[0].id]);
          } else {
            // Pencere: periyotun en az 1 katı kadar ilerisi (3 aylık plan için 97 gün gibi)
            const interval = getIntervalDays(plans[0]);
            await generateTasksForPlan(plans[0], 365);
          }
        }
      }
    }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function getSummary(req, res) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { rows } = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending' AND DATE_TRUNC('month', scheduled_date) = DATE_TRUNC('month', CURRENT_DATE)) AS pending,
         COUNT(*) FILTER (WHERE status = 'overdue') AS overdue,
         COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
         COUNT(*) FILTER (WHERE status = 'completed' AND DATE_TRUNC('month', completed_at) = DATE_TRUNC('month', NOW())) AS completed_this_month,
         COUNT(*) FILTER (WHERE scheduled_date = $1 AND status IN ('pending','in_progress')) AS today
       FROM maintenance_tasks`,
      [today]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

module.exports = { getAll, getMyTasks, getMyAllTasks, getOne, create, updateStatus, getSummary };
