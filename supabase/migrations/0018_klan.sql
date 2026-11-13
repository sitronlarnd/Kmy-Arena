-- ─────────────────────────────────────────────────────────────
-- 0018 · Faz 4: Klanlar, haftalık klan görevi, boss savaşı, klan savaşı,
--        hazır mesajlı klan sohbeti ve şikâyet
--
-- Klanlar dershane içidir. Klanın gücü yalnızca üyelerinin çözdüğü sorulardan
-- gelir: her sayılan cevap `sistem_klan_katki` ile klan katkısına, haftalık
-- göreve, boss'a (doğru + boss kazanımı) ve savaşa (savaş penceresinde, 30 hak)
-- işlenir. İstemci hiçbir klan tablosuna yazamaz.
-- ─────────────────────────────────────────────────────────────

alter table public.ogrenci_ilerleme
  add column boss_hasar_toplam integer not null default 0,
  add column klan_savas_galibiyet integer not null default 0;

create table public.klan (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  ad extensions.citext not null check (char_length(ad::text) between 3 and 24),
  slogan text check (char_length(slogan) <= 60),
  amblem jsonb not null default '{"kalkan": "klasik", "simge": "yildiz", "renk": "#2E86AB"}'::jsonb,
  katilim_turu text not null default 'acik' check (katilim_turu in ('acik', 'basvurulu', 'davet')),
  onay_durumu text not null default 'onayli' check (onay_durumu in ('bekliyor', 'onayli', 'reddedildi')),
  seviye integer not null default 1,
  katki_toplam integer not null default 0,
  kupa integer not null default 0 check (kupa >= 0),
  lider_id uuid references public.kullanici (id) on delete set null,
  olusturan_id uuid references public.kullanici (id) on delete set null,
  olusturma timestamptz not null default now(),
  unique (dershane_id, ad)
);

-- Bir öğrenci aynı anda tek klandadır
create table public.klan_uyelik (
  kullanici_id uuid primary key references public.kullanici (id) on delete cascade,
  klan_id uuid not null references public.klan (id) on delete cascade,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  rol text not null default 'uye' check (rol in ('lider', 'yardimci', 'uye')),
  katilma timestamptz not null default now(),
  toplam_katki integer not null default 0,
  hafta date,
  haftalik_katki integer not null default 0,
  son_katki timestamptz
);
create index klan_uyelik_klan on public.klan_uyelik (klan_id);

create table public.klan_basvuru (
  id uuid primary key default gen_random_uuid(),
  klan_id uuid not null references public.klan (id) on delete cascade,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  tur text not null check (tur in ('basvuru', 'davet')),
  durum text not null default 'bekliyor' check (durum in ('bekliyor', 'kabul', 'red', 'iptal')),
  davet_eden uuid references public.kullanici (id) on delete set null,
  olusturma timestamptz not null default now()
);
create unique index klan_basvuru_tek on public.klan_basvuru (klan_id, kullanici_id, tur) where durum = 'bekliyor';
create index klan_basvuru_kullanici on public.klan_basvuru (kullanici_id) where durum = 'bekliyor';

create table public.klan_gorev (
  klan_id uuid not null references public.klan (id) on delete cascade,
  hafta date not null,
  kod text not null check (kod in ('toplam_soru', 'herkes_30')),
  hedef integer not null,
  ilerleme integer not null default 0,
  odul_altin integer not null,
  tamamlandi timestamptz,
  primary key (klan_id, hafta, kod)
);

create table public.boss (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  klan_id uuid not null references public.klan (id) on delete cascade,
  hafta date not null,
  kazanim_id uuid not null references public.kazanim (id),
  ad text not null,
  emoji text not null,
  can integer not null,
  kalan_can integer not null,
  bitis timestamptz not null,
  yenildi timestamptz,
  unique (klan_id, hafta)
);

create table public.boss_hasar (
  boss_id uuid not null references public.boss (id) on delete cascade,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  hasar integer not null default 0,
  vurus integer not null default 0,
  primary key (boss_id, kullanici_id)
);

create table public.klan_savasi (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  hafta date not null,
  klan_a uuid not null references public.klan (id) on delete cascade,
  klan_b uuid not null references public.klan (id) on delete cascade,
  baslangic timestamptz not null,
  bitis timestamptz not null,
  -- {"mat": {"a": 12.5, "b": 30}, "fen": {...}, ...} (ham hasar)
  bolge_durumu jsonb not null default '{}'::jsonb,
  puan_a numeric(10, 1),
  puan_b numeric(10, 1),
  carpan_a numeric(3, 2),
  carpan_b numeric(3, 2),
  kazanan uuid references public.klan (id) on delete set null,
  durum text not null default 'eslesti' check (durum in ('eslesti', 'bitti')),
  check (klan_a <> klan_b)
);
create unique index klan_savasi_a on public.klan_savasi (hafta, klan_a);
create unique index klan_savasi_b on public.klan_savasi (hafta, klan_b);

create table public.klan_savas_katki (
  savas_id uuid not null references public.klan_savasi (id) on delete cascade,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  klan_id uuid not null references public.klan (id) on delete cascade,
  bolge text not null check (bolge in ('mat', 'fen', 'turkce', 'sosyal', 'ingilizce')),
  hasar numeric(10, 2) not null default 0,
  kullanilan_hak integer not null default 0,
  primary key (savas_id, kullanici_id, bolge)
);

create table public.klan_mesaj (
  id bigint generated always as identity primary key,
  klan_id uuid not null references public.klan (id) on delete cascade,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  kullanici_id uuid references public.kullanici (id) on delete set null,
  tur text not null check (tur in ('hazir', 'soru', 'serbest', 'sistem')),
  kod text,
  metin text check (char_length(metin) <= 300),
  soru_id uuid references public.soru (id) on delete set null,
  gizli boolean not null default false,
  olusturma timestamptz not null default now()
);
create index klan_mesaj_klan on public.klan_mesaj (klan_id, id desc);
create index klan_mesaj_kullanici on public.klan_mesaj (kullanici_id, olusturma desc);

