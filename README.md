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
2. Migration'ları uygula: `supabase link --project-ref <ref>` → `supabase db push`
3. Müfredatı yükle: `psql "$DATABASE_URL" -f supabase/seed/01_mufredat.sql`
4. Yalnızca demo projesinde: `psql "$DATABASE_URL" -f supabase/seed/02_demo.sql`
5. Auth → URL Configuration'a panel ve web adreslerini ekle.

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
| kmy-arena-panel | `apps/panel` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| kmy-arena-api | `apps/api` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `KMYAI_*`, `CRON_SECRET`, `RESEND_API_KEY`, `SAHIP_EPOSTA` |
| kmy-arena-web | `apps/mobile` | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL` |
| kmy-arena-tanitim | `apps/landing` | — |

Fonksiyon bölgesi `fra1` (Frankfurt) — veritabanıyla aynı bölge. Mobil derlemeler Vercel'de değil, EAS Build'de alınır (`eas build --profile magaza`).

## Demo hesapları (yalnızca `02_demo.sql` yüklenen ortamda)

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

Davet kodları: `DEMA8AKD` (8-A öğrenci), `DEMTYTKD` (12-SAY öğrenci), `DEMHCRTM` (öğretmen).

## Güvenlik ilkeleri (özet)

- Gizli anahtarlar (KMYAI, Supabase service role) yalnızca sunucuda; istemcide yalnızca anon anahtar.
- Tenant ayrımı veritabanında (RLS); puan/XP/beceri/cevap istemciden yazılamaz; öğrenci soru tablosunu (cevap anahtarı) okuyamaz.
- KMYAI'ye kişisel veri gitmez: istemci kişisel değer içeren isteği göndermeden reddeder.
