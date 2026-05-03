-- Departmanlar
CREATE TABLE IF NOT EXISTS departments (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Kullanicilar
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  email         VARCHAR(150) UNIQUE NOT NULL,
  password      TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL CHECK (role IN ('admin','teknik_muduru','order_taker')),
  department_id INT REFERENCES departments(id) ON DELETE SET NULL,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Cihazlar / Ekipmanlar
CREATE TABLE IF NOT EXISTS equipment (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  brand         VARCHAR(100),
  model         VARCHAR(100),
  serial_number VARCHAR(100),
  location      VARCHAR(200),
  category      VARCHAR(100),
  supplier      VARCHAR(150),
  install_date  DATE,
  warranty_end  DATE,
  status        VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active','passive','maintenance','broken')),
  notes         TEXT,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Bakim Planlari (tekrarlayan kurallar)
CREATE TABLE IF NOT EXISTS maintenance_plans (
  id                  SERIAL PRIMARY KEY,
  equipment_id        INT REFERENCES equipment(id) ON DELETE CASCADE,
  title               VARCHAR(200) NOT NULL,
  description         TEXT,
  frequency_type      VARCHAR(30) NOT NULL CHECK (frequency_type IN ('daily','weekly','monthly','quarterly','yearly','custom')),
  frequency_days      INT,
  advance_notice_days INT DEFAULT 3,
  start_date          DATE,
  is_one_time         BOOLEAN DEFAULT false,
  is_active           BOOLEAN DEFAULT true,
  created_at          TIMESTAMP DEFAULT NOW()
);

-- Bakim Gorevleri (tekil gorevler)
CREATE TABLE IF NOT EXISTS maintenance_tasks (
  id             SERIAL PRIMARY KEY,
  plan_id        INT REFERENCES maintenance_plans(id) ON DELETE SET NULL,
  equipment_id   INT REFERENCES equipment(id) ON DELETE CASCADE,
  title          VARCHAR(200) NOT NULL,
  description    TEXT,
  scheduled_date DATE NOT NULL,
  assigned_to    INT REFERENCES users(id) ON DELETE SET NULL,
  status             VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','skipped','overdue')),
  completed_at       TIMESTAMP,
  completed_by       INT REFERENCES users(id) ON DELETE SET NULL,
  notes              TEXT,
  maintained_by      TEXT,
  created_at         TIMESTAMP DEFAULT NOW()
);

-- Bildirimler / Alarmlar
CREATE TABLE IF NOT EXISTS notifications (
  id       SERIAL PRIMARY KEY,
  user_id  INT REFERENCES users(id) ON DELETE CASCADE,
  task_id  INT REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
  message  TEXT NOT NULL,
  type     VARCHAR(30) CHECK (type IN ('reminder','overdue','completed','assigned')),
  is_read  BOOLEAN DEFAULT false,
  sent_at  TIMESTAMP DEFAULT NOW()
);

-- Denetim Kayitlari
CREATE TABLE IF NOT EXISTS audit_logs (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(50) NOT NULL,
  entity     VARCHAR(50),
  entity_id  INT,
  detail     TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON maintenance_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON maintenance_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled ON maintenance_tasks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
