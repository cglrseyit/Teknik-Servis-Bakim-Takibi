-- Kullanicilar (sifre: password) — sadece kullanici tablosu bossa eklenir
INSERT INTO users (name, email, password, role)
SELECT * FROM (VALUES
  ('Sistem Admin',     'admin@otel.com',   '$2a$10$oovAK1KSOwGVv8MKGei2mOFyiF/bUblscPO4B804hrV1K3v1a212.', 'admin'),
  ('Mekanik Yonetici', 'mekanik@otel.com', '$2a$10$oovAK1KSOwGVv8MKGei2mOFyiF/bUblscPO4B804hrV1K3v1a212.', 'teknik_muduru'),
  ('Ahmet Teknisyen',  'ahmet@otel.com',   '$2a$10$oovAK1KSOwGVv8MKGei2mOFyiF/bUblscPO4B804hrV1K3v1a212.', 'order_taker')
) AS v(name, email, password, role)
WHERE NOT EXISTS (SELECT 1 FROM users LIMIT 1);

-- Ekipmanlar (yoksa ekle)
INSERT INTO equipment (name, brand, model, serial_number, location, category, install_date, status)
SELECT * FROM (VALUES
  ('Klima Santrali #1', 'Daikin',      'VRV-IV', 'DK-2021-001',  'Cati Kati - Mekanik Oda',      'HVAC',       '2021-03-15'::date, 'active'),
  ('Klima Santrali #2', 'Daikin',      'VRV-IV', 'DK-2021-002',  'Cati Kati - Mekanik Oda',      'HVAC',       '2021-03-15'::date, 'active'),
  ('Jenerator',         'Caterpillar', 'C15',    'CAT-2019-007', 'Bodrum Kat - Jenerator Odasi', 'Jenerator',  '2019-06-01'::date, 'active'),
  ('Hidrofor Grubu',    'Grundfos',    'CM5-6',  'GF-2020-003',  'Bodrum Kat - Pompa Odasi',     'Su Sistemi', '2020-01-10'::date, 'active'),
  ('Asansor #1',        'Schindler',   '3300',   'SCH-2018-001', 'A Blok - Asansor Kuyusu',      'Asansor',    '2018-09-20'::date, 'active')
) AS v(name, brand, model, serial_number, location, category, install_date, status)
WHERE NOT EXISTS (SELECT 1 FROM equipment LIMIT 1);
