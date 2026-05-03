## BÖLÜM 4: ALARM & BİLDİRİM SİSTEMİ (REVİZE)

### 4.1 Bakım Tarihi ve Otomasyon Mantığı
- **Manuel Başlangıç:** Yeni bakım planı eklenirken ilk bakım tarihi manuel olarak girilecek.
- **Otomatik Periyot:** İlk işlem tamamlandıktan sonra, seçilen periyoda (Haftalık, Aylık vb.) göre bir sonraki tarih sistem tarafından otomatik hesaplanacak.
- **Sabit Uyarı:** Bakıma 3 gün kala bildirimler kısmına otomatik uyarı düşecek (Kullanıcıdan süre seçimi alınmayacak).

### 4.2 Bildirim ve Görev Akışı
- **Görünürlük:** Kullanıcılar sadece "günü yaklaşan" (vade - 3 gün) ve "günü gelen" görevleri görecek. Henüz vakti gelmemiş planlar listede kalabalık yapmayacak.
- **Vade Günü:** Bakım günü geldiğinde görev hem "Bildirimler" sekmesine hem de "Bekleyen Görevler" kısmına düşecek.
- **Gecikmiş Görevler:** Vadesi üzerinden 1 gün geçen tüm işlemler otomatik olarak "Gecikmiş Görevler" kategorisine taşınacak.
- **Temizlik:** "Bugün yapılacaklar" ayrımı kaldırılacak, tüm süreç "Bekleyen Görevler" üzerinden yürüyecek.

### 4.3 Kullanıcı Arayüzü (Dashboard) Düzenlemesi
- **Teknisyen Görünümü:** "Görevlerim" kısmı ayrı bir sayfa yerine, Dashboard'daki ana kutuların (Bekleyen, Devam Eden, Gecikmiş) hemen altında liste şeklinde yer alacak.
- **Filtreleme:** Ana ekranda (Dashboard) "Tamamlanan" ve "Bugün Yapılması Gerekenler" için hızlı filtreleme butonları bulunacak.