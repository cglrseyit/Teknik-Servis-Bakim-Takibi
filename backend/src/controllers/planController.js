const pool = require('../config/db');
const { generateTasksForPlan } = require('../services/taskGenerator');
const { logAction } = require('../services/auditLogger');

async function getAll(req, res) {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, e.name AS equipment_name,
              COUNT(t.id)::int AS task_count,
              MAX(CASE WHEN t.status = 'completed' THEN t.completed_at END) AS last_completed_at,
              MAX(CASE WHEN t.status = 'completed'
                       AND DATE_TRUNC('month', t.completed_at) = DATE_TRUNC('month', NOW() AT TIME ZONE 'Europe/Istanbul')
                  THEN t.completed_at END) AS this_month_completed_at,
              BOOL_OR(t.status IN ('pending','in_progress','overdue')
                      AND DATE_TRUNC('month', t.scheduled_date) = DATE_TRUNC('month', (NOW() AT TIME ZONE 'Europe/Istanbul')::date)
              ) AS this_month_has_pending
       FROM maintenance_plans p
       LEFT JOIN equipment e ON e.id = p.equipment_id
       LEFT JOIN maintenance_tasks t ON t.plan_id = p.id
       GROUP BY p.id, e.name
       ORDER BY p.created_at DESC`
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
      `SELECT p.*, e.name AS equipment_name, e.location, e.brand, e.serial_number, e.category
       FROM maintenance_plans p
       LEFT JOIN equipment e ON e.id = p.equipment_id
       WHERE p.id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Bulunamadı' });
    const plan = rows[0];

    // Son tamamlanan bakım
    const { rows: lastRows } = await pool.query(
      `SELECT t.*, u.name AS completed_by_name
       FROM maintenance_tasks t
       LEFT JOIN users u ON u.id = t.completed_by
       WHERE t.plan_id = $1 AND t.status = 'completed'
       ORDER BY t.completed_at DESC LIMIT 1`,
      [id]
    );

    // Sonraki bekleyen görev — opsiyonel "after" parametresi ile mevcut görevden sonrasını getir
    const after = req.query.after;
    const { rows: nextRows } = await pool.query(
      after
        ? `SELECT scheduled_date FROM maintenance_tasks
           WHERE plan_id = $1 AND status IN ('pending','in_progress')
             AND scheduled_date > $2::date
           ORDER BY scheduled_date ASC LIMIT 1`
        : `SELECT scheduled_date FROM maintenance_tasks
           WHERE plan_id = $1 AND status IN ('pending','in_progress')
             AND scheduled_date >= CURRENT_DATE
           ORDER BY scheduled_date ASC LIMIT 1`,
      after ? [id, after] : [id]
    );

    res.json({
      ...plan,
      last_maintenance: lastRows[0] || null,
      next_scheduled_date: nextRows[0]?.scheduled_date || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function create(req, res) {
  const { equipment_id, title, description, frequency_type, frequency_days, advance_notice_days, start_date, is_one_time, target_month } = req.body;
  if (!equipment_id || !title) {
    return res.status(400).json({ error: 'Ekipman ve başlık zorunlu' });
  }
  if (!is_one_time && !frequency_type) {
    return res.status(400).json({ error: 'Periyodik plan için periyot zorunlu' });
  }
  if (!start_date) {
    return res.status(400).json({ error: 'Tarih zorunlu' });
  }
  if (is_one_time) {
    const now = new Date();
    const thisYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    if (start_date.slice(0, 7) < thisYM) {
      return res.status(400).json({ error: 'Tek seferlik görev geçmiş bir aya oluşturulamaz' });
    }
  }
  try {
    // Periyodik plan icin: ekipmanin baska aktif periyodik plani olmamali
    if (!is_one_time) {
      const { rows: dup } = await pool.query(
        `SELECT id FROM maintenance_plans
         WHERE equipment_id = $1 AND is_one_time = false AND is_active = true
         LIMIT 1`,
        [equipment_id]
      );
      if (dup[0]) {
        return res.status(400).json({
          error: 'Bu ekipmanın zaten aktif bir bakım planı var. Yeni plan oluşturmak için mevcut planı silin veya pasifleştirin.'
        });
      }
    }

    const { rows } = await pool.query(
      `INSERT INTO maintenance_plans (equipment_id, title, description, frequency_type, frequency_days, advance_notice_days, start_date, is_one_time, target_month)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [equipment_id, title, description, frequency_type || 'monthly', frequency_days || null, advance_notice_days || 3, start_date, is_one_time || false, target_month || null]
    );
    const plan = rows[0];

    if (is_one_time) {
      await pool.query(
        `INSERT INTO maintenance_tasks (plan_id, equipment_id, title, description, scheduled_date, status, is_one_time)
         VALUES ($1,$2,$3,$4,$5,'pending',true)`,
        [plan.id, plan.equipment_id, plan.title, plan.description, start_date]
      );
    } else {
      await generateTasksForPlan(plan, 365);
    }

    await logAction(req.user.id, 'plan_created', 'plan', plan.id, plan.title);
    res.status(201).json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { equipment_id, title, description, frequency_type, frequency_days, advance_notice_days, is_active, start_date, target_month } = req.body;
  try {
    const { rows: oldRows } = await pool.query('SELECT * FROM maintenance_plans WHERE id=$1', [id]);
    if (!oldRows[0]) return res.status(404).json({ error: 'Bulunamadı' });
    const old = oldRows[0];

    const { rows } = await pool.query(
      `UPDATE maintenance_plans SET equipment_id=$1,title=$2,description=$3,
       frequency_type=$4,frequency_days=$5,advance_notice_days=$6,is_active=$7,
       start_date=COALESCE($8::date, start_date), target_month=$9
       WHERE id=$10 RETURNING *`,
      [equipment_id, title, description, frequency_type, frequency_days || null, advance_notice_days || 3, is_active !== false, start_date || null, target_month || null, id]
    );
    const plan = rows[0];

    const today = new Date().toISOString().split('T')[0];
    const freqChanged = old.frequency_type !== frequency_type ||
      String(old.frequency_days || '') !== String(frequency_days || '');
    const startChanged = start_date &&
      String(old.start_date || '').split('T')[0] !== start_date;

    if (!plan.is_one_time) {
      if (freqChanged || startChanged) {
        await pool.query(
          `DELETE FROM maintenance_tasks WHERE plan_id=$1 AND status IN ('pending','in_progress') AND scheduled_date >= $2`,
          [id, today]
        );
        await generateTasksForPlan(plan);
      } else {
        await pool.query(
          `UPDATE maintenance_tasks SET title=$1, description=$2
           WHERE plan_id=$3 AND status IN ('pending','in_progress') AND scheduled_date >= $4`,
          [title, description || null, id, today]
        );
      }
    }

    await logAction(req.user.id, 'plan_updated', 'plan', plan.id, plan.title);
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function remove(req, res) {
  const { id } = req.params;
  try {
    // Plan'a bağlı bekleyen/devam eden/ertelenen/gecikmiş görevleri sil
    // Tamamlanmış görevler geçmiş kayıt için saklanır (plan_id NULL'a düşer)
    await pool.query(
      `DELETE FROM maintenance_tasks
       WHERE plan_id=$1 AND status IN ('pending','in_progress','postponed','overdue')`,
      [id]
    );
    const { rowCount } = await pool.query('DELETE FROM maintenance_plans WHERE id=$1', [id]);
    if (!rowCount) return res.status(404).json({ error: 'Bulunamadı' });
    await logAction(req.user.id, 'plan_deleted', 'plan', id, null);
    res.json({ message: 'Silindi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

module.exports = { getAll, getOne, create, update, remove };
