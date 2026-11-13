-- ─────────────────────────────────────────────────────────────
-- 0005 · Müfredat, beceri, SORU HAVUZU, cevap, AI log, denetim, teklif
-- ─────────────────────────────────────────────────────────────

-- ── Müfredat (platform geneli; seed/mufredat/*.json kaynağıdır) ──
create table public.ders (
  id uuid primary key default gen_random_uuid(),
  kod text not null unique,              -- ör. lgs_matematik
  ad text not null,
  sinav_turu text not null check (sinav_turu in ('LGS', 'TYT', 'AYT', 'YDT')),
  ozellik text not null check (ozellik in ('zeka', 'enerji', 'bilgelik', 'strateji', 'ceviklik')),
  sira smallint not null default 0,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
select app.guncelleme_tetikleyicisi_ekle('public.ders');

create table public.unite (
  id uuid primary key default gen_random_uuid(),
  ders_id uuid not null references public.ders (id) on delete cascade,
  kod text not null unique,
  ad text not null,
  sinif_duzeyi smallint not null,
  sira smallint not null default 0,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
select app.guncelleme_tetikleyicisi_ekle('public.unite');

create table public.kazanim (
  id uuid primary key default gen_random_uuid(),
  unite_id uuid not null references public.unite (id) on delete cascade,
  kod text not null unique,              -- ör. M.8.1.2.3
  aciklama text not null,
  sinif_duzeyi smallint not null,
  sinav_turu text not null check (sinav_turu in ('LGS', 'TYT', 'AYT', 'YDT')),
  on_kosullar uuid[] not null default '{}',
  soru_tipi_agirliklari jsonb not null default '{}'::jsonb,
  sira smallint not null default 0,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
select app.guncelleme_tetikleyicisi_ekle('public.kazanim');

-- ── Adaptif motor: kazanım bazlı beceri (yalnızca sunucu yazar) ──
create table public.beceri (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  kazanim_id uuid not null references public.kazanim (id) on delete cascade,
  theta numeric(7, 2) not null default 1000,
  cozulen integer not null default 0,
  dogru integer not null default 0,
  son10 smallint[] not null default '{}', -- 1 doğru, 0 yanlış/boş
  ustalik text not null default 'kesfedilmedi' check (ustalik in ('kesfedilmedi', 'bronz', 'gumus', 'altin')),
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  unique (kullanici_id, kazanim_id)
);
select app.guncelleme_tetikleyicisi_ekle('public.beceri');

-- ── SORU HAVUZU (karar #1) ──
-- AI soruları platform geneli havuzdur (dershane_id null) ve farklı
-- öğrencilere tekrar sunulur. Öğretmen soruları dershaneye aittir.
-- Öğrenciler bu tabloyu DOĞRUDAN OKUYAMAZ (cevap anahtarı burada);
-- sorular API üzerinden, 'dogru' ve çözüm alanları çıkarılarak sunulur.
create table public.soru (
  id uuid primary key default gen_random_uuid(),
  kaynak text not null check (kaynak in ('ai', 'ogretmen')),
  dershane_id uuid references public.dershane (id) on delete cascade,
  ogretmen_id uuid references public.kullanici (id) on delete set null,
  kazanim_id uuid not null references public.kazanim (id),
  sinav_turu text not null check (sinav_turu in ('LGS', 'TYT', 'AYT', 'YDT')),
  soru_tipi text not null,
  zorluk numeric(3, 1) not null check (zorluk between 1 and 10),      -- üreticinin hedefi
  olculmus_zorluk numeric(3, 1) check (olculmus_zorluk between 1 and 10), -- 20+ cevapla kalibre
  zorluk_bandi smallint generated always as (ceil(least(greatest(round(coalesce(olculmus_zorluk, zorluk)), 1), 10) / 2.0)::smallint) stored,
  tahmini_sure_sn smallint not null default 60,
  govde_md text not null,
  gorsel jsonb,
  siklar jsonb not null,
  dogru char(1) not null check (dogru in ('A', 'B', 'C', 'D', 'E')),
  cozum_adimlari jsonb not null default '[]'::jsonb,
  celdirici_notlari jsonb not null default '{}'::jsonb,
  ipuclari jsonb not null default '[]'::jsonb,
  prompt_surumu text,
  uretici_model text,
  dogrulayici_model text,
  durum text not null default 'uretildi' check (durum in ('uretildi', 'dogrulandi', 'reddedildi', 'emekli')),
  red_nedeni text,
  -- Havuz istatistikleri (sunucu fonksiyonları günceller)
  gosterim_sayisi integer not null default 0,
  duello_kullanim integer not null default 0,
  cevap_sayisi integer not null default 0,
  dogru_sayisi integer not null default 0,
  hata_bildirim_sayisi integer not null default 0,
  son_gosterim timestamptz,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  check ((kaynak = 'ai') = (dershane_id is null))
);
select app.guncelleme_tetikleyicisi_ekle('public.soru');
create index soru_havuz_secim on public.soru (kazanim_id, zorluk_bandi, gosterim_sayisi)
  where durum = 'dogrulandi';
create index soru_duello_taze on public.soru (kazanim_id, zorluk_bandi)
  where durum = 'dogrulandi' and duello_kullanim = 0;

-- "Aynı öğrenci aynı soruyu asla iki kez görmez" garantisi: birincil anahtar.
create table public.soru_gosterim (
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  soru_id uuid not null references public.soru (id) on delete cascade,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  baglam text not null,
  olusturma timestamptz not null default now(),
  primary key (kullanici_id, soru_id)
);
create index soru_gosterim_soru on public.soru_gosterim (soru_id);

-- ── Cevap: en çok yazılan tablo; aylık bölümlenmiş ──
create table public.cevap (
  id uuid not null default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  soru_id uuid not null references public.soru (id),
  kazanim_id uuid not null references public.kazanim (id),
  baglam text not null check (baglam in ('antrenman', 'tespit', 'duello', 'klan', 'odev', 'deneme', 'topluluk', 'canli', 'tekrar')),
  secilen char(1) check (secilen in ('A', 'B', 'C', 'D', 'E')), -- null = boş
  dogru_mu boolean not null,
  sure_ms integer not null check (sure_ms >= 0),
  ipucu_sayisi smallint not null default 0,
  theta_once numeric(7, 2),
  theta_sonra numeric(7, 2),
  beklenen numeric(4, 3),
  xp integer not null default 0,
  altin integer not null default 0,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  primary key (id, olusturma)
) partition by range (olusturma);
create index cevap_kullanici_olusturma on public.cevap (kullanici_id, olusturma desc);
create index cevap_soru on public.cevap (soru_id);
create index cevap_dershane_olusturma on public.cevap (dershane_id, olusturma);

/** Verilen ayın bölümünü oluşturur (varsa dokunmaz). pg_cron ile her ay çağrılır. */
create or replace function app.cevap_bolumu_olustur(p_ay date)
returns text
language plpgsql
set search_path = ''
as $$
declare
  bas date := date_trunc('month', p_ay)::date;
  ad text := format('cevap_%s', to_char(bas, 'YYYY_MM'));
begin
  if to_regclass('public.' || ad) is null then
    execute format(
      'create table public.%I partition of public.cevap for values from (%L) to (%L)',
      ad, bas, (bas + interval '1 month')::date
    );
  end if;
  return ad;
end;
$$;

create table public.cevap_varsayilan partition of public.cevap default;
select app.cevap_bolumu_olustur((date_trunc('month', now()) + make_interval(months => m))::date)
from generate_series(-2, 2) as m;

-- ── AI çağrı logu (maliyet) ──
create table public.ai_cagri_log (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid references public.dershane (id) on delete set null,
  kullanici_id uuid references public.kullanici (id) on delete set null,
  amac text not null,
  model text not null,
  token_giris integer not null default 0,
  token_cikis integer not null default 0,
  sure_ms integer not null default 0,
  basarili boolean not null,
  hata text,
  prompt_surumu text,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
create index ai_cagri_log_dershane_gun on public.ai_cagri_log (dershane_id, olusturma);

-- Dershane bazlı günlük token tüketimi (kabul kriteri)
create view public.ai_gunluk_tuketim
with (security_invoker = true) as
select dershane_id,
       (olusturma at time zone 'Europe/Istanbul')::date as gun,
       amac,
       model,
       count(*) as cagri,
       count(*) filter (where not basarili) as basarisiz,
       sum(token_giris) as token_giris,
       sum(token_cikis) as token_cikis
from public.ai_cagri_log
group by 1, 2, 3, 4;

-- ── Denetim kaydı (KVKK ve güvenlik) ──
create table public.denetim_log (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid references public.dershane (id) on delete set null,
  kullanici_id uuid references public.kullanici (id) on delete set null,
  islem text not null,
  hedef text,
  ayrinti jsonb not null default '{}'::jsonb,
  ip inet,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
create index denetim_log_dershane on public.denetim_log (dershane_id, olusturma desc);

create or replace function app.denetle(p_islem text, p_hedef text default null, p_ayrinti jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.denetim_log (dershane_id, kullanici_id, islem, hedef, ayrinti)
  values (app.dershane_id(), auth.uid(), p_islem, p_hedef, p_ayrinti)
$$;

-- ── Satış hunisi: tanıtım sitesi teklif / 30 gün pilot formu ──
create table public.teklif (
  id uuid primary key default gen_random_uuid(),
  dershane_adi text not null,
  sehir text not null,
  sube_sayisi smallint,
  ogrenci_sayisi integer,
  yetkili text not null,
  telefon text,
  eposta extensions.citext not null,
  "not" text,
  pilot_talebi boolean not null default false,
  durum text not null default 'yeni' check (durum in (
    'yeni', 'gorusuldu', 'demo_yapildi', 'pilot', 'teklif_verildi', 'kazanildi', 'kaybedildi')),
  sonraki_adim_tarihi date,
  dershane_id uuid references public.dershane (id) on delete set null, -- pilota dönüşünce
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
select app.guncelleme_tetikleyicisi_ekle('public.teklif');
