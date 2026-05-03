const pool = require('../config/db');

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
  } catch (err) {
    console.error('[notifications] Hata:', err.message);
  }
}

module.exports = { generateNotifications };
