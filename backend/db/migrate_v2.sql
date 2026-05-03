-- Veri Modeli v2 Migrasyonu
-- Railway PostgreSQL'e bağlanıp çalıştırın

-- 1. equipment tablosundan department_id kaldır
ALTER TABLE equipment DROP COLUMN IF EXISTS department_id;

-- 2. equipment tablosuna supplier ekle
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS supplier VARCHAR(150);

-- 3. maintenance_plans tablosundan assigned_to kaldır
ALTER TABLE maintenance_plans DROP COLUMN IF EXISTS assigned_to;

-- 4. maintenance_tasks tablosundan responsible_person kaldır
ALTER TABLE maintenance_tasks DROP COLUMN IF EXISTS responsible_person;
