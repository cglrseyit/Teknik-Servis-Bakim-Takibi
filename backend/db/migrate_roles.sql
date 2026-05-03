-- Rol adlarını güncelle: manager → teknik_muduru, user → order_taker
-- Railway PostgreSQL'e bağlanıp bu dosyayı çalıştırın

-- 1. Mevcut CHECK kısıtlamasını kaldır
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;

-- 2. Mevcut kullanıcı rollerini yeni adlara taşı
UPDATE users SET role = 'teknik_muduru' WHERE role = 'manager';
UPDATE users SET role = 'order_taker'   WHERE role = 'user';

-- 3. Yeni CHECK kısıtlaması ekle
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('admin', 'teknik_muduru', 'order_taker'));
