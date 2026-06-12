const { Pool } = require('pg');

const useSSL = process.env.NODE_ENV === 'production' && process.env.DB_SSL !== 'false';
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: useSSL ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('DB pool error:', err.message);
});

module.exports = pool;
