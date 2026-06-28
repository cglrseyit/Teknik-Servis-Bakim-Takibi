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

    // Önümüzdeki 14 gündeki görevler — son 7 günde bildirim gönderilmediyse
    const { rows: upcoming } = await pool.query(`
      SELECT t.id, t.title, t.scheduled_date
      FROM maintenance_tasks t
      WHERE t.status IN ('pending', 'in_progress')
        AND t.scheduled_date >= (NOW() AT TIME ZONE 'Europe/Istanbul')::date
        AND t.scheduled_date <= (NOW() AT TIME ZONE 'Europe/Istanbul')::date + INTERVAL '21 days'
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
          WHERE n.task_id = t.id AND n.type = 'reminder'
            AND (n.sent_at AT TIME ZONE 'Europe/Istanbul') >= (NOW() AT TIME ZONE 'Europe/Istanbul') - INTERVAL '7 days'
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

// Görevleri parent ekipmana göre grupla, mail satırı için display_name üret
function groupTasksForEmail(tasks) {
  const groups = new Map();

  for (const t of tasks) {
    const key = t.parent_equipment_id ? `p-${t.parent_equipment_id}` : `t-${t.id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        id: t.id,
        title: t.title,
        scheduled_date: t.scheduled_date,
        _baseName: t.parent_equipment_id
          ? (t.parent_equipment_name || t.equipment_name)
          : t.equipment_name,
        _siblingCount: t.sibling_count ? parseInt(t.sibling_count, 10) : null,
        _pendingCount: 0,
        // Tekil ekipman için lokasyon göster, grup için gerek yok
        location: t.parent_equipment_id ? null : t.location,
      });
    }
    groups.get(key)._pendingCount++;
  }

  return Array.from(groups.values()).map(g => {
    let equipment_name = g._baseName;
    if (g._siblingCount) {
      equipment_name = g._pendingCount < g._siblingCount
        ? `${g._baseName} (${g._pendingCount}/${g._siblingCount} bekliyor)`
        : `${g._baseName} (${g._pendingCount} birim)`;
    }
    return { id: g.id, title: g.title, scheduled_date: g.scheduled_date, equipment_name, location: g.location };
  });
}

async function sendDailyDigestEmails(toOverride) {
  // Tek bir grup adresine gönder, dağıtımı mail sunucusu yapsın
  const to = toOverride || process.env.NOTIFICATION_EMAIL || 'teknik@bellis.com.tr';

  // Parent ekipman adı + toplam birim sayısı için JOIN
  const taskQuery = (extraWhere) => `
    SELECT t.id, t.title, t.scheduled_date,
           e.name AS equipment_name, e.location,
           e.parent_id AS parent_equipment_id,
           ep.name AS parent_equipment_name,
           CASE WHEN e.parent_id IS NOT NULL
             THEN (SELECT COUNT(*) FROM equipment WHERE parent_id = e.parent_id)
             ELSE NULL
           END AS sibling_count
    FROM maintenance_tasks t
    LEFT JOIN equipment e ON e.id = t.equipment_id
    LEFT JOIN equipment ep ON ep.id = e.parent_id
    WHERE ${extraWhere}
    ORDER BY t.scheduled_date ASC`;

  try {
    const { rows: overdueRaw } = await pool.query(taskQuery(
      `t.status IN ('pending','in_progress','overdue')
       AND t.scheduled_date < (NOW() AT TIME ZONE 'Europe/Istanbul')::date`
    ));

    const { rows: upcomingRaw } = await pool.query(taskQuery(
      `t.status IN ('pending','in_progress')
       AND t.scheduled_date >= (NOW() AT TIME ZONE 'Europe/Istanbul')::date
       AND t.scheduled_date <= (NOW() AT TIME ZONE 'Europe/Istanbul')::date + INTERVAL '21 days'`
    ));

    if (overdueRaw.length === 0 && upcomingRaw.length === 0) {
      console.log('[email] Gönderilecek görev yok, mail atılmadı');
      return;
    }

    const overdue  = groupTasksForEmail(overdueRaw);
    const upcoming = groupTasksForEmail(upcomingRaw);

    const ok = await sendDigestEmail({ to, userName: 'Bellis Teknik Ekibi', overdue, upcoming });
    if (ok) console.log(`[email] Günlük özet ${to} adresine gönderildi (${overdue.length} gecikmiş, ${upcoming.length} yaklaşan)`);
  } catch (err) {
    console.error('[email] Özet gönderiminde hata:', err.message);
  }
}

async function sendTodayReminderEmails(toOverride) {
  const to = toOverride || process.env.NOTIFICATION_EMAIL || 'teknik@bellis.com.tr';
  try {
    const { rows } = await pool.query(`
      SELECT t.id, t.title, t.scheduled_date,
             e.name AS equipment_name, e.location,
             e.parent_id AS parent_equipment_id,
             ep.name AS parent_equipment_name,
             CASE WHEN e.parent_id IS NOT NULL
               THEN (SELECT COUNT(*) FROM equipment WHERE parent_id = e.parent_id)
               ELSE NULL
             END AS sibling_count
      FROM maintenance_tasks t
      LEFT JOIN equipment e ON e.id = t.equipment_id
      LEFT JOIN equipment ep ON ep.id = e.parent_id
      WHERE t.status IN ('pending','in_progress')
        AND t.scheduled_date = (NOW() AT TIME ZONE 'Europe/Istanbul')::date
      ORDER BY t.title ASC
    `);

    if (rows.length === 0) {
      console.log('[today-email] Bugün yapılacak görev yok, mail atılmadı');
      return;
    }

    const tasks = groupTasksForEmail(rows);
    const { sendTodayEmail } = require('./emailService');
    const ok = await sendTodayEmail({ to, userName: 'Bellis Teknik Ekibi', tasks });
    if (ok) console.log(`[today-email] Günlük hatırlatma ${to} adresine gönderildi (${tasks.length} görev)`);
  } catch (err) {
    console.error('[today-email] Hata:', err.message);
  }
}

module.exports = { generateNotifications, sendDailyDigestEmails, sendTodayReminderEmails };
