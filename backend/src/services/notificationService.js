const pool = require('../config/db');
const { sendDigestEmail } = require('./emailService');

async function generateNotifications() {
  try {
    // Gecikmiş görevler
    const { rows: overdue } = await pool.query(`
      SELECT t.id, t.title, t.assigned_to, t.scheduled_date
      FROM maintenance_tasks t
      WHERE t.status IN ('pending','in_progress')
        AND t.scheduled_date < (NOW() AT TIME ZONE 'Europe/Istanbul')::date
        AND t.assigned_to IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.task_id = t.id AND n.type = 'overdue'
            AND (n.sent_at AT TIME ZONE 'Europe/Istanbul')::date = (NOW() AT TIME ZONE 'Europe/Istanbul')::date
        )
    `);

    for (const t of overdue) {
      await pool.query(
        `INSERT INTO notifications (user_id, task_id, message, type) VALUES ($1,$2,$3,'overdue')`,
        [t.assigned_to, t.id, `Gecikmiş görev: ${t.title}`]
      );
    }

    // 3 gün içinde yaklaşan görevler
    const { rows: upcoming } = await pool.query(`
      SELECT t.id, t.title, t.assigned_to, t.scheduled_date,
             (t.scheduled_date - (NOW() AT TIME ZONE 'Europe/Istanbul')::date) AS days_left
      FROM maintenance_tasks t
      WHERE t.status = 'pending'
        AND t.scheduled_date BETWEEN (NOW() AT TIME ZONE 'Europe/Istanbul')::date
                                 AND (NOW() AT TIME ZONE 'Europe/Istanbul')::date + INTERVAL '3 days'
        AND t.assigned_to IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.task_id = t.id AND n.type = 'reminder'
            AND (n.sent_at AT TIME ZONE 'Europe/Istanbul')::date = (NOW() AT TIME ZONE 'Europe/Istanbul')::date
        )
    `);

    for (const t of upcoming) {
      const days = t.days_left;
      const msg = days === 0 ? `Bugün yapılacak: ${t.title}` : `${days} gün içinde: ${t.title}`;
      await pool.query(
        `INSERT INTO notifications (user_id, task_id, message, type) VALUES ($1,$2,$3,'reminder')`,
        [t.assigned_to, t.id, msg]
      );
    }

    console.log(`[notifications] ${overdue.length} gecikmiş, ${upcoming.length} yaklaşan bildirim oluşturuldu`);

    await sendDailyDigestEmails();
  } catch (err) {
    console.error('[notifications] Hata:', err.message);
  }
}

// Her aktif kullanıcı için günlük tek bir özet e-posta gönderir.
// Sadece kullanıcının bugün için yaklaşan veya gecikmiş görevleri varsa mail atılır.
async function sendDailyDigestEmails() {
  try {
    const { rows: users } = await pool.query(
      `SELECT id, name, email FROM users WHERE is_active = true AND email IS NOT NULL AND email <> ''`
    );

    let sent = 0;
    for (const u of users) {
      const { rows: userOverdue } = await pool.query(`
        SELECT t.id, t.title, t.scheduled_date,
               e.name AS equipment_name, e.location
        FROM maintenance_tasks t
        LEFT JOIN equipment e ON e.id = t.equipment_id
        WHERE t.assigned_to = $1
          AND t.status IN ('pending','in_progress','overdue')
          AND t.scheduled_date < (NOW() AT TIME ZONE 'Europe/Istanbul')::date
        ORDER BY t.scheduled_date ASC
      `, [u.id]);

      const { rows: userUpcoming } = await pool.query(`
        SELECT t.id, t.title, t.scheduled_date,
               (t.scheduled_date - (NOW() AT TIME ZONE 'Europe/Istanbul')::date) AS days_left,
               e.name AS equipment_name, e.location
        FROM maintenance_tasks t
        LEFT JOIN equipment e ON e.id = t.equipment_id
        WHERE t.assigned_to = $1
          AND t.status = 'pending'
          AND t.scheduled_date BETWEEN (NOW() AT TIME ZONE 'Europe/Istanbul')::date
                                   AND (NOW() AT TIME ZONE 'Europe/Istanbul')::date + INTERVAL '3 days'
        ORDER BY t.scheduled_date ASC
      `, [u.id]);

      if (userOverdue.length === 0 && userUpcoming.length === 0) continue;

      const ok = await sendDigestEmail({
        to: u.email,
        userName: u.name,
        overdue: userOverdue,
        upcoming: userUpcoming,
      });
      if (ok) sent++;
    }

    if (sent > 0) console.log(`[email] ${sent} kullanıcıya günlük özet maili gönderildi`);
  } catch (err) {
    console.error('[email] Özet gönderiminde hata:', err.message);
  }
}

module.exports = { generateNotifications, sendDailyDigestEmails };
