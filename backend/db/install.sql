-- ============================================================================
-- Bellis Deluxe Hotel · Teknik Servis Bakım Takip Sistemi
-- Veritabanı Kurulum Şeması (PostgreSQL 13+)
-- ============================================================================
--
-- Bu dosyayı bir kez çalıştırarak tüm tabloları, kısıtlamaları ve index'leri
-- oluşturursun. Veriler kullanıcı tarafından uygulama üzerinden eklenir.
--
-- Kullanım:
--   1. Veritabanı oluştur:
--      CREATE DATABASE teknik_bakim;
--      CREATE USER bellis_app WITH PASSWORD 'guclu-bir-sifre';
--      GRANT ALL PRIVILEGES ON DATABASE teknik_bakim TO bellis_app;
--   2. Bu dosyayı çalıştır:
--      psql -U bellis_app -d teknik_bakim -f install.sql
--   3. İlk admin kullanıcısını dosyanın sonunda gösterilen örneği kullanarak ekle.
--
-- Not: Bu dosya idempotent (IF NOT EXISTS) — yeniden çalıştırılırsa hata vermez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Kullanıcılar
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(100) NOT NULL,
  email      VARCHAR(150) UNIQUE NOT NULL,
  password   TEXT NOT NULL,                          -- bcrypt hash (12 rounds)
  role       VARCHAR(20) NOT NULL
             CHECK (role IN ('admin', 'teknik_muduru', 'order_taker')),
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Ekipmanlar
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS equipment (
  id                 SERIAL PRIMARY KEY,
  name               VARCHAR(150) NOT NULL,
  brand              VARCHAR(100),
  model              VARCHAR(100),
  serial_number      VARCHAR(100),
  location           VARCHAR(200),
  category           VARCHAR(100),
  supplier           VARCHAR(150),
  install_date       DATE,
  warranty_end       DATE,
  status             VARCHAR(30) DEFAULT 'active'
                     CHECK (status IN ('active', 'passive', 'maintenance', 'broken')),
  notes              TEXT,
  maintenance_period VARCHAR(20),                    -- 'monthly', 'quarterly', 'biannual', 'yearly'
  created_at         TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Bakım Planları (tekrarlayan kural tanımları)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_plans (
  id                  SERIAL PRIMARY KEY,
  equipment_id        INT REFERENCES equipment(id) ON DELETE CASCADE,
  title               VARCHAR(200) NOT NULL,
  description         TEXT,
  frequency_type      VARCHAR(30) NOT NULL
                      CHECK (frequency_type IN ('daily', 'weekly', 'monthly',
                                                 'quarterly', 'semiannual',
                                                 'yearly', 'custom')),
  frequency_days      INT,                           -- custom periyot için gün sayısı
  advance_notice_days INT DEFAULT 3,                 -- (artık kullanılmıyor, geçmiş veriden kalma)
  start_date          DATE,
  target_month        INT,                           -- 1-12, yıllık/3-6 aylık planlarda hedef ay
  is_one_time         BOOLEAN DEFAULT false,
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Bakım Görevleri (tekil görev örnekleri — planlardan üretilir)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id                  SERIAL PRIMARY KEY,
  plan_id             INT REFERENCES maintenance_plans(id) ON DELETE SET NULL,
  equipment_id        INT REFERENCES equipment(id) ON DELETE CASCADE,
  title               VARCHAR(200) NOT NULL,
  description         TEXT,
  scheduled_date      DATE NOT NULL,                 -- vade tarihi (ay-bazlı planlarda ay sonu)
  assigned_to         INT REFERENCES users(id) ON DELETE SET NULL,
  status              VARCHAR(30) DEFAULT 'pending'
                      CHECK (status IN ('pending', 'in_progress', 'completed',
                                         'skipped', 'overdue', 'postponed')),
  completed_at        TIMESTAMP,
  completed_by        INT REFERENCES users(id) ON DELETE SET NULL,
  notes               TEXT,
  performed_work      TEXT,                          -- yapılan işlem açıklaması
  maintained_by       TEXT,                          -- işi yapan firma/teknisyen (text)
  responsible_person  TEXT,                          -- otel tarafı sorumlu (text)
  is_one_time         BOOLEAN DEFAULT false,
  approved_by_manager BOOLEAN DEFAULT false,         -- teknik müdür onayı
  created_at          TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Görev Ek Dosyaları (PDF, resim, Office belgeleri)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS task_attachments (
  id              SERIAL PRIMARY KEY,
  task_id         INT NOT NULL REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
  filename        TEXT NOT NULL,                     -- orijinal dosya adı
  stored_filename TEXT NOT NULL,                     -- diskte rastgele üretilmiş ad
  mime_type       TEXT NOT NULL,
  size_bytes      INT NOT NULL,
  uploaded_by     INT REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at     TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- In-app Bildirimler
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id       SERIAL PRIMARY KEY,
  user_id  INT REFERENCES users(id) ON DELETE CASCADE,
  task_id  INT REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
  message  TEXT NOT NULL,
  type     VARCHAR(30) CHECK (type IN ('reminder', 'overdue', 'completed', 'assigned')),
  is_read  BOOLEAN DEFAULT false,
  sent_at  TIMESTAMP DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- Denetim Kayıtları (audit logs)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(50) NOT NULL,                   -- 'equipment_created', 'task_completed', vs.
  entity     VARCHAR(50),                            -- 'equipment', 'task', 'plan', 'user'
  entity_id  INT,
  detail     TEXT,                                   -- serbest metin veya JSON
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================================
-- Index'ler (performans için)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_users_email          ON users(email);

CREATE INDEX IF NOT EXISTS idx_tasks_assigned       ON maintenance_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status         ON maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled      ON maintenance_tasks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tasks_plan_id        ON maintenance_tasks(plan_id);
CREATE INDEX IF NOT EXISTS idx_tasks_equipment_id   ON maintenance_tasks(equipment_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at   ON maintenance_tasks(completed_at)
    WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_plans_equipment_id   ON maintenance_plans(equipment_id);
CREATE INDEX IF NOT EXISTS idx_plans_active         ON maintenance_plans(is_active)
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user   ON notifications(user_id, is_read);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action     ON audit_logs(action);

-- ============================================================================
-- İlk Admin Kullanıcısı Ekleme (örnek)
-- ============================================================================
--
-- Şifre bcrypt hash olarak girilmeli. Hash üretmek için sunucuda:
--   cd backend
--   node -e "console.log(require('bcryptjs').hashSync('senin-sifren-buraya', 12))"
--
-- Çıkan hash'i aşağıdaki INSERT'e yapıştır:
--
-- INSERT INTO users (name, email, password, role, is_active)
-- VALUES (
--   'Seyit Çağlar',
--   'admin@bellis.com.tr',
--   '$2a$12$ÜRETİLEN_HASH_BURAYA',
--   'admin',
--   true
-- );
--
-- ============================================================================
-- KURULUM TAMAMLANDI
-- ============================================================================
-- Şimdi backend/.env'i ayarla ve `npm start` ile sunucuyu başlat.
-- Uygulama her açılışta eksik şema değişikliklerini otomatik tamamlayacak
-- (app.js içindeki AUTO_MIGRATIONS — bu install.sql ile aynı sonucu üretir).
