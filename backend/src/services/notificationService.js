const pool = require('../config/db');
const { sendDigestEmail } = require('./emailService');

async function generateNotifications() {
  try {
    // Tüm yönetici rolündeki kullanıcıları al
    const { rows: managers } = await pool.query(
      `SELECT id FROM users WHERE role IN ('admin', 'teknik_muduru', 'order_taker') AND is_active = true`
    );
    const managerIds = managers.map(u => u.id);
    if (managerIds.length === 0) {
      console.log('[notifications] Yönetici kullanıcı bulunamadı');
      await sendDailyDigestEmails();
      return;
    }

    // Gecikmiş görevler — her yöneticiye bildirim
    const { rows: overdue } = await pool.query(`
      SELECT t.id, t.title, t.scheduled_date
      FROM maintenance_tasks t
      WHERE t.status IN ('pending','in_progress')
        AND t.scheduled_date < (NOW() AT TIME ZONE 'Europe/Istanbul')::date
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.task_id = t.id AND n.type = 'overdue'
            AND (n.sent_at AT TIME ZONE 'Europe/Istanbul')::date = (NOW() AT TIME ZONE 'Europe/Istanbul')::date
        )
    `);

    for (const t of overdue) {
      for (const uid of managerIds) {
        await pool.query(
          `INSERT INTO notifications (user_id, task_id, message, type) VALUES ($1,$2,$3,'overdue')`,
          [uid, t.id, `Gecikmiş görev: ${t.title}`]
        );
      }
    }

    // Bu aydaki görevler — ayda bir kez bildirim
    const { rows: upcoming } = await pool.query(`
      SELECT t.id, t.title, t.scheduled_date
      FROM maintenance_tasks t
      WHERE t.status IN ('pending', 'in_progress')
        AND DATE_TRUNC('month', t.scheduled_date) = DATE_TRUNC('month', (NOW() AT TIME ZONE 'Europe/Istanbul')::date)
        AND t.scheduled_date >= (NOW() AT TIME ZONE 'Europe/Istanbul')::date
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.task_id = t.id AND n.type = 'reminder'
            AND DATE_TRUNC('month', (n.sent_at AT TIME ZONE 'Europe/Istanbul')) = DATE_TRUNC('month', (NOW() AT TIME ZONE 'Europe/Istanbul'))
        )
    `);

    for (const t of upcoming) {
      for (const uid of managerIds) {
        await pool.query(
          `INSERT INTO notifications (user_id, task_id, message, type) VALUES ($1,$2,$3,'reminder')`,
          [uid, t.id, `Bu ay yapılacak: ${t.title}`]
        );
      }
    }

    console.log(`[notifications] ${overdue.length} gecikmiş, ${upcoming.length} yaklaşan bildirim oluşturuldu`);

    await sendDailyDigestEmails();
  } catch (err) {
    console.error('[notifications] Hata:', err.message);
  }
}

async function sendDailyDigestEmails() {
  try {
    const { rows: users } = await pool.query(
      `SELECT id, name, email FROM users
       WHERE role IN ('admin', 'teknik_muduru', 'order_taker')
         AND is_active = true
         AND email IS NOT NULL AND email <> ''`
    );

    let sent = 0;
    for (const u of users) {
      const { rows: userOverdue } = await pool.query(`
        SELECT t.id, t.title, t.scheduled_date,
               e.name AS equipment_name, e.location
        FROM maintenance_tasks t
        LEFT JOIN equipment e ON e.id = t.equipment_id
        WHERE t.status IN ('pending','in_progress','overdue')
          AND t.scheduled_date < (NOW() AT TIME ZONE 'Europe/Istanbul')::date
        ORDER BY t.scheduled_date ASC
      `);

      const { rows: userUpcoming } = await pool.query(`
        SELECT t.id, t.title, t.scheduled_date,
               e.name AS equipment_name, e.location
        FROM maintenance_tasks t
        LEFT JOIN equipment e ON e.id = t.equipment_id
        WHERE t.status IN ('pending', 'in_progress')
          AND DATE_TRUNC('month', t.scheduled_date) = DATE_TRUNC('month', (NOW() AT TIME ZONE 'Europe/Istanbul')::date)
          AND t.scheduled_date >= (NOW() AT TIME ZONE 'Europe/Istanbul')::date
        ORDER BY t.scheduled_date ASC
      `);

      if (userOverdue.length === 0 && userUpcoming.length === 0) continue;

      const ok = await sendDigestEmail({
        to: u.email,
        userName: u.name,
        overdue: userOverdue,
        upcoming: userUpcoming,
      });
      if (ok) sent++;
    }

    if (sent > 0) console.log(`[email] ${sent} yöneticiye günlük özet maili gönderildi`);
  } catch (err) {
    console.error('[email] Özet gönderiminde hata:', err.message);
  }
}

module.exports = { generateNotifications, sendDailyDigestEmails };
