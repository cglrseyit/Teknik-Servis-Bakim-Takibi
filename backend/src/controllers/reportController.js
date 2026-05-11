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
          const attRes = await pool.query(
            `SELECT id, filename, mime_type, size_bytes, uploaded_at
             FROM task_attachments WHERE task_id = $1 ORDER BY uploaded_at DESC`,
            [log.entity_id]
          );
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
            attachments: attRes.rows,
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

async function testEmail(req, res) {
  const { Resend } = require('resend');
  const { RESEND_API_KEY, SMTP_FROM } = process.env;

  if (!RESEND_API_KEY) {
    return res.status(500).json({
      success: false,
      message: 'RESEND_API_KEY eksik — Railway Variables kısmına ekleyin',
    });
  }

  const resend = new Resend(RESEND_API_KEY);
  const to = req.body.to || 'seyitcaglar881@gmail.com';
  const from = SMTP_FROM || 'Bellis Teknik Servis <onboarding@resend.dev>';

  try {
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject: '[Bellis] Test E-postası',
      html: '<p>Resend bağlantısı başarılı. Mail sistemi çalışıyor.</p>',
    });
    if (error) {
      return res.status(500).json({ success: false, message: 'Mail gönderilemedi', detail: error.message });
    }
    res.json({ success: true, message: `Test maili ${to} adresine gönderildi` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Hata oluştu', detail: err.message });
  }
}

async function testDigestEmail(req, res) {
  const { Resend } = require('resend');
  const { buildDigestHtml } = require('../services/emailService');
  const { RESEND_API_KEY, SMTP_FROM } = process.env;

  if (!RESEND_API_KEY) {
    return res.status(500).json({ success: false, message: 'RESEND_API_KEY eksik — Railway Variables kısmına ekleyin' });
  }

  let userName = 'Yönetici';
  let to = req.body.to;
  try {
    const { rows } = await pool.query(`SELECT name, email FROM users WHERE id = $1`, [req.user.id]);
    if (rows[0]) {
      userName = rows[0].name || userName;
      if (!to) to = rows[0].email;
    }
  } catch {}
  if (!to) to = 'seyitcaglar881@gmail.com';

  // Örnek veri
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 5);
  const lastWeek = new Date(today); lastWeek.setDate(today.getDate() - 12);
  const next3 = new Date(today); next3.setDate(today.getDate() + 3);
  const next10 = new Date(today); next10.setDate(today.getDate() + 10);
  const next20 = new Date(today); next20.setDate(today.getDate() + 20);

  const overdue = [
    { id: 1, title: 'Aylık Klima Filtre Temizliği', scheduled_date: yesterday, equipment_name: 'Lobi VRF Klima', location: 'Lobi' },
    { id: 2, title: 'Jeneratör Yağ Kontrolü',         scheduled_date: lastWeek, equipment_name: 'Acil Jeneratör', location: 'Teknik Oda' },
  ];
  const upcoming = [
    { id: 3, title: 'Asansör Periyodik Bakımı',      scheduled_date: next3,  equipment_name: 'Müşteri Asansörü 1', location: 'A Blok' },
    { id: 4, title: 'Yangın Tüpü Yıllık Kontrolü',   scheduled_date: next10, equipment_name: 'Yangın Tüpü Set #3', location: 'Mutfak' },
    { id: 5, title: 'Havuz Pompası Bakımı',          scheduled_date: next20, equipment_name: 'Açık Havuz Pompa Sistemi', location: 'Bahçe' },
  ];

  try {
    const resend = new Resend(RESEND_API_KEY);
    const from = SMTP_FROM || 'Bellis Teknik Servis <onboarding@resend.dev>';
    const { error } = await resend.emails.send({
      from,
      to: [to],
      subject: `[Bellis] ${overdue.length} gecikmiş, ${upcoming.length} yaklaşan bakım (örnek)`,
      html: buildDigestHtml({ userName, overdue, upcoming }),
    });
    if (error) return res.status(500).json({ success: false, message: 'Mail gönderilemedi', detail: error.message });
    res.json({ success: true, message: `Örnek bakım maili ${to} adresine gönderildi` });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Hata oluştu', detail: err.message });
  }
}

module.exports = { getStats, getMonthlySummary, getStatusDistribution, getAuditLogs, getAuditLogDetail, testEmail, testDigestEmail };
