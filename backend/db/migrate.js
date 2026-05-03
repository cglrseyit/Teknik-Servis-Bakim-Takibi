require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

async function migrate() {
  if (!process.env.DATABASE_URL) {
    console.warn('DATABASE_URL tanimli degil, migration atlandi.');
    return;
  }

  let client;
  try {
    client = await pool.connect();
    console.log('Migrasyon basliyor...');

    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('✓ Tablolar olusturuldu');

    // Mevcut tablolara yeni sutunlar ekle (idempotent)
    await client.query(`
      ALTER TABLE maintenance_tasks
        ADD COLUMN IF NOT EXISTS performed_work TEXT,
        ADD COLUMN IF NOT EXISTS replaced_parts TEXT;
    `);
    await client.query(`
      ALTER TABLE maintenance_plans
        ADD COLUMN IF NOT EXISTS start_date DATE;
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id         SERIAL PRIMARY KEY,
        user_id    INT REFERENCES users(id) ON DELETE SET NULL,
        action     VARCHAR(50) NOT NULL,
        entity     VARCHAR(50),
        entity_id  INT,
        detail     TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✓ Yeni sutunlar eklendi');

    const seed = fs.readFileSync(path.join(__dirname, 'seed.sql'), 'utf8');
    await client.query(seed);
    console.log('✓ Seed data eklendi');

    console.log('Migrasyon tamamlandi!');
    console.log('  admin@otel.com   / password');
    console.log('  mekanik@otel.com / password');
    console.log('  ahmet@otel.com   / password');
  } catch (err) {
    console.error('Migrasyon hatasi (sunucu yine de basliyor):', err.message);
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

migrate();
