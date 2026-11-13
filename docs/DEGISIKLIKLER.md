# Değişiklik notları

## Faz planı

| Faz | Kapsam | Durum |
|---|---|---|
| 0 | Altyapı: monorepo, uygulama iskeletleri, Supabase şema + RLS + RBAC, davet kodu, özellik bayrakları, seed, CI | **Tamamlandı** |
| 1 | Çekirdek soru döngüsü: üretim + doğrulama hattı, havuz, soru ekranı (LaTeX), Elo, tespit sınavı, XP/Altın, çözüm, hata defteri, konu haritası, AI Merkezi temel | **Tamamlandı** |
| 2 | Oyun katmanı: karakter, seri, görevler, 40 rozet, mağaza, lig, sıralamalar, kart albümü | **Tamamlandı** |
| 3 | Düello ve Canlı Soru Saati (Supabase Realtime) | **Tamamlandı** |
| 4 | Klanlar, boss, klan savaşı | **Tamamlandı** |
| 5 | Topluluk soru-cevap, Sokratik asistan, fotoğraftan çöz | |
| 6 | Öğretmen, Dershane Kurucu, Veli, Merkez panelleri | |
| 7 | Tanıtım sitesi, 30 gün pilot + otomatik etki raporu, EAS mağaza derlemeleri, mağaza belgeleri | |

---

## Faz 0 — Altyapı (2026-11-13)

### Neler var

- **Monorepo** (pnpm workspaces): `apps/{mobile,panel,api,landing}`, `packages/{shared,ai,realtime}`, `supabase/`, `docs/`, CI (`.github/workflows/ci.yml`: lint, tip kontrolü, test, Postgres 16 üzerinde DB testleri, derleme).
- **packages/shared:** `oyun-ayarlari.ts` (tüm ekonomi değerleri tek yerde), Elo beceri motoru, hedef zorluk seçimi (0,70 / 0,45 / 0,85), **zorluk kalibrasyonu** (20+ cevaptan en çok olabilirlik), ustalık, XP formülü, net, Kupa, adil zamanlama, klan savaşı etkisi, RBAC matrisi, özellik bayrakları, **soru havuzu politikası**, Türkçe i18n.
- **packages/ai:** `KmyaiIstemci` (OpenAI uyumlu, zaman aşımı, 2 yeniden deneme, yedek model, log, kişisel veri koruması), görev/model ayarları (kararlaştırılan Claude modelleri), kişisel veri filtresi.
- **packages/realtime:** sağlayıcıdan bağımsız arayüz, bellek içi uygulama, Supabase REST yayıncısı.
- **Supabase (7 migration):** paket → dershane → şube → sınıf → kullanıcı; RBAC (12 rol, 39 yetki, dershane bazlı ince ayar); özellik bayrakları; AI görev ayarları (sürümlü); prompt ve oyun ayarı sürümleri; müfredat; beceri; **soru havuzu** ve `soru_gosterim`; aylık bölümlenmiş `cevap`; `ai_cagri_log` + günlük tüketim görünümü; `denetim_log`; `teklif`; tüm tablolarda RLS; davet koduyla katılım ve bireysel kayıt fonksiyonları.
- **Seed:** 1 demo dershane, 2 şube, 4 sınıf, kurucu, 2 şube müdürü, rehber, 3 öğretmen, sekreter, 40 öğrenci (biri 6 gündür girişsiz), veli, davet kodları, örnek havuz soruları; RLS testi için ikinci dershane; bireysel deneme tenant'ı; merkez sahip hesabı.
- **Uygulama iskeletleri:** Expo Router (davet koduyla katılım, giriş, 5 sekme, bayrağa göre sekme gizleme, dershane temalı vurgu rengi); Next.js panel (giriş, oturum proxy'si, RBAC'e göre /merkez /dershane /ogretmen yönlendirmesi); API (sağlık ucu, Cron çatısı); tanıtım sayfası yer tutucusu.

### Doğrulama sonuçları

