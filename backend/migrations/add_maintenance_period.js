require('dotenv').config({ path: require('path').join(__dirname, '../../backend/.env') });
const pool = require('../src/config/db');

async function migrate() {
  try {
    await pool.query(`
      ALTER TABLE equipment
      ADD COLUMN IF NOT EXISTS maintenance_period VARCHAR(20)
    `);
    console.log('✓ maintenance_period column added to equipment table');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

migrate();
