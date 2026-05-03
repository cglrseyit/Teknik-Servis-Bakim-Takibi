-- Departmanlar (yoksa ekle)
INSERT INTO departments (name, description)
SELECT * FROM (VALUES
  ('Mekanik', 'HVAC, kazan, pompa ve mekanik sistemler'),
  ('Elektrik', 'Elektrik panolari, jenerator ve aydinlatma sistemleri')
) AS v(name, description)
WHERE NOT EXISTS (SELECT 1 FROM departments LIMIT 1);

-- Kullanicilar (sifre: password)
INSERT INTO users (name, email, password, role, department_id) VALUES
  ('Sistem Admin',    'admin@otel.com',    '$2a$10$oovAK1KSOwGVv8MKGei2mOFyiF/bUblscPO4B804hrV1K3v1a212.', 'admin',         NULL),
  ('Mekanik Yonetici','mekanik@otel.com',  '$2a$10$oovAK1KSOwGVv8MKGei2mOFyiF/bUblscPO4B804hrV1K3v1a212.', 'teknik_muduru', 1),
  ('Ahmet Teknisyen', 'ahmet@otel.com',    '$2a$10$oovAK1KSOwGVv8MKGei2mOFyiF/bUblscPO4B804hrV1K3v1a212.', 'order_taker',   1)
ON CONFLICT (email) DO NOTHING;

-- Ekipmanlar (yoksa ekle)
INSERT INTO equipment (name, brand, model, serial_number, location, department_id, category, install_date, status)
SELECT * FROM (VALUES
  ('Klima Santrali #1', 'Daikin',      'VRV-IV', 'DK-2021-001',  'Cati Kati - Mekanik Oda',      1, 'HVAC',       '2021-03-15'::date, 'active'),
  ('Klima Santrali #2', 'Daikin',      'VRV-IV', 'DK-2021-002',  'Cati Kati - Mekanik Oda',      1, 'HVAC',       '2021-03-15'::date, 'active'),
  ('Jenerator',         'Caterpillar', 'C15',    'CAT-2019-007', 'Bodrum Kat - Jenerator Odasi', 2, 'Jenerator',  '2019-06-01'::date, 'active'),
  ('Hidrofor Grubu',    'Grundfos',    'CM5-6',  'GF-2020-003',  'Bodrum Kat - Pompa Odasi',     1, 'Su Sistemi', '2020-01-10'::date, 'active'),
  ('Asansor #1',        'Schindler',   '3300',   'SCH-2018-001', 'A Blok - Asansor Kuyusu',      1, 'Asansor',    '2018-09-20'::date, 'active')
) AS v(name, brand, model, serial_number, location, department_id, category, install_date, status)
WHERE NOT EXISTS (SELECT 1 FROM equipment LIMIT 1);