| Kontrol | Sonuç |
|---|---|
| `packages/*` katı tip kontrolü | ✔ |
| Birim testleri | ✔ 45/45 (shared 33, ai 9, realtime 3) |
| Migration + seed (iki kez, idempotent) | ✔ PostgreSQL 16 |
| RLS / yetki / davet testleri | ✔ 11 grup |
| RLS testlerinin sızıntıyı yakaladığı (mutasyon denemesi) | ✔ |
| Uygulama dosyaları sözdizimi | ✔ 38 dosya |
| `pnpm install`, lint, uygulamaların tip kontrolü ve `next build` / `expo export` | ✔ (Faz 0.1'e bakın) |

Testler sırasında yakalanıp düzeltilen hata: varsayılan matriste öğretmene dershane geneli akademik
okuma yetkisi verilmişti; atanmadığı sınıfın öğrencilerinin becerisini görebiliyordu. Yetki kaldırıldı,
öğretmen erişimi yalnızca sınıf ataması üzerinden.

### Elle test adımları

1. `bash scripts/dogrula-cekirdek.sh` → tümü ✔ olmalı.
2. Demo Supabase'e migration + seed yükle, `pnpm dev`.
3. Web/mobil: `DEMA8AKD` koduyla yeni hesap aç → Arena ekranı, "Veli onayın gelene kadar…" uyarısı görünmeli.
4. Mobil: `ogrenci01@demo.kmyarena.demo` / `KmyDemo!2026` ile giriş → 5 sekme. Demo dershane için düello bayrağını kapat (`insert into ozellik_bayragi (kod, dershane_id, acik) values ('duello', '<demo dershane id>', false);`), uygulamayı yenile → Düello sekmesi kaybolmalı. (Bayrak ekranı Merkez Panele Faz 1'de gelir.)
5. Panel: `kurucu@demo…` → /dershane (40/200 koltuk); `ogretmen.mat@demo…` → /ogretmen (20 öğrenci); `sahip@kmyarena.demo` → /merkez.
6. `GET /api/saglik` → `{"durum":"ok"}`.

### Yeni ortam değişkenleri

Tamamı `.env.example` içinde.

---

## Faz 0.1 — Kurulum ve derleme doğrulaması (2026-11-13)

- `pnpm-lock.yaml` eklendi. Vercel ve CI artık `pnpm install --frozen-lockfile` ile kurar; her derleme aynı sürümleri kullanır.
- Expo paketleri SDK 57'ye sabitlendi (`expo install --fix` + `bundledNativeModules.json`). `expo-router` önceden `*` olduğu için 58.x'e çıkıyordu.
- `@expo/metro-runtime` doğrudan bağımlılık olarak eklendi. Vercel'deki `Unable to resolve module @expo/metro-runtime` web derleme hatası buydu.
- `pnpm-workspace.yaml` → `overrides`: `react-native-reanimated` 4.5.1, `react-native-worklets` 0.10.1, `@react-native/metro-config` 0.86.3 (dolaylı eş bağımlılıklar SDK dışı sürüme çıkıyordu). `onlyBuiltDependencies: esbuild`.
- Mobil TypeScript 6.0 (SDK 57 önerisi); diğer paketler 5.9'da.
- Düzeltilen hatalar:
  - `OyunAyarlari` tipi `as const` yüzünden sabit değerlere kilitliydi; Merkez Panelden gelen farklı bir değer (ör. `kupaK: 40`) tip hatası veriyordu. Tip genişletildi.
  - Mobil sekme simgeleri `ColorValue` tipine uyarlandı; tipli rotalarda `useSegments` düz dizi olarak okunuyor.
  - ESLint: `metro.config.js` gibi CommonJS araç dosyaları için Node ortamı tanımlandı.

| Kontrol | Sonuç |
|---|---|
| `pnpm lint` | ✔ 0 uyarı |
| `pnpm typecheck` | ✔ 7 paket |
| `pnpm test` | ✔ 45/45 |
| `pnpm db:test` | ✔ 11 grup, PostgreSQL 16 |
| `pnpm build` | ✔ landing, panel, api (`next build`), mobile (`expo export --platform web`) |

### Supabase'e yükleme

- `scripts/db-yukle.sh`: migration'ları uygular, uygulananları `public.kmy_migration` tablosunda tutar (her dosya bir kez, tek işlem içinde). `--seed` ile demo verisi.
- `.github/workflows/supabase-yukle.yml`: GitHub Actions'tan elle çalıştırılır. Gizli değer: `SUPABASE_DB_URL` (Supabase → Connect → Session pooler adresi). Yeni migration eklendikçe aynı iş yeniden çalıştırılır.

---

## Faz 1 — Çekirdek soru döngüsü (2026-11-13)

### Neler var

- **Soru üretim hattı** (`packages/ai/src/soru-hatti.ts`): istek → üretici (sürümlü prompt, `promptlar/`) → JSON ayıklama → kalite filtreleri → mathjs sayısal kontrol → **cevap anahtarını görmeyen** doğrulayıcı → `dogrulandi` / `reddedildi` (+ red nedeni ve aşaması). Doğru şık harfi dengeli dağıtılır. Reddedilen sorular istatistik için saklanır, öğrenciye asla gitmez.
- **Havuz** (`apps/api/lib/havuz.ts`): (kazanım, bant) başına veritabanı kilidiyle tek üretici, 3 paralel soru. Öğrenci soru isterken stok azsa yanıttan sonra arka planda üretim (`after`). Cron `havuz-doldur` her 10 dakikada: aktif kazanımlarda her bantta 8, diğerlerinin kolay bantlarında 3 soru hedefi.
- **Seçim** (`sistem_soru_sec`): öğrencinin görmediği, hedef zorluğa en yakın soru; eşitlikte önce kullanılmış olan (taze sorular düelloya). Kazanım boşsa aynı dersten.
- **Cevap işleme** (`sistem_cevap_isle`, tek işlem): gösterim kapanır (ikinci cevap 409), Elo θ (yarış kontrolüyle), XP/Altın, ustalık, seri, özellik puanı, soru istatistiği, hata defteri, tespit. Tüm hesap `packages/shared` → `cevapHesapla` (tek kaynak), istemci hiçbir değer göndermez. İpucu sayacı sunucuda.
- **Seviye tespiti:** ders başına 10 soruluk uyarlamalı sınav; sonuç dersin kazanımlarına başlangıç θ olarak yayılır.
- **Hata defteri ve aralıklı tekrar:** yanlış/boş → deftere; 1-3-7-21 gün; doğruysa sonraki aralık, yanlışsa başa.
- **Gece kalibrasyonu:** 20+ cevaplı soruların ölçülmüş zorluğu; çok hata bildirilen sorular akıştan çekilir.
- **API:** `POST /api/soru/{siradaki,cevap,ipucu,hata-bildir}`, `POST /api/yonetim/on-isitma` (ön ısıtma ve üretim testi raporu), `GET /api/yonetim/tanilama`. Bearer JWT (Supabase imza anahtarlarıyla doğrulama), CORS. Model ayarları ve promptlar veritabanından 60 sn önbellekle okunur.
- **Mobil:** soru ekranı (KaTeX: web'de doğrudan, iOS/Android'de WebView; matematiksiz metin düz Text), şıklar, süre, ipucu, boş bırak, sonuç + çözüm adımları + seçilen yanlış şıkkın çeldirici notu, "Soruda hata var", 10 soruluk oturum özeti; Arena (seviye/XP çubuğu, Altın, seri, ders seçimi, tespit önerisi, tekrar zamanı), Harita (ders → ünite → kazanım, ustalık renkleri, "Önce şunu dene"), Hata defteri, Profil (istatistik, özellik puanları).
- **Merkez Panel:** `/merkez/ai` — görev bazlı model ayarları (yeni sürüm yayınla / tek tıkla geri al, yalnızca Claude), acil durum (yedek mod, görev durdur), havuz ısı haritası (kazanım × bant), ön ısıtma / üretim testi, son 7 gün atılma oranı ve red aşamaları, görev × model token tüketimi. `/merkez/bayraklar` — genel (yüzde ile) ve dershane bazında özellik bayrakları. Tüm işlemler denetim kaydına yazılır.

### Canlı ortamda yapılan testler (2026-11-13)

| Kontrol | Sonuç |
|---|---|
| Soru getirme süresi (havuzdan, sıcak) | 0,6-1,0 sn ✔ (soğuk başlangıç ~2 sn) |
| Yanıtta cevap anahtarı / çözüm / ipucu | Yok ✔ |
| İkinci cevap | 409 ✔ |
| İstemciden XP yazma | 403 (yetki yok) ✔ |
| Sahte süre (25 sn bildirildi, gerçekte 1 sn) | Sunucu ölçümüne sıkıştırıldı, puana sayılmadı ✔ |
| Gerçek KMYAI ile üretim | İlk deneme: sonnet-4-6 20 sn'de zaman aşımı, doğrulayıcı 1200 token'da kesildi → düzeltildi (0009, doğrulama promptu v2, kesik JSON toleransı) |
| Düzeltme sonrası üretim testi | 6 sorudan 4 doğrulandı (atılma %33); doğrulayıcı gerçek hataları yakaladı: yanlış anahtar, soru metninde tekrar eden şıklar → üretim promptu v2 ve kalite filtresi eklendi |
| KMYAI hız sınırı | 9 paralel istekte HTTP 429 → örnek başına 4 eşzamanlı istek, Retry-After'a uyan bekleme |
| Model kararı | claude-sonnet-4-6 kaldırıldı (proje sahibi kararı, 0010); üretici ve doğrulayıcı claude-sonnet-5-5 |
| sonnet-5-5 ilk test | 23 sorudan 10 doğrulandı: 8'i 2500 token sınırında kesildi, 4'ü karşılaştırmalı sayısal ifade yüzünden yanlışlıkla atıldı → 4000 token (0011), üretim promptu v3, sayısal kontrol düzeltmesi |
| **sonnet-5-5 son test** | **18 sorudan 16 doğrulandı (atılma %11), soru başına ~21 sn; üretim ~2,3k giriş + ~2,1k çıkış, doğrulama ~0,85k + ~0,4k token** |

### Açık kalanlar

- **Tam MEB/ÖSYM kazanım listesi:** hâlâ 22 örnek kazanım var. Resmî kodlarla doğrulanmış liste gerekiyor (uydurma kod girilmedi).
- **100 soruluk üretim testi raporu:** Panel > AI Merkezi > Ön ısıtma ile yapılabilir (bir çalıştırma ~5 dk, ~10-15 soru); cron da sürekli üretir. Atılma oranı ve süre panelde görünür.
- **Prompt stüdyosu, A/B testi, model kataloğu, bütçe alarmları:** Faz 6.
- **Hata bildirimini öğretmenin onaylaması ve XP iadesi:** Faz 6 öğretmen paneli.

### Elle test adımları

1. Mobil web: `ogrenci01@demo.kmyarena.demo` / `KmyDemo!2026` → Arena → Matematik → **Tespite başla** → 10 soru → "Tespit tamamlandı".
2. **Soru Çöz** → soru 1,5 sn içinde gelmeli; bir şık seç → Cevapla → doğru/yanlış, XP, çözüm adımları; yanlışsa "Hata defterine eklendi".
3. Harita → kazanım renkleri; bir kazanıma dokun → o kazanımdan soru.
4. Panel: `sahip@kmyarena.demo` → Merkez → AI Merkezi → bir görevin modelini değiştir → Yayınla → sürüm artar; **Geri al** → önceki sürüm geri gelir.
5. AI Merkezi → Ön ısıt (Matematik, bant 1-3, adet 3) → rapor: doğrulanan, reddedilen, atılma oranı, ortalama süre.
6. Özellik bayrakları → demo dershanede "Düello"yu Kapalı yap → mobil uygulamayı yenile → Düello sekmesi kaybolur.

### Yeni ortam değişkenleri

- Panel: `SUPABASE_SERVICE_ROLE_KEY` (zaten girildi), isteğe bağlı `NEXT_PUBLIC_API_URL`.
- `KMYAI_ZAMAN_ASIMI_URETIM_MS` varsayılanı 90000.

---

## Faz 1.1 — Tam müfredat ve LGS / YKS paketleri (2026-11-13)

- **Müfredat:** 27 ders, 539 kazanım/konu (LGS 173, TYT 204, AYT 145, YDT 17). Ayrıntı ve kod yapısı: VARSAYIMLAR #11.
- **0012:** `paket.sinav_gruplari`, `ders.alanlar`, `sinif.yks_alani`, `kullanici.sinav_grubu / yks_alani`; `sistem_ogrenci_dersleri`, `derslerim()`. Örnek paketler: `lgs` (LGS Paketi), `yks` (YKS Paketi).
- **API:** soru seçimi ve tespit yalnızca öğrencinin kapsamındaki derslerden; kapsam dışı istek 403 (`soru.kapsamDisi`), paket öğrencinin grubunu içermiyorsa `soru.paketYok`.
- **Mobil:** Arena ve Harita yalnızca öğrencinin derslerini gösterir.
- **Havuz cron:** yalnızca satılan paketlerin grupları, bir çalıştırmada en fazla 10 soru.
- **Yükleme:** müfredat artık her "Supabase'e yükle" çalıştırmasında yüklenir/güncellenir (demo verisinden bağımsız).
- DB testleri: LGS öğrencisi yalnızca 6 LGS dersi; 12-SAY TYT + SAY AYT; 12-EA edebiyat var fizik yok; paket grubu kaldırılınca hiçbir ders yok; öğrenci kendi grubunu değiştiremez.

---

## Faz 2 — Oyun katmanı (2026-11-13)

### Neler var

- **Karakter:** 6 özgün karakter (Bilge Baykuş, Kıvılcım Tilki, Demir Ayı, Rüzgâr Atmacası, Gölge Kedi, Taş Kaplumbağa), eşit güçte. 5 özellik doğru cevaplarla dersinden beslenir. Seviye 10/25/50'de evrim (yıldız + unvan adı), seviye atlama kutlaması (animasyonlu). "Çok Yönlü": beş özellik 50 → rozet + pelerin.
- **Seri:** günlük hedef 10 soru (öğrenci başına ayarlanabilir alan). Hedef tamamlanınca seri işlenir; boş günleri seri dondurucu (Altınla, en fazla 2) kapatır; seri kırılırsa ertesi hedefte "Seriyi geri kazan" görevi (2 kat soru) eski seriyi geri verir. Cezalandırıcı dil yok.
- **Görevler:** günde 3 (biri her zaman en zayıf kazanıma yönlendirir), haftada 4. Ödül otomatik (XP + Altın).
- **Rozetler:** 46 tanım, 40'ı bu fazda kazanılabilir (düello, klan, topluluk rozetleri ilgili fazda açılır). Bazıları unvan verir.
- **Mağaza:** yalnızca kozmetik (kostüm aksesuarı, çerçeve, arka plan, düello efekti) ve seri dondurucu; fiyat ve seviye koşulu sunucudaki katalogdan. Gerçek para yok, rastgele sandık yok.
- **Lig:** haftalık XP ligi, dershane içi, aynı kademede en fazla 30 kişilik gruplar (ilk XP'de otomatik katılım). Hafta sonunda (pazartesi 00:10 cron) ilk 5 yükselir, son 5 düşer (10 kişiden küçük grupta yalnızca üst üçte bir yükselir, düşen yok). 6 kademe × 3 alt kademe; 6 haftalık sezon sonunda kademeye göre Altın ve bir kademe geri.
- **Sıralamalar:** sınıf, şube, dershane, (bayrak açıksa) dershaneler arası; haftalık veya tüm zamanlar. Yalnızca takma ad, karakter, çerçeve.
- **Kart albümü:** Bronz ve üstü kazanımlar karttır; bir dersin tüm kartları → "Tam set" rozeti ve Koleksiyoncu unvanı.
- **Teknik:** 0013 (tablolar, `app.odul_ver` tek ödül noktası, `app.seri_isle`, `sistem_gorev_ilerlet`, `sistem_rozet_ver`, `sistem_satin_al`, `sistem_oyun_metrikleri`, `sistem_lig_kapat`, `lig_grubum()`, `siralama()`); katalog `packages/shared/src/oyun-katalogu.ts`; API `/api/oyun/{durum,karakter,satin-al,kusan}`; cevap yanıtında `oyun` alanı (görev, rozet, seri). Oyun katmanında bir hata cevabı bozmaz.
- **KMYAI hız sınırı (0016):** platform geneli sıra, istekler arası en az 3 sn (`uygulama_ayari.ai_istek_araligi_ms`), örnek başına tek istek, 2 ardışık 5xx/429'da 5 dk bekleme, cron 10 dakikada en fazla 4 soru.

### Canlı test (2026-11-13)

| Kontrol | Sonuç |
|---|---|
| İlk açılışta 3 günlük + 4 haftalık görev, biri zayıf konu | ✔ |
| İlk soru → "İlk adım" rozeti + 20 Altın | ✔ |
| Karakter seçimi; sahip olunmayan eşyayı kuşanma | ✔ / 403 |
| Altın yetmeden satın alma | 409 |
| LGS öğrencisinin YKS dersi istemesi | 403 |
| Doğru cevap → XP → lig grubuna otomatik katılım, sıralamada görünme | ✔ |
| Dershaneler arası sıralama (bayrak kapalı) | reddedildi ✔ |
| Çok hızlı doğru cevap | XP yok, görev ilerlemesi var (bilinçli) |

### Elle test adımları

1. Mobil: `ogrenci12@demo.kmyarena.demo` → Arena → "Karakterini seç" → bir karakter.
2. Soru çöz → sonuç kartında "İlk adım" rozeti; Arena'da görev ilerlemesi ve günlük hedef çubuğu.
3. 10 soru → "Günlük hedef tamam", seri 1.
4. Lig → kendi grubun; Sınıf/Şube/Dershane sekmeleri.
5. Mağaza → (yeterli Altın varsa) çerçeve al → Kuşan → avatar çerçevesi değişir.
6. Rozetler ve Kart albümü ekranları.

### Bilinçli kapsam dışı (sonraki fazlar)

- Canlı Soru Saati ve Hızlı Tur → Faz 3; birlikte çalışma odası, "geçen haftaki sen" grafiği, haftalık gelişim kartı, tematik etkinlikler, akıllı geri dönüş bildirimleri, 45 dk mola önerisi → Faz 5-7; dershanenin tanımladığı gerçek sezon ödülleri → Faz 6 (dershane paneli); ekonomi değerlerinin panelden düzenlenmesi → Faz 6.

## Faz 3 — Düello ve Canlı Soru Saati (2026-11-13)

**Veritabanı (0017_duello.sql):** `duello`, `duello_tur`, `duello_kuyruk`, `duello_inceleme`, `canli_oturum`, `canli_cevap`. Tüm durum değişiklikleri `sistem_duello_*` / `sistem_canli_*` (SECURITY DEFINER, yalnız service_role) üzerinden. Sunucusuz durum makinesi: her istekte `app.duello_ilerlet` süresi dolan turları kapatır (cron gerekmez).

**Kurallar:** 5 tur; tur açılışı sunucu saatine göre planlanır, soru metni açılış anına kadar gönderilmez, cevap anahtarı tur kapanmadan hiçbir yanıtta yok. Adil süre = alış − min(RTT/2, 250 ms). İlk doğru turu alır, yanlış cevap oyuncuyu o turda kilitler. Tur arası 8 sn. 15 sn kopma turu kaybettirir, ikinci kopma hükmen yenilgi. Derecelide sekme/arka plan değişimi turu kaybettirir. Kupa Elo (K=32, asenkronda yarım), aynı rakiple tekrarlı Kupa aktarımı tespiti, insanüstü hız → inceleme listesi. 3 galibiyet serisi +50 Altın; düello rozetleri açıldı.

**Modlar:** dereceli kuyruk (±150 → ±300 Kupa → şubeler arası), arkadaş daveti (6 haneli kod), robot (ekranda açıkça "Robot"), asenkron (24 saat), rövanş, 8 hazır tepki.

**Canlı Soru Saati:** dershane ayarındaki saatte (varsayılan 19:30) 5 soru × 60 sn; ilk 10 doğru bonus XP/Altın, şube sıralaması. Yönetim: `POST /api/canli/baslat {dershaneId}` (CRON_SECRET veya kurucu/öğretmen) 1 dk sonra başlatır.

**API:** `/api/duello/{kuyruk,kuyruktan-cik,robot,davet,katil,asenkron,durum,cevap,sekme,tepki,rovans,gecmis}`, `/api/canli/{durum,cevap,baslat}`. Supabase Realtime `duello:{id}` kanalına veri içermeyen dürtü + 1 sn yoklama yedeği.

**Mobil:** Düello sekmesi (modlar, ders seçimi, geçmiş), `duello/[id]` oyun ekranı (sunucu saat senkronu), `canli` ekranı ve Arena kartı.

**Canlı doğrulama:** iki cihazda soruyu görme farkı 22 ms (hedef ≤300 ms); ilk doğru kuralı, tepki, robot, dereceli eşleşme, sekme uyarısı, Canlı Soru Saati cevap/409 çalışıyor; anahtar açık turda `null`.

**Elle test:** iki demo öğrenciyle (ör. ogrenci06/07, 8. sınıf) giriş → Düello → biri "Davet et", diğeri kodla katılır.

## Faz 4 — Klanlar (2026-11-13)

**Veritabanı (0018_klan.sql):** `klan`, `klan_uyelik` (öğrenci başına tek klan), `klan_basvuru` (başvuru + davet), `klan_gorev`, `boss`, `boss_hasar`, `klan_savasi`, `klan_savas_katki`, `klan_mesaj`, `sikayet`. İstemci hiçbir klan tablosuna yazamaz; tüm işlemler `sistem_klan_*` (service_role).

**Kurallar:**
- Kurma: karakter seviyesi 5 + son 7 günde 50 soru; 30 üye sınırı; ad/slogan filtreden geçer (dershane `ayarlar.klan_onayi = true` ise öğretmen onayı beklenir, klan bu sırada çalışır). Amblem hazır parçalardan (kalkan, simge, renk), bazı parçalar klan seviyesiyle açılır.
- Roller: Lider, en fazla 3 Yardımcı, Üye. Lider 14 gün pasifse (Perşembe cron'unda ve lider ayrılınca) en aktif yardımcıya devredilir. Son üye ayrılınca klan silinir.
- Katkı: her sayılan cevap +1 (klan seviyesi: 100 → 2, 400 → 3, 900 → 4 …).
- Haftalık görevler: "klan olarak üye×50 soru" (100 Altın) ve "her üye 30 soru" (150 Altın), tamamlanınca tüm üyelere.
- Boss: her hafta klanın ortalama en zayıf kazanımından; can = üye×60 (en az 300). Hasar = zorluk × ilgili özellik seviyesi. Yenilince hasar veren herkese 50 XP + 60 Altın.
- Klan savaşı: Perşembe 09:00 eşleşme (aktif üye + ortalama beceri), Cuma 18:00 – Pazar 21:00. 5 bölge (ders grupları), üye başına 30 hak, doğru cevap etkisi 10 × (1 + (1 − E)) (Strateji seviyesiyle en fazla +%10). Katılım çarpanı (%50 altı ×0,8 · %80+ ×1,2 · %100 ×1,3). Çok bölge alan kazanır (eşitlikte toplam puan). Kazanan: klana +30 Kupa, katılan üyelere +10 Kupa, 50 XP, 80 Altın; kaybeden/berabere: hak başına 3 XP.
- Sohbet: hazır mesajlar ve "Şu soruda takıldım" (yalnız görülen soru, cevapsız); serbest yazışma `klan_sohbeti_serbest` bayrağıyla, filtre (küfür, telefon/e-posta/sosyal medya, bağlantı). Hız sınırı 3 sn / saatte 30. Şikâyet: zorbalık öncelikli; 3 şikâyette mesaj gizlenir. DM yok.

**API:** `/api/klan/{durum,kur,katil,ayril,basvuru-yanit,davet,yonet,mesajlar,mesaj,sikayet,onay}`; cevap sonrası `sistem_klan_katki` (cevabı asla bozmaz). Cron: `klan-savas-esle` (Per 09:00), `klan-savas-kapat` (Paz 21:05); elle `klan-savas-hemen` (demo).

**Mobil:** Klan sekmesi (klansız: kur/katıl/davetler; üye: amblem, seviye, boss, savaş haritası ve bölgeye saldır, görevler, üyeler ve rol işlemleri, başvurular, davet), klan sohbeti ekranı, soru sonucunda klan etkisi ve "Klanıma sor".

**Demo:** `03_klan_demo.sql` — Kartallar, Yıldızlar, Fırtına, Bilgeler (7'şer üye). Tekrar çalıştırılabilir; workflow'da `seed_dosya` girdisiyle tek başına yüklenebilir.

**Canlı doğrulama:** küfürlü ad 400, koşulsuz kurma 409, açık klana katılım + rozet, başvuru → lider onayı, davetli klana davetsiz katılım 409, hazır mesaj, serbest kapalı 409, savaş eşleşmesi (2 savaş), cevap sonrası savaş etkisi 12,52 ve hak düşüşü, görev ilerlemesi.

**Elle test:** ogrenci01 (Kartallar lideri) ile giriş → Klan → Sohbet; ogrenci15 ile giriş → Klan → Kartallar'a katıl.
