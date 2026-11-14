# KMY Arena

Dershaneler için AI destekli, oyunlaştırılmış soru çözme platformu (B2B2C).
Tek kod tabanı: iOS, Android, web (Expo) + yönetim panelleri ve API (Next.js) +
Supabase (Postgres, Auth, Storage, Realtime). Tüm AI işleri KMYAI üzerinden,
yalnızca Claude modelleriyle yürür.

> Durum: **Faz 0 (Altyapı)**. Faz planı ve teslim notları için `docs/DEGISIKLIKLER.md`.

## Depo yapısı

```
apps/
  mobile/    Expo + Expo Router — öğrenci uygulaması (iOS, Android, web)
  panel/     Next.js — /merkez (Süper Admin), /dershane (kurucu), /ogretmen
  api/       Next.js route handler'ları — API, Vercel Cron işleri
  landing/   Next.js — dershanelere tanıtım ve 30 gün pilot sayfası
packages/
  shared/    Tipler, oyun-ayarlari.ts, formüller (Elo, XP, ustalık, kalibrasyon),
             RBAC matrisi, özellik bayrakları, soru havuzu politikası, i18n (tr)
  ai/        KmyaiIstemci (zaman aşımı, yeniden deneme, yedek model, log),
             görev/model ayarları, kişisel veri filtresi
  realtime/  Gerçek zamanlı katman soyutlaması (Supabase → ileride özel sunucu)
supabase/
  migrations/  Şema, RLS, RBAC, davet akışı
  seed/        01_mufredat.sql (JSON'dan üretilir), 02_demo.sql (yalnızca demo)
  tests/       Yerel Supabase taklidi + RLS/yetki testleri
seed/mufredat/ Müfredat kaynağı (JSON, düzenlenebilir)
scripts/       db-test.sh, dogrula-cekirdek.sh, mufredat-sql.ts
docs/          VARSAYIMLAR, MIMARI, DEGISIKLIKLER, KVKK
```

## Kurulum

Gerekenler: Node 22.13+, pnpm 10, (veritabanı testleri için) PostgreSQL 16 veya Docker.

```bash
pnpm install
pnpm --filter @kmy/mobile surumleri-duzelt   # Expo SDK 57 ile uyumlu sürümleri sabitler (ilk kurulumda bir kez)
cp .env.example .env                          # değerleri doldur; KMYAI_API_KEY'i sen girersin
```

### Supabase

1. Supabase Cloud'da **Frankfurt (eu-central-1)** bölgesinde proje aç.
2. Migration + seed: GitHub → Actions → **Supabase'e yükle** → Run workflow (gizli değer `SUPABASE_DB_URL` = Connect → Session pooler adresi). Yerelden: `SUPABASE_DB_URL=... bash scripts/db-yukle.sh [--seed]`. Uygulanan migration'lar `kmy_migration` tablosunda tutulur; yeni migration gelince aynı işi yeniden çalıştır.
3. `--seed` / "Demo verilerini de yükle" yalnızca demo projesinde (demo hesaplar içerir).
4. Auth → URL Configuration'a panel ve web adreslerini ekle.

`supabase/tests/00_supabase_yerel_taklit.sql` **yalnızca yerel testler içindir**, gerçek Supabase'de çalıştırma.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `pnpm dev` | Tüm uygulamaları geliştirme modunda açar (mobile 8081, panel 3000, api 3001, landing 3002) |
| `pnpm dogrula` | Lint + tip kontrolü + birim testleri + veritabanı testleri |
| `pnpm dogrula:cekirdek` | Bağımlılık yüklemeden çalışabilen kısım (paket tipleri, testler, DB testleri) |
| `pnpm db:test` | Temiz Postgres 16'da migration + seed + RLS testleri (yerelde geçici küme açar) |
| `pnpm tsx scripts/mufredat-sql.ts` | `seed/mufredat/*.json` → `supabase/seed/01_mufredat.sql` |
| `pnpm build` | Tüm web derlemeleri (Expo web çıktısı dahil) |

## Vercel (Pro)

Aynı depodan 4 proje; her birinde **Root Directory** farklı, gerisi `vercel.json`'dan gelir:

| Proje | Root Directory | Ortam değişkenleri |
|---|---|---|
| kmy-arena-panel | `apps/panel` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_API_URL` |
| kmy-arena-api | `apps/api` | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `KMYAI_*`, `CRON_SECRET`, `RESEND_API_KEY`, `SAHIP_EPOSTA` |
| kmy-arena-web | `apps/mobile` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL` |
| kmy-arena-tanitim | `apps/landing` | — |

