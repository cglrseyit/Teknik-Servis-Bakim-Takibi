const { Pool, types } = require('pg');
// DATE (OID 1082) sütunlarını Date nesnesine çevirmeden düz "YYYY-MM-DD" string olarak döndür.
// Aksi hâlde Istanbul (UTC+3) sunucusunda "2026-06-27" → 2026-06-26T21:00:00Z olur ve
// tarih karşılaştırmaları bir gün kayar.
types.setTypeParser(1082, str => str);

const useSSL = process.env.NODE_ENV === 'production' && process.env.DB_SSL !== 'false';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('DB pool error:', err.message);
});

module.exports = pool;
