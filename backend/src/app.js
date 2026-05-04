require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cron = require('node-cron');
const path = require('path');
const pool = require('./config/db');

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: process.env.CLIENT_URL || '*' }));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), environment: process.env.NODE_ENV || 'development' });
});

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/equipment',   require('./routes/equipment'));
app.use('/api/plans',       require('./routes/plans'));
app.use('/api/tasks',         require('./routes/tasks'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reports',       require('./routes/reports'));

// Cron: Her gece yarisi Istanbul saatiyle gorev uret + durum guncelle
cron.schedule('0 0 * * *', async () => {
  const { generateAllActivePlans } = require('./services/taskGenerator');
  await generateAllActivePlans();
  // Günü gelen bekleyen görevleri otomatik "Devam Ediyor" yap
  await pool.query(
    `UPDATE maintenance_tasks SET status='in_progress'
     WHERE status='pending'
       AND scheduled_date = (NOW() AT TIME ZONE 'Europe/Istanbul')::date`
  );
  // Geçmiş tarihlileri gecikmiş işaretle
  await pool.query(
    `UPDATE maintenance_tasks SET status='overdue'
     WHERE status='pending'
       AND scheduled_date < (NOW() AT TIME ZONE 'Europe/Istanbul')::date`
  );
}, { timezone: 'Europe/Istanbul' });

// Cron: Her sabah 08:00 Istanbul saatiyle bildirim uret
cron.schedule('0 8 * * *', async () => {
  const { generateNotifications } = require('./services/notificationService');
  await generateNotifications();
}, { timezone: 'Europe/Istanbul' });

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../../frontend/dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Auto-migrations
pool.query(`ALTER TABLE maintenance_plans ADD COLUMN IF NOT EXISTS is_one_time BOOLEAN DEFAULT false`).catch(() => {});
pool.query(`ALTER TABLE maintenance_tasks ADD COLUMN IF NOT EXISTS maintained_by TEXT`).catch(() => {});
pool.query(`ALTER TABLE maintenance_tasks ADD COLUMN IF NOT EXISTS is_one_time BOOLEAN DEFAULT false`).catch(() => {});
pool.query(`ALTER TABLE maintenance_tasks ADD COLUMN IF NOT EXISTS responsible_person TEXT`).catch(() => {});
pool.query(`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS supplier TEXT`).catch(() => {});
pool.query(`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS brand TEXT`).catch(() => {});
pool.query(`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS category TEXT`).catch(() => {});
pool.query(`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS notes TEXT`).catch(() => {});
pool.query(`ALTER TABLE equipment ADD COLUMN IF NOT EXISTS maintenance_period VARCHAR(20)`).catch(() => {});

// Startup fix: geçmiş pending görevleri overdue yap, aktif planlar için gelecek görevleri üret
(async () => {
  try {
    const overdue = await pool.query(
      `UPDATE maintenance_tasks SET status='overdue'
       WHERE status='pending'
         AND scheduled_date < (NOW() AT TIME ZONE 'Europe/Istanbul')::date`
    );
    if (overdue.rowCount > 0) {
      console.log(`Startup: ${overdue.rowCount} gecikmiş görev overdue yapıldı`);
    }
    const { generateAllActivePlans } = require('./services/taskGenerator');
    await generateAllActivePlans();
  } catch (err) {
    console.error('Startup fix hatası:', err.message);
  }
})();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
