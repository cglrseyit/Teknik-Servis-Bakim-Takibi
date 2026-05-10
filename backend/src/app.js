require('dotenv').config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET must be set and at least 32 characters long');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cron = require('node-cron');
const path = require('path');
const rateLimit = require('express-rate-limit');
const pool = require('./config/db');

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // style-src-elem: <style> tag ve <link rel=stylesheet> — sadece kendi domainimiz
      // style-src-attr: style="..." attribute — Recharts/dinamik bileşenler için unsafe-inline
      styleSrcElem: ["'self'"],
      styleSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "blob:"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameSrc: ["'self'", "blob:"],
      workerSrc: ["'self'", "blob:"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    }
  }
}));

const corsOrigin = process.env.CLIENT_URL
  ? process.env.CLIENT_URL
  : (process.env.NODE_ENV === 'production' ? false : '*');
app.use(cors({ origin: corsOrigin }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Global API rate limiter — her IP için dakikada 120 istek
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla istek. Lütfen biraz bekleyin.' },
});
app.use('/api', apiLimiter);

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth',        require('./routes/auth'));
app.use('/api/equipment',   require('./routes/equipment'));
app.use('/api/plans',       require('./routes/plans'));
app.use('/api/tasks',         require('./routes/tasks'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/reports',       require('./routes/reports'));
app.use('/api',               require('./routes/attachments'));
app.use('/api/exports',       require('./routes/exports'));

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
const AUTO_MIGRATIONS = [
  `ALTER TABLE maintenance_plans ADD COLUMN IF NOT EXISTS is_one_time BOOLEAN DEFAULT false`,
  `ALTER TABLE maintenance_tasks ADD COLUMN IF NOT EXISTS maintained_by TEXT`,
  `ALTER TABLE maintenance_tasks ADD COLUMN IF NOT EXISTS is_one_time BOOLEAN DEFAULT false`,
  `ALTER TABLE maintenance_tasks ADD COLUMN IF NOT EXISTS responsible_person TEXT`,
  `ALTER TABLE equipment ADD COLUMN IF NOT EXISTS supplier TEXT`,
  `ALTER TABLE equipment ADD COLUMN IF NOT EXISTS brand TEXT`,
  `ALTER TABLE equipment ADD COLUMN IF NOT EXISTS category TEXT`,
  `ALTER TABLE equipment ADD COLUMN IF NOT EXISTS notes TEXT`,
  `ALTER TABLE equipment ADD COLUMN IF NOT EXISTS maintenance_period VARCHAR(20)`,
  `ALTER TABLE maintenance_tasks ADD COLUMN IF NOT EXISTS approved_by_manager BOOLEAN DEFAULT false`,
  `CREATE TABLE IF NOT EXISTS task_attachments (
     id SERIAL PRIMARY KEY,
     task_id INT NOT NULL REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
     filename TEXT NOT NULL,
     stored_filename TEXT NOT NULL,
     mime_type TEXT NOT NULL,
     size_bytes INT NOT NULL,
     uploaded_by INT REFERENCES users(id) ON DELETE SET NULL,
     uploaded_at TIMESTAMP DEFAULT NOW()
   )`,
  `CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id)`,
  // Eski kayıtlarda UTF-8 olarak yanlış kaydedilmiş dosya adlarını düzelt (latin1 → utf8)
  `UPDATE task_attachments
   SET filename = convert_from(convert_to(filename, 'LATIN1'), 'UTF8')
   WHERE filename ~ '[ÃÄÅ]'`,
];
AUTO_MIGRATIONS.forEach(sql => {
  pool.query(sql).catch(err => console.error('[migration] Hata:', sql.split(' ').slice(0, 6).join(' '), '→', err.message));
});

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
