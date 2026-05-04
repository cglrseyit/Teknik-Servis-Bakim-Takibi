const pool = require('../config/db');
const { logAction } = require('../services/auditLogger');
const { generateTasksForPlan } = require('../services/taskGenerator');

const PERIOD_TO_FREQ = {
  monthly:   { frequency_type: 'monthly',    frequency_days: null },
  quarterly: { frequency_type: 'quarterly',  frequency_days: null },
  biannual:  { frequency_type: 'semiannual', frequency_days: null },
  yearly:    { frequency_type: 'yearly',     frequency_days: null },
};

async function getAll(req, res) {
  const { category, status, search } = req.query;
  const conditions = [];
  const params = [];

  if (category) { params.push(category);      conditions.push(`e.category = $${params.length}`); }
  if (status)   { params.push(status);         conditions.push(`e.status = $${params.length}`); }
  if (search)   { params.push(`%${search}%`);  conditions.push(`(e.name ILIKE $${params.length} OR e.serial_number ILIKE $${params.length})`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const { rows } = await pool.query(
      `SELECT e.*,
         (SELECT p.frequency_type
          FROM maintenance_plans p
          WHERE p.equipment_id = e.id AND p.is_active = true
          ORDER BY p.created_at DESC LIMIT 1) AS maintenance_frequency,
         EXISTS (
           SELECT 1 FROM maintenance_plans p
           WHERE p.equipment_id = e.id AND p.is_active = true AND p.is_one_time = false
         ) AS has_periodic_plan
       FROM equipment e ${where} ORDER BY e.name`,
      params
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
      `SELECT * FROM equipment WHERE id = $1`,
      [id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Bulunamadı' });

    const { rows: upcomingTasks } = await pool.query(
      `SELECT t.*, u.name AS assigned_name
       FROM maintenance_tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.equipment_id = $1
         AND t.status IN ('pending','in_progress','overdue','postponed')
       ORDER BY t.scheduled_date ASC`,
      [id]
    );

    const { rows: completedTasks } = await pool.query(
      `SELECT t.*, u.name AS assigned_name
       FROM maintenance_tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       WHERE t.equipment_id = $1
         AND t.status IN ('completed','skipped')
       ORDER BY COALESCE(t.completed_at, t.scheduled_date) DESC
       LIMIT 50`,
      [id]
    );

    const { rows: nextRows } = await pool.query(
      `SELECT t.*, u.name AS assigned_name, mp.title AS plan_title
       FROM maintenance_tasks t
       LEFT JOIN users u ON u.id = t.assigned_to
       LEFT JOIN maintenance_plans mp ON mp.id = t.plan_id
       WHERE t.equipment_id = $1
         AND t.status IN ('pending','in_progress')
         AND t.scheduled_date >= CURRENT_DATE
       ORDER BY t.scheduled_date ASC LIMIT 1`,
      [id]
    );

    res.json({ ...rows[0], upcoming_tasks: upcomingTasks, completed_tasks: completedTasks, next_task: nextRows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function create(req, res) {
  const { name, brand, category, supplier, status, notes, maintenance_period } = req.body;
  if (!name) return res.status(400).json({ error: 'Ekipman adı gerekli' });
  if (!supplier) return res.status(400).json({ error: 'Tedarikçi gerekli' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO equipment (name, brand, category, supplier, status, notes, maintenance_period)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [name, brand || null, category || null, supplier, status || 'active', notes || null, maintenance_period || null]
    );
    const equipment = rows[0];

    // Bakım periyodu seçildiyse otomatik plan + görev oluştur
    if (maintenance_period && PERIOD_TO_FREQ[maintenance_period]) {
      try {
        const freq = PERIOD_TO_FREQ[maintenance_period];
        const startDate = new Date().toISOString().split('T')[0];
        const { rows: planRows } = await pool.query(
          `INSERT INTO maintenance_plans
             (equipment_id, title, frequency_type, frequency_days, advance_notice_days, start_date, is_one_time, is_active)
           VALUES ($1,$2,$3,$4,$5,$6,false,true) RETURNING *`,
          [equipment.id, `${name} Periyodik Bakımı`, freq.frequency_type, freq.frequency_days, 3, startDate]
        );
        await generateTasksForPlan(planRows[0], 365);
      } catch (planErr) {
        console.error('Otomatik plan oluşturulamadı:', planErr.message);
      }
    }

    await logAction(req.user.id, 'equipment_created', 'equipment', equipment.id, equipment.name);
    res.status(201).json(equipment);
  } catch (err) {
    console.error('Equipment create error:', err.message);
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { name, brand, category, supplier, status, notes, maintenance_period } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE equipment
       SET name=$1, brand=$2, category=$3, supplier=$4, status=$5, notes=$6, maintenance_period=$7
       WHERE id=$8 RETURNING *`,
      [name, brand || null, category || null, supplier || null, status, notes || null, maintenance_period || null, id]
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
    // Silmeden önce ekipman bilgilerini kaydet
    const { rows: eqRows } = await pool.query(
      `SELECT * FROM equipment WHERE id = $1`, [id]
    );
    if (!eqRows[0]) return res.status(404).json({ error: 'Bulunamadı' });
    const eq = eqRows[0];

    // Son tamamlanan görevi kaydet (tasks cascade silinecek)
    const { rows: taskRows } = await pool.query(
      `SELECT t.*, u.name AS completed_by_name
       FROM maintenance_tasks t
       LEFT JOIN users u ON u.id = t.completed_by
       WHERE t.equipment_id = $1 AND t.status = 'completed'
       ORDER BY t.completed_at DESC LIMIT 1`, [id]
    );

    const detail = JSON.stringify({
      equipment: {
        name: eq.name,
        brand: eq.brand,
        category: eq.category,
        supplier: eq.supplier,
        status: eq.status,
        notes: eq.notes,
        maintenance_period: eq.maintenance_period,
      },
      last_task: taskRows[0] ? {
        title: taskRows[0].title,
        scheduled_date: taskRows[0].scheduled_date,
        completed_at: taskRows[0].completed_at,
        completed_by_name: taskRows[0].completed_by_name,
        performed_work: taskRows[0].performed_work,
        notes: taskRows[0].notes,
        maintained_by: taskRows[0].maintained_by,
        responsible_person: taskRows[0].responsible_person,
      } : null,
    });

    await pool.query('DELETE FROM equipment WHERE id=$1', [id]);
    await logAction(req.user.id, 'equipment_deleted', 'equipment', id, detail);
    res.json({ message: 'Silindi' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

module.exports = { getAll, getOne, create, update, remove };
