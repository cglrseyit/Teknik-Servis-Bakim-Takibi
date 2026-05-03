-- migrate_v3.sql: Mevcut bekleyen görevleri ay-sonu tarihine taşı
-- Güvenli: Sadece 'pending' statüsündeki görevleri etkiler, tamamlanmışlara dokunmaz.

-- Her pending görevin scheduled_date'ini o tarihin ay sonuna çek
UPDATE maintenance_tasks
SET scheduled_date = DATE_TRUNC('month', scheduled_date) + INTERVAL '1 month' - INTERVAL '1 day'
WHERE status = 'pending';

-- Güncelleme sonrasını kontrol et
SELECT
  COUNT(*) FILTER (WHERE status = 'pending') AS guncellenen_pending,
  COUNT(*) FILTER (WHERE status = 'overdue') AS etkilenmeyen_overdue,
  COUNT(*) FILTER (WHERE status = 'completed') AS etkilenmeyen_completed
FROM maintenance_tasks;
