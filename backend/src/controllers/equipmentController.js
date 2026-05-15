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
  // Liste yalnızca üst seviye kayıtları gösterir; alt birimler grubun detayında görünür
  const conditions = ['e.parent_id IS NULL'];
  const params = [];

  if (category) { params.push(category);      conditions.push(`e.category = $${params.length}`); }
  if (status)   { params.push(status);         conditions.push(`e.status = $${params.length}`); }
  if (search)   {
    params.push(`%${search}%`);
    // Arama ekipmanın kendisinde ya da alt birimlerinde eşleşince grubu getir
    conditions.push(`(e.name ILIKE $${params.length} OR e.serial_number ILIKE $${params.length}
      OR EXISTS (SELECT 1 FROM equipment u WHERE u.parent_id = e.id
        AND (u.name ILIKE $${params.length} OR u.serial_number ILIKE $${params.length})))`);
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  try {
    const { rows } = await pool.query(
      `SELECT e.*,
         COALESCE(e.supplier, (SELECT u.supplier FROM equipment u WHERE u.parent_id = e.id AND u.supplier IS NOT NULL ORDER BY u.name LIMIT 1)) AS supplier,
         (SELECT p.frequency_type
          FROM maintenance_plans p
          WHERE (p.equipment_id = e.id OR p.equipment_id IN (SELECT id FROM equipment WHERE parent_id = e.id))
            AND p.is_active = true
          ORDER BY p.created_at DESC LIMIT 1) AS maintenance_frequency,
         EXISTS (
           SELECT 1 FROM maintenance_plans p
           WHERE (p.equipment_id = e.id OR p.equipment_id IN (SELECT id FROM equipment WHERE parent_id = e.id))
             AND p.is_active = true AND p.is_one_time = false
         ) AS has_periodic_plan,
         (SELECT COUNT(*) FROM equipment u WHERE u.parent_id = e.id)::int AS unit_count,
         (SELECT COUNT(*) FROM equipment u WHERE u.parent_id = e.id AND u.status = 'broken')::int AS broken_unit_count
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
    const equipment = rows[0];

    // Alt birimler — grup ise dolu gelir, tekil ekipmansa boş dizi
    const { rows: units } = await pool.query(
      `SELECT id, name, brand, model, supplier, serial_number, location, status, notes, created_at
       FROM equipment WHERE parent_id = $1 ORDER BY name`,
      [id]
    );

    // Bağlı olduğu grup — bu kayıt bir alt birimse dolu gelir
    let parent = null;
    let siblings = [];
    if (equipment.parent_id) {
      const { rows: pr } = await pool.query(
        `SELECT id, name, brand, model, supplier, category, maintenance_period, location, serial_number, notes
         FROM equipment WHERE id = $1`,
        [equipment.parent_id]
      );
      parent = pr[0] || null;

      // Aynı gruba bağlı tüm birimler — birim detayındaki "Diğer Birimler" kutusu için
      const { rows: sib } = await pool.query(
        `SELECT id, name, brand, model, supplier, serial_number, location, status, notes, created_at
         FROM equipment WHERE parent_id = $1 ORDER BY name`,
        [equipment.parent_id]
      );
      siblings = sib;
    }

    // Grup ise üst kayıt + öne çıkan birimin (ilk birim) görevlerini göster
    // — diğer birimlerin görevleri kendi detay sayfalarında görünür
    const taskScopeIds = [Number(id), ...(units[0] ? [units[0].id] : [])];

    const { rows: upcomingTasks } = await pool.query(
      `SELECT t.*
       FROM maintenance_tasks t
       WHERE t.equipment_id = ANY($1)
         AND t.status IN ('pending','in_progress','overdue','postponed')
       ORDER BY t.scheduled_date ASC`,
      [taskScopeIds]
    );

    const { rows: completedTasks } = await pool.query(
      `SELECT t.*,
              COALESCE(
                (SELECT json_agg(json_build_object(
                          'id', a.id,
                          'filename', a.filename,
                          'mime_type', a.mime_type,
                          'size_bytes', a.size_bytes,
                          'uploaded_at', a.uploaded_at
                        ) ORDER BY a.uploaded_at DESC)
                 FROM task_attachments a WHERE a.task_id = t.id),
                '[]'::json
              ) AS attachments
       FROM maintenance_tasks t
       WHERE t.equipment_id = ANY($1)
         AND t.status IN ('completed','skipped')
       ORDER BY COALESCE(t.completed_at, t.scheduled_date) DESC
       LIMIT 50`,
      [taskScopeIds]
    );

    const { rows: nextRows } = await pool.query(
      `SELECT t.*, mp.title AS plan_title
       FROM maintenance_tasks t
       LEFT JOIN maintenance_plans mp ON mp.id = t.plan_id
       WHERE t.equipment_id = ANY($1)
         AND t.status IN ('pending','in_progress')
         AND t.scheduled_date >= CURRENT_DATE
       ORDER BY t.scheduled_date ASC LIMIT 1`,
      [taskScopeIds]
    );

    const { rows: planRows } = await pool.query(
      `SELECT id, title FROM maintenance_plans
       WHERE (equipment_id = $1 OR equipment_id IN (SELECT id FROM equipment WHERE parent_id = $1))
         AND is_active = true AND is_one_time = false
       ORDER BY created_at DESC LIMIT 1`,
      [id]
    );

    res.json({ ...equipment, units, parent, siblings, upcoming_tasks: upcomingTasks, completed_tasks: completedTasks, next_task: nextRows[0] || null, active_plan: planRows[0] || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function create(req, res) {
  const { name, brand, model, supplier, status, notes, maintenance_period, maintenance_start_date, quantity, parent_id, units } = req.body;
  if (!name) return res.status(400).json({ error: 'Ekipman adı gerekli' });
  // Alt birim veya sekme-bazlı çoklu kayıtta tedarikçi zorunlu değil
  if (!parent_id && !Array.isArray(units) && !supplier) return res.status(400).json({ error: 'Tedarikçi gerekli' });

  // Sekme bazlı birim dizisi: her birimin kendi tedarikçi/seri no/lokasyonu var
  if (!parent_id && Array.isArray(units) && units.length > 1) {
    try {
      const { rows } = await pool.query(
        `INSERT INTO equipment (name, maintenance_period) VALUES ($1,$2) RETURNING *`,
        [name, maintenance_period || null]
      );
      const parent = rows[0];

      for (const u of units) {
        await pool.query(
          `INSERT INTO equipment (name, brand, model, supplier, status, notes, serial_number, location, parent_id)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [u.name || name, u.brand || null, u.model || null, u.supplier || null,
           u.status || 'active', u.notes || null, u.serial_number || null, u.location || null, parent.id]
        );
      }

      if (maintenance_period && PERIOD_TO_FREQ[maintenance_period]) {
        try {
          const freq = PERIOD_TO_FREQ[maintenance_period];
          const startDate = maintenance_start_date
            ? `${maintenance_start_date}-01`
            : new Date().toISOString().split('T')[0];
          // Her child birim için ayrı plan oluştur
          const { rows: children } = await pool.query(
            `SELECT id FROM equipment WHERE parent_id = $1 ORDER BY name`,
            [parent.id]
          );
          for (const child of children) {
            const { rows: planRows } = await pool.query(
              `INSERT INTO maintenance_plans
                 (equipment_id, title, frequency_type, frequency_days, advance_notice_days, start_date, is_one_time, is_active)
               VALUES ($1,$2,$3,$4,$5,$6,false,true) RETURNING *`,
              [child.id, `Periyodik Bakım`, freq.frequency_type, freq.frequency_days, 3, startDate]
            );
            await generateTasksForPlan(planRows[0], 365);
          }
        } catch (planErr) {
          console.error('Otomatik plan oluşturulamadı:', planErr.message);
        }
      }

      await logAction(req.user.id, 'equipment_created', 'equipment', parent.id, parent.name);
      return res.status(201).json(parent);
    } catch (err) {
      console.error('Equipment create error:', err.message);
      return res.status(500).json({ error: 'Sunucu hatası' });
    }
  }

  const qty = Math.min(100, Math.max(1, parseInt(quantity) || 1));

  try {
    const { rows } = await pool.query(
      `INSERT INTO equipment (name, brand, model, supplier, status, notes, maintenance_period, parent_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [name, brand || null, model || null, supplier || null, status || 'active', notes || null, parent_id ? null : (maintenance_period || null), parent_id || null]
    );
    const equipment = rows[0];

    const childIds = [];
    if (qty > 1 && !parent_id) {
      for (let i = 1; i <= qty; i++) {
        const { rows: cr } = await pool.query(
          `INSERT INTO equipment (name, status, parent_id) VALUES ($1,$2,$3) RETURNING id`,
          [`${name} #${i}`, status || 'active', equipment.id]
        );
        childIds.push(cr[0].id);
      }
    }

    if (!parent_id && maintenance_period && PERIOD_TO_FREQ[maintenance_period]) {
      try {
        const freq = PERIOD_TO_FREQ[maintenance_period];
        const startDate = maintenance_start_date
          ? `${maintenance_start_date}-01`
          : new Date().toISOString().split('T')[0];
        // Birden fazla child varsa her birine plan; tekil ekipmansa kendisine
        const planTargets = childIds.length > 0 ? childIds : [equipment.id];
        for (const eqId of planTargets) {
          const { rows: planRows } = await pool.query(
            `INSERT INTO maintenance_plans
               (equipment_id, title, frequency_type, frequency_days, advance_notice_days, start_date, is_one_time, is_active)
             VALUES ($1,$2,$3,$4,$5,$6,false,true) RETURNING *`,
            [eqId, `Periyodik Bakım`, freq.frequency_type, freq.frequency_days, 3, startDate]
          );
          await generateTasksForPlan(planRows[0], 365);
        }
      } catch (planErr) {
        console.error('Otomatik plan oluşturulamadı:', planErr.message);
      }
    }

    await logAction(req.user.id, 'equipment_created', 'equipment', equipment.id, equipment.name);
    res.status(201).json(equipment);
  } catch (err) {
    console.error('Equipment create error:', err.message);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function patchStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['active', 'passive', 'maintenance', 'broken'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Geçersiz durum' });
  try {
    const { rows } = await pool.query(
      `UPDATE equipment SET status=$1 WHERE id=$2 RETURNING *`,
      [status, id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Bulunamadı' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Sunucu hatası' });
  }
}

async function update(req, res) {
  const { id } = req.params;
  const { name, brand, model, category, supplier, status, notes, maintenance_period, serial_number, location } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE equipment
       SET name=$1, brand=$2, model=$3, category=$4, supplier=$5, status=$6,
           notes=$7, maintenance_period=$8, serial_number=$9, location=$10
       WHERE id=$11 RETURNING *`,
      [name, brand || null, model || null, category || null, supplier || null, status,
       notes || null, maintenance_period || null, serial_number || null, location || null, id]
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

module.exports = { getAll, getOne, create, update, patchStatus, remove };
