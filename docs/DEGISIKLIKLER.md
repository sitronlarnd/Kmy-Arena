# Değişiklik notları

## Faz planı

| Faz | Kapsam | Durum |
|---|---|---|
| 0 | Altyapı: monorepo, uygulama iskeletleri, Supabase şema + RLS + RBAC, davet kodu, özellik bayrakları, seed, CI | **Tamamlandı** |
| 1 | Çekirdek soru döngüsü: üretim + doğrulama hattı, havuz, soru ekranı (LaTeX), Elo, tespit sınavı, XP/Altın, çözüm, hata defteri, konu haritası, AI Merkezi temel | Sırada |
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
