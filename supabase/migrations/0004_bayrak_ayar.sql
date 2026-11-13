-- ─────────────────────────────────────────────────────────────
-- 0004 · Özellik bayrakları, AI görev ayarları, prompt ve oyun ayarı sürümleri,
--        uygulama (sürüm/bakım) ayarı
-- ─────────────────────────────────────────────────────────────

create table public.ozellik_bayragi (
  id uuid primary key default gen_random_uuid(),
  kod text not null,
  dershane_id uuid references public.dershane (id) on delete cascade, -- null = genel
  acik boolean not null default true,
  yuzde smallint not null default 100 check (yuzde between 0 and 100),
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  unique nulls not distinct (kod, dershane_id)
);
select app.guncelleme_tetikleyicisi_ekle('public.ozellik_bayragi');

-- Koddaki varsayılanlar (packages/shared/src/ozellik-bayraklari.ts → OZELLIK_KODLARI)
insert into public.ozellik_bayragi (kod, acik, yuzde) values
  ('duello', true, 100),
  ('klan_savasi', true, 100),
  ('topluluk', true, 100),
  ('fotograftan_coz', true, 100),
  ('dershaneler_arasi_lig', false, 100),
  ('canli_soru_saati', true, 100),
  ('asistan', true, 100),
  ('veli_raporu', true, 100),
  ('klan_sohbeti_serbest', false, 100);

/** Öncelik: dershane kaydı > paket özellik seti > genel kayıt (yüzde ile) > kapalı */
create or replace function app.ozellik_acik_mi(p_kod text, p_dershane uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ozel boolean;
  v_paket jsonb;
  v_genel record;
begin
  select b.acik into v_ozel from public.ozellik_bayragi b where b.kod = p_kod and b.dershane_id = p_dershane;
  if found then return v_ozel; end if;

  select p.ozellikler -> p_kod into v_paket
  from public.dershane d join public.paket p on p.id = d.paket_id
  where d.id = p_dershane;
  if v_paket is not null and jsonb_typeof(v_paket) = 'boolean' then return v_paket::boolean; end if;

  select b.acik, b.yuzde into v_genel from public.ozellik_bayragi b where b.kod = p_kod and b.dershane_id is null;
  if found then
    return v_genel.acik and app.kova(p_kod || ':' || p_dershane::text) < v_genel.yuzde;
  end if;
  return false;
end;
$$;

/** İstemci: kendi dershanesinin açık özellikleri. */
create or replace function public.ozelliklerim()
returns table (kod text, acik boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select k.kod, app.ozellik_acik_mi(k.kod, app.dershane_id())
  from (select distinct b.kod from public.ozellik_bayragi b) k
  where app.dershane_id() is not null
$$;

-- ── AI Merkezi: görev bazlı model ayarları (taslak → yayın, sürümlü) ──
create table public.ai_gorev_ayari (
  id uuid primary key default gen_random_uuid(),
  gorev text not null check (gorev in (
    'soru_uretim', 'soru_dogrulama', 'asistan', 'gorsel_okuma',
    'topluluk_degerlendirme', 'moderasyon', 'veli_raporu', 'ogretmen_soru_uretim')),
  kapsam text not null default 'genel' check (kapsam in ('genel', 'paket', 'dershane')),
  kapsam_id uuid, -- paket.id veya dershane.id
  model_birincil text not null,
  model_yedek text,
  sicaklik numeric(3, 2),
  max_token integer,
  zaman_asimi_ms integer,
  yeniden_deneme smallint,
  surum integer not null default 1,
  durum text not null default 'taslak' check (durum in ('taslak', 'yayinda', 'arsiv')),
  yayinlayan uuid references public.kullanici (id) on delete set null,
  yayin_tarihi timestamptz,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  check ((kapsam = 'genel') = (kapsam_id is null))
);
select app.guncelleme_tetikleyicisi_ekle('public.ai_gorev_ayari');
-- Her (görev, kapsam) için en fazla bir yayındaki ayar
create unique index ai_gorev_ayari_tek_yayin
  on public.ai_gorev_ayari (gorev, kapsam, coalesce(kapsam_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where durum = 'yayinda';

-- Kararlaştırılan başlangıç modelleri (karar #4). Merkez Panelden değiştirilir.
insert into public.ai_gorev_ayari (gorev, model_birincil, model_yedek, sicaklik, max_token, zaman_asimi_ms, yeniden_deneme, durum, yayin_tarihi) values
  ('soru_uretim',            'claude-sonnet-4-6', 'claude-haiku-4-5',  0.80, 1800, 20000, 2, 'yayinda', now()),
  ('soru_dogrulama',         'claude-sonnet-5-5', 'claude-sonnet-4-6', 0.00, 1200, 20000, 2, 'yayinda', now()),
  ('asistan',                'claude-sonnet-4-6', 'claude-haiku-4-5',  0.40,  900, 30000, 2, 'yayinda', now()),
  ('gorsel_okuma',           'claude-sonnet-4-6', 'claude-haiku-4-5',  0.00, 1500, 30000, 2, 'yayinda', now()),
  ('topluluk_degerlendirme', 'claude-haiku-4-5',  'claude-sonnet-4-6', 0.00,  400, 20000, 2, 'yayinda', now()),
  ('moderasyon',             'claude-haiku-4-5',  'claude-sonnet-4-6', 0.00,  200, 20000, 2, 'yayinda', now()),
  ('veli_raporu',            'claude-sonnet-4-6', 'claude-haiku-4-5',  0.50,  600, 30000, 2, 'yayinda', now()),
  ('ogretmen_soru_uretim',   'claude-sonnet-5-5', 'claude-sonnet-4-6', 0.70, 1800, 30000, 2, 'yayinda', now());

create table public.prompt_surumu (
  id uuid primary key default gen_random_uuid(),
  gorev text not null,
  surum text not null,
  metin text not null,
  durum text not null default 'taslak' check (durum in ('taslak', 'aktif', 'arsiv')),
  yayinlayan uuid references public.kullanici (id) on delete set null,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  unique (gorev, surum)
);
select app.guncelleme_tetikleyicisi_ekle('public.prompt_surumu');
create unique index prompt_surumu_tek_aktif on public.prompt_surumu (gorev) where durum = 'aktif';

create table public.oyun_ayari_surumu (
  id uuid primary key default gen_random_uuid(),
  ayarlar jsonb not null default '{}'::jsonb, -- OYUN_AYARLARI üzerine yazılan kısmi değerler
  durum text not null default 'taslak' check (durum in ('taslak', 'yayinda', 'arsiv')),
  yayin_tarihi timestamptz,
  yayinlayan uuid references public.kullanici (id) on delete set null,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
select app.guncelleme_tetikleyicisi_ekle('public.oyun_ayari_surumu');
create unique index oyun_ayari_tek_yayin on public.oyun_ayari_surumu ((true)) where durum = 'yayinda';

create table public.uygulama_ayari (
  id boolean primary key default true check (id), -- tek satır
  min_surum text not null default '0.1.0',
  bakim_modu boolean not null default false,
  bakim_mesaji text,
  guncelleme timestamptz not null default now()
);
insert into public.uygulama_ayari default values;
