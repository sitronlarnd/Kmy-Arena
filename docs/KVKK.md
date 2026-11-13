# KVKK notları

> Hukuki metinlerin son hâli avukatla netleştirilecek. Bu dosya teknik tarafın notudur.

## Roller

- **Dershane:** veri sorumlusu. **Platform (KMY Arena):** veri işleyen. Dershane sözleşmesine veri işleme eki konacak.

## Yurt dışı aktarım: veritabanı Frankfurt'ta

Veritabanı, dosya depolama ve Vercel fonksiyonları **AB'de (Frankfurt)** çalışır. Bu, KVKK
kapsamında **yurt dışına aktarım** sayılır. Yapılacaklar (avukatla teyit edilecek):

- KVKK m.9 kapsamındaki aktarım mekanizmasının seçilmesi (ör. Kurul'un yayımladığı standart
  sözleşme) ve gerektiğinde Kurum'a bildirim.
- Aydınlatma metninde aktarımın, alıcı ülkenin ve amacın açıkça yazılması.
- Supabase ve Vercel ile veri işleme sözleşmelerinin (DPA) imzalanması.
- Bölge değişikliği gerekirse `VERI_BOLGESI` ortam değişkeni ve yeni Supabase projesi.

## AI sağlayıcısı

KMYAI'ye (ve onun üzerinden model sağlayıcısına) **kişisel veri gönderilmez**: yalnızca soru içeriği,
kazanım ve anonim istatistik gider. Teknik önlemler:

- `KmyaiIstemci`, giden içerikte öğrencinin adı, soyadı, takma adı veya e-postası geçiyorsa isteği
  göndermeden reddeder (`KisiselVeriHatasi`).
- Öğrencinin serbest metni (asistan, topluluk) `kisiselVeriyiTemizle` ile e-posta, telefon, TCKN,
  IBAN, bağlantı ve kullanıcı adından arındırılır.
- `ai_cagri_log`'da kullanıcı kimliği yalnızca bizim veritabanımızda tutulur, KMYAI'ye iletilmez.

## Veri minimizasyonu ve saklama

- TCKN, adres, okul adı istenmez. Diğer öğrencilere yalnızca takma ad ve karakter görünür.
- 18 yaş altı öğrencide veli açık rızası gelene kadar sosyal özellikler kapalıdır.
- Hesap silme uygulama içinden (Profil → Hesabımı sil, iki adımlı onay). Talep `kullanici.silinme_talebi` ile kaydedilir ve denetim günlüğüne yazılır; kullanıcı hemen çıkış yapar. 30 gün sonra `hesap-sil` gece işi Supabase Auth hesabını ve ona bağlı kişisel kayıtları siler (cascade). Dershane düzeyindeki toplu istatistikler kişiyle ilişkilendirilemez biçimde kalır. 30 gün içinde dershane yöneticisine başvurularak talep geri alınabilir.
- Fotoğraftan çöz: fotoğraf yalnızca istek sırasında bellekte işlenir, hiçbir yerde saklanmaz. Görsel önce yüz, kimlik/kişisel bilgi ve uygunsuz içerik açısından kontrol edilir; bunlardan biri varsa okunmadan reddedilir. AI sağlayıcısına öğrenci kimliği gönderilmez.
- Topluluk görselleri özel (public olmayan) depoda tutulur, yalnızca kısa süreli imzalı bağlantıyla ve yalnızca görme yetkisi olanlara gösterilir; aynı görsel denetiminden geçer.
- Rehberlik bildirimi: asistan veya toplulukta destek gerektirebilecek ifadeler (kendine zarar vb.) algılanırsa AI'ya gönderilmez; öğrenciye destek hatları gösterilir ve yalnızca dershanenin rehber öğretmenine/yöneticisine `rehberlik_bildirim` düşer. Bildirim içeriği öğrencinin kendi yazdığı metinle sınırlıdır, AI yorumu içermez.
- Teklif formu (tanıtım sitesi): yalnızca dershane ve yetkili iletişim bilgisi alınır, öğrenci verisi alınmaz; IP başına saatte 5 gönderim sınırı.
- Saklama: asistan sohbetleri 180 gün, topluluk içerikleri lisans süresince, denetim kayıtları 2 yıl.