-- Genel şikâyet (klan sohbeti; Faz 5'te topluluk da kullanır)
create table public.sikayet (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  sikayet_eden uuid not null references public.kullanici (id) on delete cascade,
  hedef_tur text not null check (hedef_tur in ('klan_mesaj', 'klan', 'kullanici', 'topluluk_soru', 'topluluk_cevap')),
  hedef_id text not null,
  sebep text not null check (sebep in ('kufur', 'zorbalik', 'kisisel_bilgi', 'spam', 'uygunsuz', 'diger')),
  aciklama text check (char_length(aciklama) <= 500),
  oncelikli boolean not null default false,
  durum text not null default 'acik' check (durum in ('acik', 'incelendi', 'reddedildi')),
  olusturma timestamptz not null default now(),
  unique (sikayet_eden, hedef_tur, hedef_id)
);
create index sikayet_acik on public.sikayet (dershane_id, oncelikli desc, olusturma) where durum = 'acik';

-- ── RLS: istemciler klan verisini API üzerinden okur; personel denetim için okur ──
alter table public.klan enable row level security;
alter table public.klan_uyelik enable row level security;
alter table public.klan_basvuru enable row level security;
alter table public.klan_gorev enable row level security;
alter table public.boss enable row level security;
alter table public.boss_hasar enable row level security;
alter table public.klan_savasi enable row level security;
alter table public.klan_savas_katki enable row level security;
alter table public.klan_mesaj enable row level security;
alter table public.sikayet enable row level security;

create policy klan_oku on public.klan for select to authenticated
  using (dershane_id = app.dershane_id());
create policy klan_mesaj_denetim on public.klan_mesaj for select to authenticated
  using (app.yetkisi_var('moderasyon.yap', dershane_id));
create policy sikayet_denetim on public.sikayet for select to authenticated
  using (sikayet_eden = auth.uid() or app.yetkisi_var('moderasyon.yap', dershane_id));
revoke insert, update, delete on public.klan, public.klan_uyelik, public.klan_basvuru, public.klan_gorev,
  public.boss, public.boss_hasar, public.klan_savasi, public.klan_savas_katki, public.klan_mesaj, public.sikayet
  from anon, authenticated;

-- ── Yardımcılar ──

/** Klan seviyesi: toplam katkı 100 → 2, 400 → 3, 900 → 4 … (en fazla 20). */
create or replace function app.klan_seviyesi(p_katki integer)
returns integer
language sql
immutable
set search_path = ''
as $$ select least(20, 1 + floor(sqrt(greatest(p_katki, 0) / 100.0))::integer) $$;

/** Karakter özelliği puanı → seviye (1-10). Boss hasarı ve savaş çarpanında kullanılır. */
create or replace function app.ozellik_seviyesi(p_puan integer)
returns integer
language sql
immutable
set search_path = ''
as $$ select least(10, 1 + floor(sqrt(greatest(coalesce(p_puan, 0), 0) / 10.0))::integer) $$;

create or replace function app.ozellik_bolge(p_ozellik text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_ozellik
    when 'zeka' then 'mat' when 'enerji' then 'fen' when 'bilgelik' then 'turkce'
    when 'strateji' then 'sosyal' when 'ceviklik' then 'ingilizce' end
$$;

/** Katılım çarpanı: %50 altı ×0,8 · %80 ve üstü ×1,2 · %100 ×1,3 */
create or replace function app.katilim_carpani(p_katilan integer, p_uye integer)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_uye <= 0 then 1.0
    when p_katilan >= p_uye then 1.3
    when p_katilan::numeric / p_uye >= 0.8 then 1.2
    when p_katilan::numeric / p_uye < 0.5 then 0.8
    else 1.0 end
$$;

/** Liderlik devri: lider yoksa ya da 14 gündür aktif değilse en aktif yardımcıya, yoksa en aktif üyeye geçer. */
create or replace function app.klan_lider_sec(p_klan uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lider uuid;
  v_aktif boolean;
  v_yeni uuid;
begin
  select lider_id into v_lider from public.klan where id = p_klan for update;
  if not found then return null; end if;
  select coalesce(greatest(u.son_katki, k.son_giris), u.katilma) > now() - interval '14 days' into v_aktif
  from public.klan_uyelik u join public.kullanici k on k.id = u.kullanici_id
  where u.klan_id = p_klan and u.kullanici_id = v_lider;
  if v_lider is not null and coalesce(v_aktif, false) then return v_lider; end if;

  select u.kullanici_id into v_yeni
  from public.klan_uyelik u
  where u.klan_id = p_klan and u.kullanici_id is distinct from v_lider
  order by (u.rol = 'yardimci') desc, u.son_katki desc nulls last, u.toplam_katki desc, u.katilma
  limit 1;
  if v_yeni is null then return v_lider; end if;
  update public.klan_uyelik set rol = 'yardimci' where kullanici_id = v_lider and klan_id = p_klan;
  update public.klan_uyelik set rol = 'lider' where kullanici_id = v_yeni;
  update public.klan set lider_id = v_yeni where id = p_klan;
  insert into public.klan_mesaj (klan_id, dershane_id, tur, kod)
  select p_klan, dershane_id, 'sistem', 'lider_devri' from public.klan where id = p_klan;
  return v_yeni;
end;
$$;

/** Haftanın klan görevlerini ve boss'unu hazırlar (yoksa). */
create or replace function app.klan_hafta_hazirla(p_klan uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hafta date := app.hafta_basi(app.bugun());
  v_klan public.klan;
  v_uye integer;
  v_kazanim uuid;
  v_ozellik text;
  v_unite text;
begin
  if exists (select 1 from public.boss where klan_id = p_klan and hafta = v_hafta)
     and exists (select 1 from public.klan_gorev where klan_id = p_klan and hafta = v_hafta) then
    return;
  end if;
  select * into v_klan from public.klan where id = p_klan;
  if not found then return; end if;
  select count(*) into v_uye from public.klan_uyelik where klan_id = p_klan;
  v_uye := greatest(v_uye, 1);

  insert into public.klan_gorev (klan_id, hafta, kod, hedef, odul_altin) values
    (p_klan, v_hafta, 'toplam_soru', greatest(150, v_uye * 50), 100),
    (p_klan, v_hafta, 'herkes_30', v_uye, 150)
  on conflict do nothing;

  if exists (select 1 from public.boss where klan_id = p_klan and hafta = v_hafta) then return; end if;

  -- Canavar: üyelerin ortalama en zayıf olduğu kazanım (en az 2 üyenin çözdüğü)
  select b.kazanim_id into v_kazanim
  from public.beceri b join public.klan_uyelik u on u.kullanici_id = b.kullanici_id
  where u.klan_id = p_klan and b.cozulen > 0
  group by b.kazanim_id
  having count(distinct b.kullanici_id) >= least(2, v_uye)
  order by avg(b.theta), count(*) desc
  limit 1;
  -- Veri yoksa: liderin derslerinden rastgele bir kazanım
  if v_kazanim is null then
    select k.id into v_kazanim
    from public.kazanim k join public.unite un on un.id = k.unite_id
    where un.ders_id in (
      select d.id from public.klan_uyelik u, lateral public.sistem_ogrenci_dersleri(u.kullanici_id) d
      where u.klan_id = p_klan)
    order by random() limit 1;
  end if;
  if v_kazanim is null then return; end if;

  select d.ozellik, un.ad into v_ozellik, v_unite
  from public.kazanim k join public.unite un on un.id = k.unite_id join public.ders d on d.id = un.ders_id
  where k.id = v_kazanim;

  insert into public.boss (dershane_id, klan_id, hafta, kazanim_id, ad, emoji, can, kalan_can, bitis)
  values (
    v_klan.dershane_id, p_klan, v_hafta, v_kazanim,
    left(v_unite, 40) || ' ' || case v_ozellik
      when 'zeka' then 'Ejderi' when 'enerji' then 'Golemi' when 'bilgelik' then 'Sfenksi'
      when 'strateji' then 'Krakeni' else 'Grifonu' end,
    case v_ozellik when 'zeka' then '🐉' when 'enerji' then '🗿' when 'bilgelik' then '🦁'
      when 'strateji' then '🐙' else '🦅' end,
    greatest(300, v_uye * 60), greatest(300, v_uye * 60),
    (v_hafta + 7)::timestamp at time zone 'Europe/Istanbul'
  )
  on conflict do nothing;
end;
$$;

-- ── Klan kurma ve üyelik ──

create or replace function public.sistem_klan_kur(
  p_kullanici uuid, p_ad text, p_slogan text, p_amblem jsonb, p_katilim text,
  p_onay_bekle boolean, p_min_seviye integer, p_min_soru integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_k public.kullanici;
  v_seviye integer;
  v_soru integer;
  v_id uuid;
begin
  select * into v_k from public.kullanici where id = p_kullanici and tur = 'ogrenci';
  if not found then raise exception 'klan.yetkisiz'; end if;
  if exists (select 1 from public.klan_uyelik where kullanici_id = p_kullanici) then raise exception 'klan.zatenUye'; end if;
  select coalesce(seviye, 1) into v_seviye from public.ogrenci_ilerleme where kullanici_id = p_kullanici;
  if coalesce(v_seviye, 1) < p_min_seviye then raise exception 'klan.seviyeYetersiz'; end if;
  select count(*) into v_soru from public.cevap
  where kullanici_id = p_kullanici and olusturma > now() - interval '7 days';
  if v_soru < p_min_soru then raise exception 'klan.soruYetersiz'; end if;

  begin
    insert into public.klan (dershane_id, ad, slogan, amblem, katilim_turu, onay_durumu, lider_id, olusturan_id)
    values (v_k.dershane_id, trim(p_ad), nullif(trim(coalesce(p_slogan, '')), ''), p_amblem, p_katilim,
            case when p_onay_bekle then 'bekliyor' else 'onayli' end, p_kullanici, p_kullanici)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'klan.adKullaniliyor';
  end;
  insert into public.klan_uyelik (kullanici_id, klan_id, dershane_id, rol) values (p_kullanici, v_id, v_k.dershane_id, 'lider');
  update public.klan_basvuru set durum = 'iptal' where kullanici_id = p_kullanici and durum = 'bekliyor';
  insert into public.klan_mesaj (klan_id, dershane_id, kullanici_id, tur, kod) values (v_id, v_k.dershane_id, p_kullanici, 'sistem', 'kuruldu');
  perform app.klan_hafta_hazirla(v_id);
  return v_id;
end;
$$;

/** Üyeyi ekler (kapasite ve tek klan kuralı). */
create or replace function app.klan_uye_ekle(p_klan uuid, p_kullanici uuid, p_max integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_klan public.klan;
begin
  select * into v_klan from public.klan where id = p_klan for update;
  if not found or v_klan.onay_durumu = 'reddedildi' then raise exception 'klan.bulunamadi'; end if;
  if exists (select 1 from public.klan_uyelik where kullanici_id = p_kullanici) then raise exception 'klan.zatenUye'; end if;
  if (select count(*) from public.klan_uyelik where klan_id = p_klan) >= p_max then raise exception 'klan.dolu'; end if;
  insert into public.klan_uyelik (kullanici_id, klan_id, dershane_id) values (p_kullanici, p_klan, v_klan.dershane_id);
  update public.klan_basvuru set durum = 'iptal' where kullanici_id = p_kullanici and durum = 'bekliyor';
  insert into public.klan_mesaj (klan_id, dershane_id, kullanici_id, tur, kod) values (p_klan, v_klan.dershane_id, p_kullanici, 'sistem', 'katildi');
  -- "Herkes 30" hedefi yeni üyeyle büyür
  update public.klan_gorev set hedef = hedef + 1
  where klan_id = p_klan and hafta = app.hafta_basi(app.bugun()) and kod = 'herkes_30' and tamamlandi is null;
end;
$$;

create or replace function public.sistem_klan_katil(p_kullanici uuid, p_klan uuid, p_max integer)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_klan public.klan;
  v_davet uuid;
begin
  select * into v_klan from public.klan where id = p_klan;
  if not found or v_klan.dershane_id is distinct from (select dershane_id from public.kullanici where id = p_kullanici and tur = 'ogrenci')
  then raise exception 'klan.bulunamadi'; end if;
  if exists (select 1 from public.klan_uyelik where kullanici_id = p_kullanici) then raise exception 'klan.zatenUye'; end if;

  select id into v_davet from public.klan_basvuru
  where klan_id = p_klan and kullanici_id = p_kullanici and tur = 'davet' and durum = 'bekliyor';
  if v_davet is not null or v_klan.katilim_turu = 'acik' then
    perform app.klan_uye_ekle(p_klan, p_kullanici, p_max);
    update public.klan_basvuru set durum = 'kabul' where id = v_davet;
    return 'katildi';
  end if;
  if v_klan.katilim_turu = 'davet' then raise exception 'klan.davetGerekli'; end if;
  if (select count(*) from public.klan_uyelik where klan_id = p_klan) >= p_max then raise exception 'klan.dolu'; end if;
  insert into public.klan_basvuru (klan_id, kullanici_id, dershane_id, tur)
  values (p_klan, p_kullanici, v_klan.dershane_id, 'basvuru')
  on conflict do nothing;
  return 'basvuruldu';
end;
$$;

create or replace function app.klan_yoneticisi_mi(p_kullanici uuid, p_klan uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.klan_uyelik where kullanici_id = p_kullanici and klan_id = p_klan and rol in ('lider', 'yardimci'))
$$;

/** Başvuruyu (lider/yardımcı) ya da daveti (davet edilen) yanıtlar. */
create or replace function public.sistem_klan_basvuru_yanit(p_kullanici uuid, p_basvuru uuid, p_kabul boolean, p_max integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b public.klan_basvuru;
begin
  select * into v_b from public.klan_basvuru where id = p_basvuru and durum = 'bekliyor' for update;
  if not found then raise exception 'klan.basvuruYok'; end if;
  if v_b.tur = 'basvuru' and not app.klan_yoneticisi_mi(p_kullanici, v_b.klan_id) then raise exception 'klan.yetkisiz'; end if;
  if v_b.tur = 'davet' and v_b.kullanici_id <> p_kullanici then raise exception 'klan.yetkisiz'; end if;
  if p_kabul then
    perform app.klan_uye_ekle(v_b.klan_id, v_b.kullanici_id, p_max);
    update public.klan_basvuru set durum = 'kabul' where id = p_basvuru;
  else
    update public.klan_basvuru set durum = 'red' where id = p_basvuru;
  end if;
end;
$$;

create or replace function public.sistem_klan_davet(p_kullanici uuid, p_hedef uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_u public.klan_uyelik;
begin
  select * into v_u from public.klan_uyelik where kullanici_id = p_kullanici;
  if not found or v_u.rol not in ('lider', 'yardimci') then raise exception 'klan.yetkisiz'; end if;
  if not exists (select 1 from public.kullanici where id = p_hedef and tur = 'ogrenci' and dershane_id = v_u.dershane_id)
  then raise exception 'klan.kullaniciYok'; end if;
  if exists (select 1 from public.klan_uyelik where kullanici_id = p_hedef) then raise exception 'klan.hedefUye'; end if;
  insert into public.klan_basvuru (klan_id, kullanici_id, dershane_id, tur, davet_eden)
  values (v_u.klan_id, p_hedef, v_u.dershane_id, 'davet', p_kullanici)
  on conflict do nothing;
end;
$$;

create or replace function public.sistem_klan_ayril(p_kullanici uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_u public.klan_uyelik;
begin
  delete from public.klan_uyelik where kullanici_id = p_kullanici returning * into v_u;
  if not found then raise exception 'klan.uyeDegil'; end if;
  if not exists (select 1 from public.klan_uyelik where klan_id = v_u.klan_id) then
    delete from public.klan where id = v_u.klan_id;
    return;
  end if;
  insert into public.klan_mesaj (klan_id, dershane_id, kullanici_id, tur, kod) values (v_u.klan_id, v_u.dershane_id, p_kullanici, 'sistem', 'ayrildi');
  if v_u.rol = 'lider' then
    update public.klan set lider_id = null where id = v_u.klan_id;
    perform app.klan_lider_sec(v_u.klan_id);
  end if;
end;
$$;

/** Rol yönetimi: yardimci_yap / uye_yap / lider_devret (lider) · cikar (lider; yardımcı yalnız üyeyi) */
create or replace function public.sistem_klan_yonet(p_kullanici uuid, p_hedef uuid, p_islem text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ben public.klan_uyelik;
  v_o public.klan_uyelik;
begin
  select * into v_ben from public.klan_uyelik where kullanici_id = p_kullanici;
  select * into v_o from public.klan_uyelik where kullanici_id = p_hedef;
  if v_ben.klan_id is null or v_o.klan_id is distinct from v_ben.klan_id or p_hedef = p_kullanici then raise exception 'klan.yetkisiz'; end if;
  if p_islem = 'cikar' then
    if not (v_ben.rol = 'lider' or (v_ben.rol = 'yardimci' and v_o.rol = 'uye')) then raise exception 'klan.yetkisiz'; end if;
    delete from public.klan_uyelik where kullanici_id = p_hedef;
    insert into public.klan_mesaj (klan_id, dershane_id, kullanici_id, tur, kod) values (v_o.klan_id, v_o.dershane_id, p_hedef, 'sistem', 'cikarildi');
    return;
  end if;
  if v_ben.rol <> 'lider' then raise exception 'klan.yetkisiz'; end if;
  case p_islem
    when 'yardimci_yap' then
      if (select count(*) from public.klan_uyelik where klan_id = v_ben.klan_id and rol = 'yardimci') >= 3 then raise exception 'klan.yardimciSiniri'; end if;
      update public.klan_uyelik set rol = 'yardimci' where kullanici_id = p_hedef;
    when 'uye_yap' then
      update public.klan_uyelik set rol = 'uye' where kullanici_id = p_hedef;
    when 'lider_devret' then
      update public.klan_uyelik set rol = 'yardimci' where kullanici_id = p_kullanici;
      update public.klan_uyelik set rol = 'lider' where kullanici_id = p_hedef;
      update public.klan set lider_id = p_hedef where id = v_ben.klan_id;
      -- Yardımcı sınırı: devirden sonra 3'ü aşarsa en az aktif yardımcı üye olur
      update public.klan_uyelik set rol = 'uye'
      where kullanici_id in (
        select kullanici_id from public.klan_uyelik where klan_id = v_ben.klan_id and rol = 'yardimci'
        order by son_katki desc nulls last offset 3);
    else raise exception 'klan.yetkisiz';
  end case;
end;
$$;

/** Öğretmen/yönetici onayı (ad ve slogan) */
create or replace function public.sistem_klan_onay(p_klan uuid, p_onay boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.klan set onay_durumu = case when p_onay then 'onayli' else 'reddedildi' end where id = p_klan
$$;

-- ── Katkı: her sayılan cevaptan sonra API çağırır ──

create or replace function public.sistem_klan_katki(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kullanici uuid := (p ->> 'kullanici_id')::uuid;
  v_dogru boolean := coalesce((p ->> 'dogru')::boolean, false);
  v_zorluk integer := greatest(1, coalesce((p ->> 'zorluk')::integer, 1));
  v_beklenen numeric := least(1, greatest(0, coalesce((p ->> 'beklenen')::numeric, 0.7)));
  v_kazanim uuid := (p ->> 'kazanim_id')::uuid;
  v_ozellik text := p ->> 'ozellik';
  v_max_hak integer := coalesce((p ->> 'savas_hak')::integer, 30);
  v_hafta date := app.hafta_basi(app.bugun());
  v_u public.klan_uyelik;
  v_klan public.klan;
  v_ozellikler jsonb;
  v_eski_seviye integer;
  v_g record;
  v_tamamlanan text[] := '{}';
  v_boss public.boss;
  v_hasar integer;
  v_boss_sonuc jsonb := null;
  v_savas public.klan_savasi;
  v_bolge text := app.ozellik_bolge(v_ozellik);
  v_hak integer;
  v_etki numeric;
  v_taraf text;
  v_savas_sonuc jsonb := null;
begin
  select * into v_u from public.klan_uyelik where kullanici_id = v_kullanici for update;
  if not found then return null; end if;
  perform app.klan_hafta_hazirla(v_u.klan_id);

  update public.klan_uyelik set
    toplam_katki = toplam_katki + 1,
    haftalik_katki = case when hafta = v_hafta then haftalik_katki + 1 else 1 end,
    hafta = v_hafta,
    son_katki = now()
  where kullanici_id = v_kullanici
  returning * into v_u;

  select seviye into v_eski_seviye from public.klan where id = v_u.klan_id;
  update public.klan set katki_toplam = katki_toplam + 1, seviye = app.klan_seviyesi(katki_toplam + 1)
  where id = v_u.klan_id returning * into v_klan;

  -- Haftalık klan görevleri
  update public.klan_gorev set ilerleme = ilerleme + 1
  where klan_id = v_u.klan_id and hafta = v_hafta and kod = 'toplam_soru' and tamamlandi is null;
  update public.klan_gorev set ilerleme = (
    select count(*) from public.klan_uyelik where klan_id = v_u.klan_id and hafta = v_hafta and haftalik_katki >= 30)
  where klan_id = v_u.klan_id and hafta = v_hafta and kod = 'herkes_30' and tamamlandi is null;
  for v_g in
    update public.klan_gorev set tamamlandi = now()
    where klan_id = v_u.klan_id and hafta = v_hafta and tamamlandi is null and ilerleme >= hedef
    returning kod, odul_altin
  loop
    perform app.odul_ver(m.kullanici_id, 0, v_g.odul_altin) from public.klan_uyelik m where m.klan_id = v_u.klan_id;
    insert into public.klan_mesaj (klan_id, dershane_id, tur, kod) values (v_u.klan_id, v_u.dershane_id, 'sistem', 'gorev_' || v_g.kod);
    v_tamamlanan := v_tamamlanan || v_g.kod;
  end loop;

  select ozellik_puanlari into v_ozellikler from public.ogrenci_ilerleme where kullanici_id = v_kullanici;

  -- Boss: boss kazanımından doğru cevap; hasar = zorluk × ilgili özellik seviyesi
  if v_dogru then
    select * into v_boss from public.boss
    where klan_id = v_u.klan_id and hafta = v_hafta and kazanim_id = v_kazanim and yenildi is null and bitis > now()
    for update;
    if found then
      v_hasar := v_zorluk * app.ozellik_seviyesi(coalesce((v_ozellikler ->> v_ozellik)::integer, 0));
      update public.boss set kalan_can = greatest(0, kalan_can - v_hasar),
        yenildi = case when kalan_can - v_hasar <= 0 then now() end
      where id = v_boss.id returning * into v_boss;
      insert into public.boss_hasar (boss_id, kullanici_id, hasar, vurus) values (v_boss.id, v_kullanici, v_hasar, 1)
      on conflict (boss_id, kullanici_id) do update set hasar = public.boss_hasar.hasar + excluded.hasar, vurus = public.boss_hasar.vurus + 1;
      update public.ogrenci_ilerleme set boss_hasar_toplam = boss_hasar_toplam + v_hasar where kullanici_id = v_kullanici;
      if v_boss.yenildi is not null then
        -- Klan sandığı: hasar veren herkese
        perform app.odul_ver(h.kullanici_id, 50, 60) from public.boss_hasar h where h.boss_id = v_boss.id and h.hasar > 0;
        insert into public.klan_mesaj (klan_id, dershane_id, tur, kod, metin) values (v_u.klan_id, v_u.dershane_id, 'sistem', 'boss_yenildi', v_boss.ad);
      end if;
      v_boss_sonuc := jsonb_build_object('hasar', v_hasar, 'kalan_can', v_boss.kalan_can, 'can', v_boss.can, 'yenildi', v_boss.yenildi is not null, 'ad', v_boss.ad);
    end if;
  end if;

  -- Klan savaşı: pencere içinde her soru 1 hak; doğru cevap etkisi 10 × (1 + (1 − E))
  if v_bolge is not null then
    select * into v_savas from public.klan_savasi
    where durum = 'eslesti' and now() between baslangic and bitis and (klan_a = v_u.klan_id or klan_b = v_u.klan_id)
    limit 1;
    if found then
      select coalesce(sum(kullanilan_hak), 0) into v_hak from public.klan_savas_katki where savas_id = v_savas.id and kullanici_id = v_kullanici;
      if v_hak < v_max_hak then
        v_etki := case when v_dogru then round(10 * (1 + (1 - v_beklenen))
          * (1 + 0.01 * app.ozellik_seviyesi(coalesce((v_ozellikler ->> 'strateji')::integer, 0))), 2) else 0 end;
        insert into public.klan_savas_katki (savas_id, kullanici_id, klan_id, bolge, hasar, kullanilan_hak)
        values (v_savas.id, v_kullanici, v_u.klan_id, v_bolge, v_etki, 1)
        on conflict (savas_id, kullanici_id, bolge) do update set
          hasar = public.klan_savas_katki.hasar + excluded.hasar, kullanilan_hak = public.klan_savas_katki.kullanilan_hak + 1;
        if v_etki > 0 then
          v_taraf := case when v_savas.klan_a = v_u.klan_id then 'a' else 'b' end;
          update public.klan_savasi set bolge_durumu = jsonb_set(
            case when bolge_durumu ? v_bolge then bolge_durumu else bolge_durumu || jsonb_build_object(v_bolge, jsonb_build_object('a', 0, 'b', 0)) end,
            array[v_bolge, v_taraf],
            to_jsonb(coalesce((bolge_durumu #>> array[v_bolge, v_taraf])::numeric, 0) + v_etki))
          where id = v_savas.id;
        end if;
        v_savas_sonuc := jsonb_build_object('bolge', v_bolge, 'etki', v_etki, 'hak_kalan', v_max_hak - v_hak - 1);
      else
        v_savas_sonuc := jsonb_build_object('bolge', v_bolge, 'etki', 0, 'hak_kalan', 0);
      end if;
    end if;
  end if;

  return jsonb_build_object(
    'klan_id', v_u.klan_id,
    'seviye', v_klan.seviye,
    'seviye_atladi', v_klan.seviye > v_eski_seviye,
    'tamamlanan_gorevler', to_jsonb(v_tamamlanan),
    'boss', v_boss_sonuc,
    'savas', v_savas_sonuc
  );
end;
$$;

-- ── Klan savaşı eşleştirme ve kapanış ──

/**
 * Perşembe: dershane içinde savaşa uygun klanları (onaylı, ≥ p_min_uye üye) aktif üye
 * sayısı ve ortalama beceriye göre sıralayıp ardışık eşleştirir. Savaş Cuma 18:00 –
 * Pazar 21:00 (İstanbul). p_hemen: demo için hemen başlat (bitiş yine Pazar 21:00).
 */
create or replace function public.sistem_klan_savas_esle(p_hafta date, p_min_uye integer, p_hemen boolean default false, p_dershane uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d uuid;
  v_liste uuid[];
  v_n integer := 0;
  i integer;
  v_bas timestamptz := (p_hafta + 4)::timestamp + time '18:00';
  v_bit timestamptz;
begin
  v_bas := ((p_hafta + 4)::timestamp + time '18:00') at time zone 'Europe/Istanbul';
  v_bit := ((p_hafta + 6)::timestamp + time '21:00') at time zone 'Europe/Istanbul';
  if p_hemen then v_bas := now(); if v_bit <= now() then v_bit := now() + interval '2 hours'; end if; end if;

  for v_d in select id from public.dershane d where (p_dershane is null or d.id = p_dershane) and d.lisans_durumu in ('pilot', 'aktif') loop
    if not app.ozellik_acik_mi('klan_savasi', v_d) then continue; end if;
    perform app.klan_lider_sec(k.id) from public.klan k where k.dershane_id = v_d;
    select array_agg(x.id order by x.aktif desc, x.ort_theta desc, x.id) into v_liste
    from (
      select k.id,
        count(*) filter (where u.son_katki > now() - interval '7 days') as aktif,
        coalesce((select avg(b.theta) from public.beceri b join public.klan_uyelik u2 on u2.kullanici_id = b.kullanici_id where u2.klan_id = k.id), 1000) as ort_theta
      from public.klan k join public.klan_uyelik u on u.klan_id = k.id
      where k.dershane_id = v_d and k.onay_durumu = 'onayli'
        and not exists (select 1 from public.klan_savasi s where s.hafta = p_hafta and (s.klan_a = k.id or s.klan_b = k.id))
      group by k.id
      having count(*) >= p_min_uye
    ) x;
    if v_liste is null then continue; end if;
    i := 1;
    while i + 1 <= array_length(v_liste, 1) loop
      insert into public.klan_savasi (dershane_id, hafta, klan_a, klan_b, baslangic, bitis, bolge_durumu)
      values (v_d, p_hafta, v_liste[i], v_liste[i + 1], v_bas, v_bit,
        '{"mat": {"a": 0, "b": 0}, "fen": {"a": 0, "b": 0}, "turkce": {"a": 0, "b": 0}, "sosyal": {"a": 0, "b": 0}, "ingilizce": {"a": 0, "b": 0}}'::jsonb);
      insert into public.klan_mesaj (klan_id, dershane_id, tur, kod, metin)
      select k, v_d, 'sistem', 'savas_eslesti', (select ad::text from public.klan where id = case when k = v_liste[i] then v_liste[i + 1] else v_liste[i] end)
      from unnest(array[v_liste[i], v_liste[i + 1]]) k;
      v_n := v_n + 1;
      i := i + 2;
    end loop;
  end loop;
  return v_n;
end;
$$;

/** Pazar 21:00 sonrası: bölgeleri, katılım çarpanını ve kazananı hesaplar, ödülleri verir. */
create or replace function public.sistem_klan_savas_kapat(p_kupa integer default 30, p_hepsi boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.klan_savasi;
  v_ka numeric; v_kb numeric;
  v_bolge text;
  v_bolge_a integer; v_bolge_b integer;
  v_pa numeric; v_pb numeric;
  v_kazanan uuid; v_kaybeden uuid;
  v_n integer := 0;
  v_ha numeric; v_hb numeric;
begin
  for v_s in select * from public.klan_savasi where durum = 'eslesti' and (bitis < now() or p_hepsi) for update loop
    v_ka := app.katilim_carpani(
      (select count(distinct kullanici_id)::integer from public.klan_savas_katki where savas_id = v_s.id and klan_id = v_s.klan_a),
      (select count(*)::integer from public.klan_uyelik where klan_id = v_s.klan_a));
    v_kb := app.katilim_carpani(
      (select count(distinct kullanici_id)::integer from public.klan_savas_katki where savas_id = v_s.id and klan_id = v_s.klan_b),
      (select count(*)::integer from public.klan_uyelik where klan_id = v_s.klan_b));
    v_bolge_a := 0; v_bolge_b := 0; v_pa := 0; v_pb := 0;
    for v_bolge in select jsonb_object_keys(v_s.bolge_durumu) loop
      v_ha := coalesce((v_s.bolge_durumu #>> array[v_bolge, 'a'])::numeric, 0) * v_ka;
      v_hb := coalesce((v_s.bolge_durumu #>> array[v_bolge, 'b'])::numeric, 0) * v_kb;
      v_pa := v_pa + v_ha; v_pb := v_pb + v_hb;
      if v_ha > v_hb then v_bolge_a := v_bolge_a + 1; elsif v_hb > v_ha then v_bolge_b := v_bolge_b + 1; end if;
    end loop;
    v_kazanan := case
      when v_bolge_a > v_bolge_b then v_s.klan_a when v_bolge_b > v_bolge_a then v_s.klan_b
      when v_pa > v_pb then v_s.klan_a when v_pb > v_pa then v_s.klan_b end;
    v_kaybeden := case when v_kazanan = v_s.klan_a then v_s.klan_b when v_kazanan = v_s.klan_b then v_s.klan_a end;

    update public.klan_savasi set durum = 'bitti', kazanan = v_kazanan, puan_a = round(v_pa, 1), puan_b = round(v_pb, 1),
      carpan_a = v_ka, carpan_b = v_kb where id = v_s.id;

    if v_kazanan is not null then
      update public.klan set kupa = kupa + p_kupa where id = v_kazanan;
      update public.klan set kupa = greatest(0, kupa - p_kupa / 2) where id = v_kaybeden;
      -- Kazanan klan sandığı: savaşa katılan üyelere Kupa + XP + Altın
      update public.ogrenci_ilerleme i set kupa = i.kupa + 10, klan_savas_galibiyet = i.klan_savas_galibiyet + 1
      where i.kullanici_id in (select distinct kullanici_id from public.klan_savas_katki where savas_id = v_s.id and klan_id = v_kazanan);
      perform app.odul_ver(x.kullanici_id, 50, 80)
      from (select distinct kullanici_id from public.klan_savas_katki where savas_id = v_s.id and klan_id = v_kazanan) x;
    end if;
    -- Kaybeden (ya da berabere) klan üyeleri çözdükleri savaş soruları için XP alır
    perform app.odul_ver(x.kullanici_id, least(90, 3 * x.hak)::integer, 0)
    from (select kullanici_id, sum(kullanilan_hak) as hak from public.klan_savas_katki
          where savas_id = v_s.id and (v_kazanan is null or klan_id = v_kaybeden) group by kullanici_id) x;

    insert into public.klan_mesaj (klan_id, dershane_id, tur, kod)
    values (v_s.klan_a, v_s.dershane_id, 'sistem', case when v_kazanan = v_s.klan_a then 'savas_kazandi' when v_kazanan is null then 'savas_berabere' else 'savas_kaybetti' end),
           (v_s.klan_b, v_s.dershane_id, 'sistem', case when v_kazanan = v_s.klan_b then 'savas_kazandi' when v_kazanan is null then 'savas_berabere' else 'savas_kaybetti' end);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ── Sohbet ve şikâyet ──

create or replace function public.sistem_klan_mesaj(p_kullanici uuid, p_tur text, p_kod text, p_metin text, p_soru uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_u public.klan_uyelik;
  v_id bigint;
begin
  select * into v_u from public.klan_uyelik where kullanici_id = p_kullanici;
  if not found then raise exception 'klan.uyeDegil'; end if;
  if p_tur not in ('hazir', 'soru', 'serbest') then raise exception 'klan.mesajGecersiz'; end if;
  if p_tur = 'serbest' and not app.ozellik_acik_mi('klan_sohbeti_serbest', v_u.dershane_id) then raise exception 'klan.serbestKapali'; end if;
  if p_tur = 'soru' and not exists (select 1 from public.soru_gosterim where kullanici_id = p_kullanici and soru_id = p_soru) then
    raise exception 'klan.mesajGecersiz';
  end if;
  -- Hız sınırı: 3 sn'de 1, saatte 30 mesaj
  if exists (select 1 from public.klan_mesaj where kullanici_id = p_kullanici and tur <> 'sistem' and olusturma > now() - interval '3 seconds')
     or (select count(*) from public.klan_mesaj where kullanici_id = p_kullanici and tur <> 'sistem' and olusturma > now() - interval '1 hour') >= 30 then
    raise exception 'klan.cokHizli';
  end if;
  insert into public.klan_mesaj (klan_id, dershane_id, kullanici_id, tur, kod, metin, soru_id)
  values (v_u.klan_id, v_u.dershane_id, p_kullanici, p_tur, p_kod, case when p_tur = 'serbest' then p_metin end, case when p_tur = 'soru' then p_soru end)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.sistem_klan_mesajlar(p_kullanici uuid, p_sonra bigint default 0, p_limit integer default 50)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x.id), '[]'::jsonb) from (
    select m.id, m.tur, m.kod, m.metin, m.olusturma, m.kullanici_id = p_kullanici as benim,
      k.takma_ad::text as takma_ad, kr.tur as karakter,
      case when m.soru_id is not null then jsonb_build_object('id', s.id, 'govde_md', s.govde_md, 'siklar', s.siklar) end as soru
    from public.klan_mesaj m
    join public.klan_uyelik u on u.klan_id = m.klan_id and u.kullanici_id = p_kullanici
    left join public.kullanici k on k.id = m.kullanici_id
    left join public.karakter kr on kr.kullanici_id = m.kullanici_id
    left join public.soru s on s.id = m.soru_id
    where m.id > coalesce(p_sonra, 0) and not m.gizli
    order by m.id desc
    limit p_limit
  ) x
$$;

/** Şikâyet: zorbalık öncelikli; aynı mesaja 3 farklı şikâyet gelirse mesaj gizlenir. */
create or replace function public.sistem_sikayet(p_kullanici uuid, p_hedef_tur text, p_hedef_id text, p_sebep text, p_aciklama text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d uuid;
  v_m public.klan_mesaj;
begin
  select dershane_id into v_d from public.kullanici where id = p_kullanici;
  if p_hedef_tur = 'klan_mesaj' then
    select m.* into v_m from public.klan_mesaj m
    join public.klan_uyelik u on u.klan_id = m.klan_id and u.kullanici_id = p_kullanici
    where m.id = p_hedef_id::bigint;
    if not found or v_m.kullanici_id = p_kullanici then raise exception 'sikayet.gecersiz'; end if;
  elsif p_hedef_tur = 'klan' then
    if not exists (select 1 from public.klan where id = p_hedef_id::uuid and dershane_id = v_d) then raise exception 'sikayet.gecersiz'; end if;
  else
    raise exception 'sikayet.gecersiz';
  end if;
  insert into public.sikayet (dershane_id, sikayet_eden, hedef_tur, hedef_id, sebep, aciklama, oncelikli)
  values (v_d, p_kullanici, p_hedef_tur, p_hedef_id, p_sebep, left(p_aciklama, 500), p_sebep = 'zorbalik')
  on conflict do nothing;
  if p_hedef_tur = 'klan_mesaj' and (select count(*) from public.sikayet where hedef_tur = 'klan_mesaj' and hedef_id = p_hedef_id and durum = 'acik') >= 3 then
    update public.klan_mesaj set gizli = true where id = p_hedef_id::bigint;
  end if;
end;
$$;

-- ── Klan ekranı: tek çağrıda tüm durum ──

create or replace function public.sistem_klan_durum(p_kullanici uuid, p_max_hak integer default 30)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_u public.klan_uyelik;
  v_klan public.klan;
  v_hafta date := app.hafta_basi(app.bugun());
  v_d uuid;
  v_savas public.klan_savasi;
  v_taraf text;
  v_sonuc jsonb;
begin
  select dershane_id into v_d from public.kullanici where id = p_kullanici;
  select * into v_u from public.klan_uyelik where kullanici_id = p_kullanici;
  if not found then
    return jsonb_build_object(
      'uye', false,
      'klanlar', coalesce((
        select jsonb_agg(jsonb_build_object('id', k.id, 'ad', k.ad::text, 'slogan', k.slogan, 'amblem', k.amblem, 'seviye', k.seviye,
          'kupa', k.kupa, 'katilim_turu', k.katilim_turu, 'uye_sayisi', (select count(*) from public.klan_uyelik u where u.klan_id = k.id),
          'basvurdum', exists (select 1 from public.klan_basvuru b where b.klan_id = k.id and b.kullanici_id = p_kullanici and b.tur = 'basvuru' and b.durum = 'bekliyor'))
          order by k.seviye desc, k.katki_toplam desc)
        from public.klan k where k.dershane_id = v_d and k.onay_durumu = 'onayli'), '[]'::jsonb),
      'davetler', coalesce((
        select jsonb_agg(jsonb_build_object('id', b.id, 'klan_id', k.id, 'ad', k.ad::text, 'amblem', k.amblem, 'seviye', k.seviye))
        from public.klan_basvuru b join public.klan k on k.id = b.klan_id
        where b.kullanici_id = p_kullanici and b.tur = 'davet' and b.durum = 'bekliyor'), '[]'::jsonb),
      'seviye', (select coalesce(seviye, 1) from public.ogrenci_ilerleme where kullanici_id = p_kullanici),
      'son7_soru', (select count(*) from public.cevap where kullanici_id = p_kullanici and olusturma > now() - interval '7 days')
    );
  end if;

  perform app.klan_hafta_hazirla(v_u.klan_id);
  select * into v_klan from public.klan where id = v_u.klan_id;
  select * into v_savas from public.klan_savasi
  where (klan_a = v_klan.id or klan_b = v_klan.id) and (durum = 'eslesti' or hafta = v_hafta)
  order by hafta desc limit 1;
  v_taraf := case when v_savas.klan_a = v_klan.id then 'a' else 'b' end;

  v_sonuc := jsonb_build_object(
    'uye', true,
    'rolum', v_u.rol,
    'klan', jsonb_build_object('id', v_klan.id, 'ad', v_klan.ad::text, 'slogan', v_klan.slogan, 'amblem', v_klan.amblem,
      'seviye', v_klan.seviye, 'katki_toplam', v_klan.katki_toplam, 'kupa', v_klan.kupa, 'katilim_turu', v_klan.katilim_turu,
      'onay_durumu', v_klan.onay_durumu),
    'uyeler', (
      select jsonb_agg(jsonb_build_object('kullanici_id', u.kullanici_id, 'takma_ad', k.takma_ad::text, 'rol', u.rol,
        'haftalik_katki', case when u.hafta = v_hafta then u.haftalik_katki else 0 end, 'toplam_katki', u.toplam_katki,
        'karakter', kr.tur, 'seviye', coalesce(i.seviye, 1), 'ben', u.kullanici_id = p_kullanici)
        order by (u.rol = 'lider') desc, (u.rol = 'yardimci') desc, case when u.hafta = v_hafta then u.haftalik_katki else 0 end desc)
      from public.klan_uyelik u join public.kullanici k on k.id = u.kullanici_id
      left join public.karakter kr on kr.kullanici_id = u.kullanici_id
      left join public.ogrenci_ilerleme i on i.kullanici_id = u.kullanici_id
      where u.klan_id = v_klan.id),
    'gorevler', coalesce((
      select jsonb_agg(jsonb_build_object('kod', g.kod, 'hedef', g.hedef, 'ilerleme', g.ilerleme, 'odul_altin', g.odul_altin, 'tamamlandi', g.tamamlandi is not null) order by g.kod desc)
      from public.klan_gorev g where g.klan_id = v_klan.id and g.hafta = v_hafta), '[]'::jsonb),
    'boss', (
      select jsonb_build_object('id', b.id, 'ad', b.ad, 'emoji', b.emoji, 'can', b.can, 'kalan_can', b.kalan_can, 'bitis', b.bitis,
        'yenildi', b.yenildi is not null, 'kazanim_id', b.kazanim_id, 'kazanim', kz.aciklama, 'kazanim_kod', kz.kod, 'ders', d.ad, 'ozellik', d.ozellik,
        'hasarim', coalesce((select h.hasar from public.boss_hasar h where h.boss_id = b.id and h.kullanici_id = p_kullanici), 0),
        'en_iyiler', coalesce((select jsonb_agg(jsonb_build_object('takma_ad', kk.takma_ad::text, 'hasar', h.hasar) order by h.hasar desc)
          from (select * from public.boss_hasar where boss_id = b.id order by hasar desc limit 5) h join public.kullanici kk on kk.id = h.kullanici_id), '[]'::jsonb))
      from public.boss b join public.kazanim kz on kz.id = b.kazanim_id join public.unite un on un.id = kz.unite_id join public.ders d on d.id = un.ders_id
      where b.klan_id = v_klan.id and b.hafta = v_hafta),
    'savas', case when v_savas.id is null then null else jsonb_build_object(
      'id', v_savas.id, 'durum', v_savas.durum, 'baslangic', v_savas.baslangic, 'bitis', v_savas.bitis,
      'aktif', v_savas.durum = 'eslesti' and now() between v_savas.baslangic and v_savas.bitis,
      'rakip', (select jsonb_build_object('ad', k.ad::text, 'amblem', k.amblem, 'seviye', k.seviye, 'kupa', k.kupa)
                from public.klan k where k.id = case when v_taraf = 'a' then v_savas.klan_b else v_savas.klan_a end),
      'bolgeler', (select jsonb_object_agg(key, jsonb_build_object(
          'ben', coalesce((value ->> v_taraf)::numeric, 0),
          'rakip', coalesce((value ->> case when v_taraf = 'a' then 'b' else 'a' end)::numeric, 0)))
        from jsonb_each(v_savas.bolge_durumu)),
      'hak_kalan', p_max_hak - coalesce((select sum(kullanilan_hak) from public.klan_savas_katki where savas_id = v_savas.id and kullanici_id = p_kullanici), 0),
      'katilan_ben', (select count(distinct kullanici_id) from public.klan_savas_katki where savas_id = v_savas.id and klan_id = v_klan.id),
      'katilan_rakip', (select count(distinct kullanici_id) from public.klan_savas_katki where savas_id = v_savas.id and klan_id <> v_klan.id),
      'kazandik', case when v_savas.durum = 'bitti' then v_savas.kazanan = v_klan.id end,
      'berabere', v_savas.durum = 'bitti' and v_savas.kazanan is null,
      'puan_ben', case when v_taraf = 'a' then v_savas.puan_a else v_savas.puan_b end,
      'puan_rakip', case when v_taraf = 'a' then v_savas.puan_b else v_savas.puan_a end
    ) end,
    'basvurular', case when v_u.rol in ('lider', 'yardimci') then coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'takma_ad', k.takma_ad::text, 'olusturma', b.olusturma))
      from public.klan_basvuru b join public.kullanici k on k.id = b.kullanici_id
      where b.klan_id = v_klan.id and b.tur = 'basvuru' and b.durum = 'bekliyor'), '[]'::jsonb) else '[]'::jsonb end
  );
  return v_sonuc;
end;
$$;

-- Rozet metrikleri: klan
create or replace function public.sistem_oyun_metrikleri(p_kullanici uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'toplam_cevap', coalesce(i.toplam_cevap, 0),
    'toplam_dogru', coalesce(i.toplam_dogru, 0),
    'seviye', coalesce(i.seviye, 1),
    'seri_gun', coalesce(i.seri_gun, 0),
    'en_uzun_seri', coalesce(i.en_uzun_seri, 0),
    'max_ardisik', coalesce(i.max_ardisik, 0),
    'sabah_cozum', coalesce(i.sabah_cozum, 0),
    'zor_dogru', coalesce(i.zor_dogru, 0),
    'ipucusuz_dogru', coalesce(i.ipucusuz_dogru, 0),
    'temizlenen_hata', coalesce(i.temizlenen_hata, 0),
    'gorev_tamamlanan', coalesce(i.gorev_tamamlanan, 0),
    'haftalik_gorev_tamamlanan', coalesce(i.haftalik_gorev_tamamlanan, 0),
    'lig_yukselme', coalesce(i.lig_yukselme, 0),
    'en_iyi_lig_adim', coalesce(i.en_iyi_lig_adim, 1),
    'duello_galibiyet', coalesce(i.duello_galibiyet, 0),
    'en_uzun_duello_seri', coalesce(i.en_uzun_duello_seri, 0),
    'klan_uyesi', case when exists (select 1 from public.klan_uyelik u where u.kullanici_id = p_kullanici) then 1 else 0 end,
    'boss_hasar_max', coalesce((select max(h.hasar) from public.boss_hasar h where h.kullanici_id = p_kullanici), 0),
    'klan_savas_galibiyet', coalesce(i.klan_savas_galibiyet, 0),
    'ozellik_min', coalesce((select min(coalesce((i.ozellik_puanlari ->> o)::integer, 0))
                             from unnest(array['zeka', 'enerji', 'bilgelik', 'strateji', 'ceviklik']) o), 0),
    'bronz_ustu', (select count(*) from public.beceri b where b.kullanici_id = p_kullanici and b.ustalik in ('bronz', 'gumus', 'altin')),
    'gumus_ustu', (select count(*) from public.beceri b where b.kullanici_id = p_kullanici and b.ustalik in ('gumus', 'altin')),
    'altin', (select count(*) from public.beceri b where b.kullanici_id = p_kullanici and b.ustalik = 'altin'),
    'acik_hata', (select count(*) from public.hata_defteri h where h.kullanici_id = p_kullanici and h.durum = 'acik'),
    'tespit_biten', (select count(*) from public.tespit_oturumu t where t.kullanici_id = p_kullanici and t.bitis is not null),
    'ders_sayisi', (select count(*) from public.sistem_ogrenci_dersleri(p_kullanici)),
    'tam_set', exists (
      select 1 from public.sistem_ogrenci_dersleri(p_kullanici) d
      where not exists (
        select 1 from public.kazanim k join public.unite u on u.id = k.unite_id
        left join public.beceri b on b.kazanim_id = k.id and b.kullanici_id = p_kullanici
        where u.ders_id = d.id and coalesce(b.ustalik, 'kesfedilmedi') = 'kesfedilmedi')),
    'envanter', (select count(*) from public.envanter e where e.kullanici_id = p_kullanici)
  )
  from (select 1) x
  left join public.ogrenci_ilerleme i on i.kullanici_id = p_kullanici
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.sistem_klan_kur(uuid, text, text, jsonb, text, boolean, integer, integer)',
    'public.sistem_klan_katil(uuid, uuid, integer)',
    'public.sistem_klan_basvuru_yanit(uuid, uuid, boolean, integer)',
    'public.sistem_klan_davet(uuid, uuid)',
    'public.sistem_klan_ayril(uuid)',
    'public.sistem_klan_yonet(uuid, uuid, text)',
    'public.sistem_klan_onay(uuid, boolean)',
    'public.sistem_klan_katki(jsonb)',
    'public.sistem_klan_savas_esle(date, integer, boolean, uuid)',
    'public.sistem_klan_savas_kapat(integer, boolean)',
    'public.sistem_klan_mesaj(uuid, text, text, text, uuid)',
    'public.sistem_klan_mesajlar(uuid, bigint, integer)',
    'public.sistem_sikayet(uuid, text, text, text, text)',
    'public.sistem_klan_durum(uuid, integer)',
    'public.sistem_oyun_metrikleri(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
