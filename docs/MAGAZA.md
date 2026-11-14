# Mağaza hazırlığı (App Store / Google Play)

## Kimlik
- Uygulama adı: **KMY Arena**
- Alt başlık (iOS, 30 kr): **Oyunlaştırılmış LGS ve YKS soruları**
- Paket kimliği: `cloud.kmyai.arena`
- Kategori: Eğitim (ikincil: Oyun › Bilgi yarışması yok — yalnız Eğitim)
- Yaş sınırı: 9+ (iOS), "Herkes" / 10+ (Play). Uygulama içi satın alma yok, reklam yok.
- Hesap: yalnızca dershanenin verdiği davet koduyla açılır → **inceleme hesabı zorunlu** (aşağıda).

## Kısa açıklama (Play, 80 kr)
Dershanenin öğrencilerine seviyesine göre özgün sorular, düello ve klan savaşları.

## Tam açıklama
KMY Arena, dershanenizin öğrencileri için soru çözmeyi her gün geri dönülen bir oyuna dönüştürür.

• Seviyene göre özgün sorular: Her soru MEB ve ÖSYM kazanımlarına göre yapay zekâyla üretilir ve ikinci bir modelle bağımsız olarak doğrulanır. Zorluk anlık ayarlanır.
• Düello: Sınıf arkadaşınla gerçek zamanlı 5 soruluk düello. Her akşam Canlı Soru Saati.
• Klanlar: Klanını kur, haftalık boss'u birlikte yen, klan savaşında bölgeleri fethet. Klanın gücü yalnızca çözdüğünüz sorulardan gelir.
• Hata defteri: Yanlış yaptığın sorular aralıklı tekrarla geri gelir, konu kalıcı olana kadar.
• Sokratik asistan: Cevabı söylemeden, sorularla düşündüren yardımcı.
• Fotoğraftan çöz: Takıldığın sorunun fotoğrafını çek, çözümünü ve benzer soruları gör. Fotoğrafın saklanmaz.
• Karakter, lig ve rozetler: Seviye atla, haftalık ligde yüksel, 40'tan fazla rozet topla.

Güvenli: Öğrenciler birbirini yalnızca takma adla görür, özel mesaj yoktur; küfür ve kişisel bilgi filtresi, şikâyet sistemi ve rehber öğretmen bildirimi vardır. 18 yaş altı için veli onayı alınır. Hesabını uygulama içinden silebilirsin.

KMY Arena dershanelere lisansla sunulur; giriş için dershanenden aldığın davet kodu gerekir.

## Anahtar kelimeler (iOS, 100 kr)
lgs,yks,tyt,ayt,soru bankası,deneme,dershane,test çöz,matematik,fen,düello,klan

## Ekran görüntüleri (6,7" iPhone 1290×2796, 6,5" 1242×2688, Android 1080×1920; her biri üst metinle)
1. Soru ekranı, doğru cevap + XP — "Seviyene göre özgün sorular"
2. Düello ekranı (iki oyuncu, skor) — "Arkadaşınla gerçek zamanlı düello"
3. Klan sekmesi (amblem, boss, savaş haritası) — "Klanınla boss'u yen"
4. Harita / ilerleme yolu — "Her kazanımda ustalaş"
5. Hata defteri — "Yanlışların kalıcı öğrenmeye dönüşsün"
6. Asistan sohbeti — "Cevabı değil, yolu öğreten asistan"
7. Karakter ve rozetler — "Karakterini geliştir"
8. Lig podyumu — "Haftalık ligde yüksel"

Üretim: `npx expo export --platform web` + Playwright betikleri (`/tmp/ekran.py` mantığı) ya da gerçek cihazda inceleme öğrencisiyle (`ogrenci@inceleme.kmyarena.app`). Gerçek öğrenci verisi **kullanılmaz**.

## İnceleme notları (App Review / Play)
- Hesaplar (App Store Connect → App Review Information ve Play Console → App access bölümüne yazılır; şifre repoda değil, proje sahibinde):
  - Öğrenci (LGS): `ogrenci@inceleme.kmyarena.app`
  - Öğrenci (YKS): `yks@inceleme.kmyarena.app`
  - Veli: `veli@inceleme.kmyarena.app`
- Hesap oluşturma dershane davet koduyla yapılır (B2B); inceleme kodu `KMYARENA`.
- Hesap silme: Profil → Hesabımı sil (Apple 5.1.1(v)).
- Kamera/galeri izni yalnızca "Fotoğraftan çöz" ve topluluk görseli için; fotoğraf saklanmaz.
- Kullanıcı içeriği (topluluk, klan sohbeti): filtre, şikâyet, gizleme ve engelleme mevcut (Apple 1.2).
- Uygulama içi satın alma yoktur; Altın yalnızca soru çözerek kazanılır, gerçek parayla alınamaz.

## Gizlilik etiketleri
- Toplanan: Ad (takma ad), e-posta, kullanım verisi (cevaplar), kullanıcı içeriği (topluluk/sohbet). Kimliğe bağlı, izleme için **kullanılmaz**.
- Toplanmayan: konum, kişiler, reklam kimliği, sağlık, finans.
- Gizlilik politikası URL'si: `<site>/gizlilik`; hesap silme URL'si (Google Play zorunlu): `<site>/hesap-silme`.

## Yayın öncesi kontrol listesi
- [ ] `eas init`, EAS ortam değişkenleri, ikon (1024×1024) ve açılış ekranı
- [x] KMYAI anahtarı canlıda; soru üretimi (mimo-v2.6-flash + gpt-6-luna) ve asistan uçtan uca test edildi
- [ ] Fotoğraftan çöz gerçek cihazda test
- [x] Gizlilik politikası, kullanım koşulları ve hesap silme sayfaları (`/gizlilik`, `/kosullar`, `/hesap-silme`) — avukat kontrolü önerilir
- [ ] Resend alan adı doğrulaması (`EPOSTA_GONDEREN`)
- [x] Demo veri kaldırıldı, yalnızca inceleme dershanesi var
