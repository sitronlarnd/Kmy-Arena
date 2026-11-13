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
- Hesap silme uygulama içinden; 30 gün içinde kişisel veriler silinir, istatistikler anonimleştirilir (Faz 6-7).
- Saklama: asistan sohbetleri 180 gün, topluluk içerikleri lisans süresince, denetim kayıtları 2 yıl.