API'nin zamanlanmış işleri (`apps/api/vercel.json`): `havuz-doldur` her 10 dakikada (soru havuzunu doldurur), `kalibrasyon` her gece (20+ cevaplı soruların gerçek zorluğu), `cevap-bolumu` her ayın 25'i.

Fonksiyon bölgesi `fra1` (Frankfurt) — veritabanıyla aynı bölge. Mobil derlemeler Vercel'de değil, EAS Build'de alınır (`eas build --profile magaza`).

## Canlı ortam (2026-11-14'ten beri)

Canlı veritabanında demo verisi **yoktur** (`supabase/yayin/01_demo_kaldir_inceleme.sql`). Yalnızca:

- Merkez sahibi `sahip@kmyarena.demo` (şifre yenilendi, proje sahibinde).
- Mağaza incelemesi için **KMY Arena İnceleme** dershanesi: `ogrenci@`, `yks@`, `veli@`, `ogretmen@`, `kurucu@inceleme.kmyarena.app` ve 6 sınıf arkadaşı (`sinif1-6@…`). Ortak şifre proje sahibinde; davet kodu `KMYARENA`.

## Demo hesapları (yalnızca yerel / test ortamında, `02_demo.sql`)

Şifre hepsi için `KmyDemo!2026`.

| Rol | E-posta |
|---|---|
| Merkez sahibi | `sahip@kmyarena.demo` |
| Kurucu | `kurucu@demo.kmyarena.demo` |
| Şube müdürü (Kadıköy / Üsküdar) | `mudur.kadikoy@…`, `mudur.uskudar@demo.kmyarena.demo` |
| Rehber öğretmen | `rehber@demo.kmyarena.demo` |
| Öğretmen | `ogretmen.mat@…`, `ogretmen.fen@…`, `ogretmen.tr@demo.kmyarena.demo` |
| Sekreter | `sekreter@demo.kmyarena.demo` |
| Öğrenci | `ogrenci01@…` – `ogrenci40@demo.kmyarena.demo` |
| Veli | `veli01@demo.kmyarena.demo` |

Sınıflar: `ogrenci01-10` Kadıköy 8-A (LGS), `11-20` 12-SAY (YKS), `21-30` Üsküdar 8-B (LGS), `31-40` 12-EA (YKS). `03_klan_demo.sql` ile Kartallar, Yıldızlar, Fırtına ve Bilgeler klanları (7'şer üye; ogrenci01 Kartallar lideri) eklenir.

Davet kodları: `DEMA8AKD` (8-A öğrenci), `DEMTYTKD` (12-SAY öğrenci), `DEMHCRTM` (öğretmen).

## Uygulamalar

| Uygulama | Adres | Kim |
|---|---|---|
| Mobil (iOS/Android/Web) | Expo, `apps/mobile` | Öğrenci, veli |
| Öğretmen paneli | `panel/ogretmen` | Öğretmen |
| Dershane paneli | `panel/dershane` | Kurucu, müdür, rehber |
| Merkez paneli | `panel/merkez` | Sahip ve ekip (müfredat, AI, bayraklar, dershaneler, teklifler, pilot raporu) |
| Tanıtım sitesi | `apps/landing` | Dershane yöneticileri (teklif / 30 gün pilot formu → Merkez › Teklifler) |

## Mağaza derlemesi (EAS)

1. `npm i -g eas-cli && eas login` (Expo hesabı).
2. `cd apps/mobile && eas init` — proje kimliği `app.json`'a yazılır. Paket kimliği `cloud.kmyai.arena`.
3. EAS ortam değişkenleri: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_API_URL` (gizli anahtar **asla** `EXPO_PUBLIC_` olmaz).
4. İç test: `eas build -p android --profile onizleme` (APK) / `eas build -p ios --profile onizleme`.
5. Mağaza: `eas build -p all --profile magaza`, ardından `eas submit -p ios --profile magaza` ve `eas submit -p android --profile magaza`.
6. Mağaza metinleri, ekran görüntüsü listesi ve inceleme notları: `docs/MAGAZA.md`.

## Güvenlik ilkeleri (özet)

- Gizli anahtarlar (KMYAI, Supabase service role) yalnızca sunucuda; istemcide yalnızca anon anahtar.
- Tenant ayrımı veritabanında (RLS); puan/XP/beceri/cevap istemciden yazılamaz; öğrenci soru tablosunu (cevap anahtarı) okuyamaz.
- KMYAI'ye kişisel veri gitmez: istemci kişisel değer içeren isteği göndermeden reddeder.
