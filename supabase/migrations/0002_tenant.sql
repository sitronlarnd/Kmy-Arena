-- ─────────────────────────────────────────────────────────────
-- 0002 · Çok kiracılı yapı: paket → dershane → şube → sınıf → kullanıcı
-- ─────────────────────────────────────────────────────────────

create table public.paket (
  id uuid primary key default gen_random_uuid(),
  kod text not null unique,
  ad text not null,
  ozellikler jsonb not null default '{}'::jsonb,
  ai_kotasi_token bigint not null default 0,
  ogrenci_basi_fiyat numeric(10, 2),
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
select app.guncelleme_tetikleyicisi_ekle('public.paket');

create type public.lisans_durumu as enum ('pilot', 'aktif', 'gecikmis', 'askida', 'bitti');

create table public.dershane (
  id uuid primary key default gen_random_uuid(),
  ad text not null,
  sehir text,
  logo_url text,
  ana_renk text not null default '#5B5BF0' check (ana_renk ~ '^#[0-9A-Fa-f]{6}$'),
  uygulama_ici_ad text,
  paket_id uuid references public.paket (id),
  ogrenci_limiti integer not null default 50 check (ogrenci_limiti > 0),
  lisans_durumu public.lisans_durumu not null default 'pilot',
  lisans_baslangic date not null default current_date,
  lisans_bitis date,
  -- Açık kayıtla gelenlerin düştüğü "bireysel deneme" tenant'ı
  bireysel boolean not null default false,
  ayarlar jsonb not null default '{}'::jsonb,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
select app.guncelleme_tetikleyicisi_ekle('public.dershane');
create unique index dershane_tek_bireysel on public.dershane (bireysel) where bireysel;

create table public.sube (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  ad text not null,
  sehir text,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  unique (dershane_id, ad)
);
select app.guncelleme_tetikleyicisi_ekle('public.sube');

create table public.sinif (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  sube_id uuid not null references public.sube (id) on delete cascade,
  ad text not null,
  sinav_turu text not null check (sinav_turu in ('LGS', 'TYT', 'AYT', 'YDT')),
  seviye smallint not null check (seviye between 5 and 13), -- 13 = mezun
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  unique (sube_id, ad)
);
select app.guncelleme_tetikleyicisi_ekle('public.sinif');

create type public.kullanici_turu as enum ('ogrenci', 'veli', 'personel', 'merkez');

-- auth.users ile 1:1. Kişisel veri minimum: TCKN, adres, okul adı yok.
create table public.kullanici (
  id uuid primary key references auth.users (id) on delete cascade,
  dershane_id uuid references public.dershane (id) on delete cascade, -- merkez ekibinde null
  sube_id uuid references public.sube (id) on delete set null,
  tur public.kullanici_turu not null,
  ad text not null,
  soyad text not null,
  -- Diğer öğrencilere görünen TEK isim
  takma_ad extensions.citext,
  dogum_yili smallint check (dogum_yili between 1940 and 2025),
  veli_onayi boolean not null default false,
  veli_onay_tarihi timestamptz,
  kvkk_onay_tarihi timestamptz,
  son_giris timestamptz,
  silinme_talebi timestamptz,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  check (tur = 'merkez' or dershane_id is not null),
  unique (dershane_id, takma_ad)
);
select app.guncelleme_tetikleyicisi_ekle('public.kullanici');
create index kullanici_dershane_sube on public.kullanici (dershane_id, sube_id);

create table public.sinif_uyelik (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  sinif_id uuid not null references public.sinif (id) on delete cascade,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  rol text not null check (rol in ('ogrenci', 'ogretmen')),
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  unique (sinif_id, kullanici_id)
);
select app.guncelleme_tetikleyicisi_ekle('public.sinif_uyelik');
create index sinif_uyelik_kullanici on public.sinif_uyelik (kullanici_id);

create table public.veli_bag (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  veli_id uuid not null references public.kullanici (id) on delete cascade,
  ogrenci_id uuid not null references public.kullanici (id) on delete cascade,
  onay_tarihi timestamptz,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  unique (veli_id, ogrenci_id)
);
select app.guncelleme_tetikleyicisi_ekle('public.veli_bag');

-- Dershanenin dağıttığı davet kodları (öğrenci, personel veya veli için)
create table public.davet_kodu (
  kod text primary key check (kod ~ '^[A-HJ-NP-Z2-9]{8}$'), -- karışan karakterler (I, O, 0, 1) yok
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  sube_id uuid references public.sube (id) on delete cascade,
  sinif_id uuid references public.sinif (id) on delete cascade,
  rol_kod text not null default 'ogrenci',
  max_kullanim integer not null default 1 check (max_kullanim > 0),
  kullanim integer not null default 0,
  son_gecerlilik timestamptz not null default now() + interval '30 days',
  olusturan uuid references public.kullanici (id) on delete set null,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
select app.guncelleme_tetikleyicisi_ekle('public.davet_kodu');

create or replace function app.davet_kodu_uret()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alfabe constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  sonuc text := '';
begin
  for i in 1..8 loop
    sonuc := sonuc || substr(alfabe, 1 + floor(random() * length(alfabe))::int, 1);
  end loop;
  return sonuc;
end;
$$;
