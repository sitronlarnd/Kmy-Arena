# Değişiklik notları

## Faz planı

| Faz | Kapsam | Durum |
|---|---|---|
| 0 | Altyapı: monorepo, uygulama iskeletleri, Supabase şema + RLS + RBAC, davet kodu, özellik bayrakları, seed, CI | **Tamamlandı** |
| 1 | Çekirdek soru döngüsü: üretim + doğrulama hattı, havuz, soru ekranı (LaTeX), Elo, tespit sınavı, XP/Altın, çözüm, hata defteri, konu haritası, AI Merkezi temel | **Tamamlandı** |
| 2 | Oyun katmanı: karakter, seri, görevler, 40 rozet, mağaza, lig, sıralamalar, kart albümü | |
| 3 | Düello ve Canlı Soru Saati (Supabase Realtime) | |
| 4 | Klanlar, boss, klan savaşı | |
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
