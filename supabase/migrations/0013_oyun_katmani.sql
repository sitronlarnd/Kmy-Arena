-- ─────────────────────────────────────────────────────────────
-- 0013 · Faz 2: oyun katmanı
--
--  • karakter            6 karakterden seçim + kuşanılan kozmetikler
--  • ogrenci_ilerleme +  seri, günlük hedef, haftalık XP, lig adımı, rozet sayaçları
--  • envanter            satın alınan kozmetikler (katalog: packages/shared/oyun-katalogu)
--  • kullanici_rozet     kazanılan rozetler (katalog: packages/shared)
--  • kullanici_gorev     günlük / haftalık görevler ve ilerlemesi
--  • lig_grubu, lig_uyelik  haftalık XP ligi (dershane içi, benzer kademe, 20-30 kişi)
--
-- Tüm yazma işlemleri service_role fonksiyonlarıyla; istemci yalnızca okur.
-- Tarih/hafta Europe/Istanbul saatine göredir; hafta pazartesi başlar.
-- Lig: 6 kademe × 3 alt kademe = 18 adım (1 = Bronz III … 18 = Efsane I).
-- Sezon 6 hafta; sezon numarası sabit başlangıçtan (2026-11-02) hesaplanır.
-- ─────────────────────────────────────────────────────────────

create or replace function app.bugun()
returns date language sql stable set search_path = ''
as $$ select (now() at time zone 'Europe/Istanbul')::date $$;

create or replace function app.hafta_basi(p_gun date)
returns date language sql immutable set search_path = ''
as $$ select (p_gun - (extract(isodow from p_gun)::integer - 1))::date $$;

create or replace function app.sezon_no(p_hafta date)
returns integer language sql immutable set search_path = ''
as $$ select ((p_hafta - date '2026-11-02') / 7) / 6 + 1 $$;

-- ── Karakter ──
create table public.karakter (
  kullanici_id uuid primary key references public.kullanici (id) on delete cascade,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  tur text not null check (tur in ('bilge_baykus', 'kivilcim_tilki', 'demir_ayi', 'ruzgar_atmacasi', 'golge_kedi', 'tas_kaplumbaga')),
  kostum text,
  cerceve text,
  arka_plan text,
  duello_efekti text,
  unvan text,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
select app.guncelleme_tetikleyicisi_ekle('public.karakter');

-- ── İlerlemeye oyun alanları ──
alter table public.ogrenci_ilerleme
  add column seri_gun integer not null default 0,
  add column en_uzun_seri integer not null default 0,
  add column seri_son_gun date,
  add column seri_dondurucu smallint not null default 0 check (seri_dondurucu between 0 and 5),
  add column onceki_seri integer not null default 0,
  add column seri_kirilma_gunu date,
  add column gunluk_gun date,
  add column gunluk_soru integer not null default 0,
  add column gunluk_hedef smallint not null default 10 check (gunluk_hedef between 3 and 100),
  add column hafta date,
  add column haftalik_xp integer not null default 0,
  add column lig_adim smallint not null default 1 check (lig_adim between 1 and 18),
  add column en_iyi_lig_adim smallint not null default 1,
  add column lig_yukselme integer not null default 0,
  add column kupa integer not null default 0 check (kupa >= 0),
  add column temizlenen_hata integer not null default 0,
  add column gorev_tamamlanan integer not null default 0,
  add column haftalik_gorev_tamamlanan integer not null default 0,
  add column sabah_cozum integer not null default 0,
  add column zor_dogru integer not null default 0,
  add column ipucusuz_dogru integer not null default 0,
  add column max_ardisik integer not null default 0;

-- ── Envanter, rozet, görev ──
create table public.envanter (
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  esya_kod text not null,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  primary key (kullanici_id, esya_kod)
);

create table public.kullanici_rozet (
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  rozet_kod text not null,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  primary key (kullanici_id, rozet_kod)
);

create table public.kullanici_gorev (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  gorev_kod text not null,
  tur text not null check (tur in ('gunluk', 'haftalik')),
  donem date not null,                       -- günlük: gün, haftalık: haftanın pazartesisi
  baslik text not null,
  hedef integer not null check (hedef > 0),
  ilerleme integer not null default 0,
  parametre jsonb not null default '{}'::jsonb,
  odul_xp integer not null default 0,
  odul_altin integer not null default 0,
  tamamlandi timestamptz,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  unique (kullanici_id, gorev_kod, donem)
);
select app.guncelleme_tetikleyicisi_ekle('public.kullanici_gorev');
create index kullanici_gorev_donem on public.kullanici_gorev (kullanici_id, donem desc);

-- ── Lig ──
create table public.lig_grubu (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  sezon integer not null,
  hafta date not null,
  kademe smallint not null check (kademe between 1 and 6),
  kapandi timestamptz,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
create index lig_grubu_hafta on public.lig_grubu (dershane_id, hafta, kademe);

create table public.lig_uyelik (
  grup_id uuid not null references public.lig_grubu (id) on delete cascade,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  hafta date not null,
  xp integer not null default 0,
  sira smallint,
  sonuc text check (sonuc in ('yukseldi', 'dustu', 'kaldi')),
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  primary key (grup_id, kullanici_id),
  unique (kullanici_id, hafta)
);
create index lig_uyelik_grup_xp on public.lig_uyelik (grup_id, xp desc);

-- ── RLS ──
alter table public.karakter enable row level security;
alter table public.envanter enable row level security;
alter table public.kullanici_rozet enable row level security;
alter table public.kullanici_gorev enable row level security;
alter table public.lig_grubu enable row level security;
alter table public.lig_uyelik enable row level security;

-- Karakter ve rozetler aynı dershanedeki herkese görünür (takma ad gibi oyun kimliği);
-- envanter ve görevler yalnızca öğrenciye ve onu akademik görebilenlere.
create policy karakter_oku on public.karakter for select to authenticated using (dershane_id = app.dershane_id());
create policy kullanici_rozet_oku on public.kullanici_rozet for select to authenticated using (dershane_id = app.dershane_id());
create policy envanter_oku on public.envanter for select to authenticated using (app.ogrenci_akademik_okuyabilir(kullanici_id));
create policy kullanici_gorev_oku on public.kullanici_gorev for select to authenticated using (app.ogrenci_akademik_okuyabilir(kullanici_id));
create policy lig_grubu_oku on public.lig_grubu for select to authenticated using (dershane_id = app.dershane_id());
create policy lig_uyelik_oku on public.lig_uyelik for select to authenticated using (dershane_id = app.dershane_id());

revoke insert, update, delete on public.karakter, public.envanter, public.kullanici_rozet, public.kullanici_gorev,
  public.lig_grubu, public.lig_uyelik from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Ödül, lig ve seri
-- ─────────────────────────────────────────────────────────────

/** Öğrenciyi bu haftanın lig grubuna koyar (yoksa). Grup: aynı dershane, aynı kademe, en fazla 30 kişi. */
create or replace function app.lig_katil(p_kullanici uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hafta date := app.hafta_basi(app.bugun());
  v_grup uuid;
  v_dershane uuid;
  v_kademe smallint;
begin
  select grup_id into v_grup from public.lig_uyelik where kullanici_id = p_kullanici and hafta = v_hafta;
  if found then return v_grup; end if;
  select i.dershane_id, ((i.lig_adim - 1) / 3 + 1)::smallint into v_dershane, v_kademe
  from public.ogrenci_ilerleme i where i.kullanici_id = p_kullanici;
  if v_dershane is null then return null; end if;
  -- Eşzamanlı katılımlarda grup taşmasın
  perform pg_advisory_xact_lock(hashtext(v_dershane::text || v_hafta::text || v_kademe::text));
  select g.id into v_grup
  from public.lig_grubu g
  where g.dershane_id = v_dershane and g.hafta = v_hafta and g.kademe = v_kademe and g.kapandi is null
    and (select count(*) from public.lig_uyelik u where u.grup_id = g.id) < 30
  order by g.olusturma
  limit 1;
  if v_grup is null then
    insert into public.lig_grubu (dershane_id, sezon, hafta, kademe)
    values (v_dershane, app.sezon_no(v_hafta), v_hafta, v_kademe)
    returning id into v_grup;
  end if;
  insert into public.lig_uyelik (grup_id, kullanici_id, dershane_id, hafta) values (v_grup, p_kullanici, v_dershane, v_hafta);
  return v_grup;
end $$;

/** TEK ödül noktası: XP, Altın, seviye, haftalık XP ve lig XP'si birlikte güncellenir. */
create or replace function app.odul_ver(p_kullanici uuid, p_xp integer, p_altin integer)
returns public.ogrenci_ilerleme
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hafta date := app.hafta_basi(app.bugun());
  v public.ogrenci_ilerleme;
begin
  update public.ogrenci_ilerleme set
    xp = xp + greatest(p_xp, 0),
    altin = greatest(0, altin + p_altin),
    seviye = app.xpden_seviye(xp + greatest(p_xp, 0)),
    haftalik_xp = case when hafta = v_hafta then haftalik_xp else 0 end + greatest(p_xp, 0),
    hafta = v_hafta
  where kullanici_id = p_kullanici
  returning * into v;
  if p_xp > 0 then
    perform app.lig_katil(p_kullanici);
    update public.lig_uyelik set xp = xp + p_xp where kullanici_id = p_kullanici and hafta = v_hafta;
  end if;
  return v;
end $$;

/**
 * Günlük sayaç ve seri. Günlük hedefe ULAŞILDIĞI anda seri işlenir:
 * dün de tamamlandıysa +1; arada boş gün varsa önce seri dondurucular harcanır;
 * yetmezse seri 1'den başlar, eski seri "seriyi geri kazan" görevi için saklanır.
 */
create or replace function app.seri_isle(p_kullanici uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bugun date := app.bugun();
  i public.ogrenci_ilerleme;
  v_bos integer;
  v_durum text := null;
begin
  update public.ogrenci_ilerleme set
    gunluk_soru = case when gunluk_gun = v_bugun then gunluk_soru + 1 else 1 end,
    gunluk_gun = v_bugun
  where kullanici_id = p_kullanici
  returning * into i;

  if i.gunluk_soru = i.gunluk_hedef and i.seri_son_gun is distinct from v_bugun then
    if i.seri_son_gun = v_bugun - 1 then
      v_durum := 'artti';
      update public.ogrenci_ilerleme set seri_gun = seri_gun + 1 where kullanici_id = p_kullanici;
    elsif i.seri_son_gun is not null and i.seri_gun > 0 and (v_bugun - i.seri_son_gun - 1) <= i.seri_dondurucu then
      v_bos := v_bugun - i.seri_son_gun - 1;
      v_durum := 'donduruldu';
      update public.ogrenci_ilerleme set seri_gun = seri_gun + 1, seri_dondurucu = seri_dondurucu - v_bos
      where kullanici_id = p_kullanici;
    else
      v_durum := case when i.seri_gun > 0 then 'sifirlandi' else 'basladi' end;
      update public.ogrenci_ilerleme set
        onceki_seri = case when i.seri_gun > 0 then i.seri_gun else onceki_seri end,
        seri_kirilma_gunu = case when i.seri_gun > 0 then v_bugun else seri_kirilma_gunu end,
        seri_gun = 1
      where kullanici_id = p_kullanici;
    end if;
    update public.ogrenci_ilerleme set seri_son_gun = v_bugun, en_uzun_seri = greatest(en_uzun_seri, seri_gun)
    where kullanici_id = p_kullanici
    returning * into i;
  end if;

  return jsonb_build_object('gunluk_soru', i.gunluk_soru, 'gunluk_hedef', i.gunluk_hedef,
    'hedef_tamam', v_durum is not null, 'seri_gun', i.seri_gun, 'seri_durum', v_durum);
end $$;

-- ─────────────────────────────────────────────────────────────
-- Cevap işleme (0008'deki fonksiyonun Faz 2 sürümü)
-- ─────────────────────────────────────────────────────────────
create or replace function public.sistem_cevap_isle(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kullanici uuid := (p ->> 'kullanici_id')::uuid;
  v_soru_id uuid := (p ->> 'soru_id')::uuid;
  v_dogru boolean := (p ->> 'dogru_mu')::boolean;
  v_sayildi boolean := coalesce((p ->> 'sayildi')::boolean, true);
  v_g public.soru_gosterim;
  v_soru public.soru;
  v_beceri public.beceri;
  v_theta_once numeric := (p ->> 'theta_once')::numeric;
  v_ilerleme public.ogrenci_ilerleme;
  v_eski_seviye integer;
  v_eski_ustalik text;
  v_araliklar integer[] := array(select jsonb_array_elements_text(coalesce(p -> 'tekrar_araliklari_gun', '[1,3,7,21]'))::integer);
  v_hd public.hata_defteri;
  v_tespit public.tespit_oturumu;
  v_tespit_bitti boolean := false;
  v_hd_durum text := null;
  v_ozellik text := p ->> 'ozellik';
  v_seri jsonb;
  v_saat integer := extract(hour from now() at time zone 'Europe/Istanbul')::integer;
begin
  select * into v_g from public.soru_gosterim
  where kullanici_id = v_kullanici and soru_id = v_soru_id
  for update;
  if not found then raise exception 'soru.gosterilmedi'; end if;
  if v_g.cevaplandi is not null then raise exception 'soru.zatenCevaplandi'; end if;

  select * into v_soru from public.soru where id = v_soru_id;

  select * into v_beceri from public.beceri
  where kullanici_id = v_kullanici and kazanim_id = v_soru.kazanim_id
  for update;
  if abs(coalesce(v_beceri.theta, 1000) - v_theta_once) > 0.01 then
    raise exception 'beceri.yarisma';
  end if;
  v_eski_ustalik := coalesce(v_beceri.ustalik, 'kesfedilmedi');

  insert into public.beceri as b (dershane_id, kullanici_id, kazanim_id, theta, cozulen, dogru, son10, ustalik)
  values (v_g.dershane_id, v_kullanici, v_soru.kazanim_id, (p ->> 'theta_sonra')::numeric,
          case when v_sayildi then 1 else 0 end, case when v_dogru then 1 else 0 end,
          array[case when v_dogru then 1 else 0 end]::smallint[], p ->> 'ustalik')
  on conflict (kullanici_id, kazanim_id) do update set
    theta = excluded.theta,
    cozulen = b.cozulen + excluded.cozulen,
    dogru = b.dogru + excluded.dogru,
    son10 = (b.son10 || excluded.son10)[greatest(1, cardinality(b.son10) + 2 - 10):],
    ustalik = excluded.ustalik;

  insert into public.cevap (dershane_id, kullanici_id, soru_id, kazanim_id, baglam, secilen, dogru_mu, sure_ms,
                            ipucu_sayisi, theta_once, theta_sonra, beklenen, xp, altin)
  values (v_g.dershane_id, v_kullanici, v_soru_id, v_soru.kazanim_id, v_g.baglam,
          nullif(p ->> 'secilen', ''), v_dogru, (p ->> 'sure_ms')::integer, v_g.ipucu_sayisi,
          v_theta_once, (p ->> 'theta_sonra')::numeric, (p ->> 'beklenen')::numeric,
          (p ->> 'xp')::integer, (p ->> 'altin')::integer);

  update public.soru_gosterim set cevaplandi = now()
  where kullanici_id = v_kullanici and soru_id = v_soru_id;

  update public.soru set cevap_sayisi = cevap_sayisi + 1, dogru_sayisi = dogru_sayisi + case when v_dogru then 1 else 0 end
  where id = v_soru_id;

  -- İlerleme: sayaçlar (rozetler için) + tek ödül noktası
  insert into public.ogrenci_ilerleme (kullanici_id, dershane_id) values (v_kullanici, v_g.dershane_id)
  on conflict (kullanici_id) do nothing;
  select seviye into v_eski_seviye from public.ogrenci_ilerleme where kullanici_id = v_kullanici for update;
  update public.ogrenci_ilerleme set
    seri_dogru = case when v_dogru then seri_dogru + 1 else 0 end,
    max_ardisik = greatest(max_ardisik, case when v_dogru then seri_dogru + 1 else 0 end),
    akis_sirasi = akis_sirasi + 1,
    toplam_cevap = toplam_cevap + 1,
    toplam_dogru = toplam_dogru + case when v_dogru then 1 else 0 end,
    sabah_cozum = sabah_cozum + case when v_saat between 7 and 8 then 1 else 0 end,
    zor_dogru = zor_dogru + case when v_dogru and coalesce((p ->> 'zorluk')::numeric, 0) >= 8 then 1 else 0 end,
    ipucusuz_dogru = ipucusuz_dogru + case when v_dogru and v_g.ipucu_sayisi = 0 then 1 else 0 end,
    ozellik_puanlari = case
      when v_dogru and v_ozellik is not null
        then jsonb_set(ozellik_puanlari, array[v_ozellik], to_jsonb(coalesce((ozellik_puanlari ->> v_ozellik)::integer, 0) + 1))
      else ozellik_puanlari end,
    son_cevap = now()
  where kullanici_id = v_kullanici;
  v_ilerleme := app.odul_ver(v_kullanici, (p ->> 'xp')::integer, (p ->> 'altin')::integer);
  v_seri := app.seri_isle(v_kullanici);

  -- Hata defteri
  if v_g.hata_defteri_id is not null then
    select * into v_hd from public.hata_defteri where id = v_g.hata_defteri_id for update;
    if found and v_hd.durum = 'acik' then
      if v_dogru then
        if v_hd.asama + 1 >= cardinality(v_araliklar) then
          update public.hata_defteri set asama = asama + 1, durum = 'temizlendi', temizlenme = now(),
                 tekrar_sayisi = tekrar_sayisi + 1 where id = v_hd.id;
          update public.ogrenci_ilerleme set temizlenen_hata = temizlenen_hata + 1 where kullanici_id = v_kullanici;
          v_hd_durum := 'temizlendi';
        else
          update public.hata_defteri set asama = asama + 1, tekrar_sayisi = tekrar_sayisi + 1,
                 sonraki_tekrar = now() + make_interval(days => v_araliklar[v_hd.asama + 2]) where id = v_hd.id;
          v_hd_durum := 'ilerledi';
        end if;
      else
        update public.hata_defteri set asama = 0, tekrar_sayisi = tekrar_sayisi + 1,
               sonraki_tekrar = now() + make_interval(days => v_araliklar[1]) where id = v_hd.id;
        v_hd_durum := 'basa_dondu';
      end if;
    end if;
  elsif not v_dogru and v_g.baglam in ('antrenman', 'tespit', 'odev', 'tekrar') then
    insert into public.hata_defteri (dershane_id, kullanici_id, kazanim_id, soru_id, secilen, sonraki_tekrar)
    values (v_g.dershane_id, v_kullanici, v_soru.kazanim_id, v_soru_id, nullif(p ->> 'secilen', ''),
            now() + make_interval(days => v_araliklar[1]))
    on conflict (kullanici_id, soru_id) do nothing;
    v_hd_durum := 'eklendi';
  end if;

  -- Tespit sınavı
  if v_g.tespit_oturumu_id is not null then
    update public.tespit_oturumu set
      theta = coalesce((p ->> 'tespit_theta')::numeric, theta),
      soru_sayisi = soru_sayisi + 1,
      dogru = dogru + case when v_dogru then 1 else 0 end,
      bitis = case when soru_sayisi + 1 >= hedef_soru then now() else null end
    where id = v_g.tespit_oturumu_id and bitis is null
    returning * into v_tespit;
    if found and v_tespit.bitis is not null then
      v_tespit_bitti := true;
      insert into public.beceri as b (dershane_id, kullanici_id, kazanim_id, theta)
      select v_g.dershane_id, v_kullanici, k.id, v_tespit.theta
      from public.kazanim k join public.unite u on u.id = k.unite_id
      where u.ders_id = v_tespit.ders_id
      on conflict (kullanici_id, kazanim_id) do update set theta = excluded.theta
        where b.cozulen = 0;
    end if;
  end if;

  return jsonb_build_object(
    'xp_toplam', v_ilerleme.xp,
    'altin_toplam', v_ilerleme.altin,
    'seviye', v_ilerleme.seviye,
    'seviye_atladi', v_ilerleme.seviye > v_eski_seviye,
    'seri', (select seri_dogru from public.ogrenci_ilerleme where kullanici_id = v_kullanici),
    'hata_defteri', v_hd_durum,
    'tespit_bitti', v_tespit_bitti,
    'tespit_theta', v_tespit.theta,
    'ustalik_once', v_eski_ustalik,
    'gunluk', v_seri,
    'saat', v_saat
  );
end $$;

-- ─────────────────────────────────────────────────────────────
-- Görev, rozet, mağaza (API hesaplar, bu fonksiyonlar tek işlemde yazar)
-- ─────────────────────────────────────────────────────────────

/** Görev ilerlemesi: [{id, ilerleme}] — ilerleme yalnızca artar; hedefe ulaşan görev ödülünü verir. */
create or replace function public.sistem_gorev_ilerlet(p_kullanici uuid, p_guncellemeler jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  g public.kullanici_gorev;
  v_tamamlanan jsonb := '[]'::jsonb;
begin
  for r in select (e ->> 'id')::uuid as id, (e ->> 'ilerleme')::integer as ilerleme from jsonb_array_elements(p_guncellemeler) e loop
    update public.kullanici_gorev
    set ilerleme = least(hedef, greatest(ilerleme, r.ilerleme)),
        tamamlandi = case when tamamlandi is null and greatest(ilerleme, r.ilerleme) >= hedef then now() else tamamlandi end
    where id = r.id and kullanici_id = p_kullanici and tamamlandi is null
    returning * into g;
    if found and g.tamamlandi is not null then
      perform app.odul_ver(p_kullanici, g.odul_xp, g.odul_altin);
      update public.ogrenci_ilerleme set
        gorev_tamamlanan = gorev_tamamlanan + case when g.tur = 'gunluk' then 1 else 0 end,
        haftalik_gorev_tamamlanan = haftalik_gorev_tamamlanan + case when g.tur = 'haftalik' then 1 else 0 end,
        -- "Seriyi geri kazan": kırılan seri geri gelir
        seri_gun = case when g.gorev_kod = 'seri_geri_kazan' then onceki_seri + seri_gun else seri_gun end,
        en_uzun_seri = case when g.gorev_kod = 'seri_geri_kazan' then greatest(en_uzun_seri, onceki_seri + seri_gun) else en_uzun_seri end,
        onceki_seri = case when g.gorev_kod = 'seri_geri_kazan' then 0 else onceki_seri end
      where kullanici_id = p_kullanici;
      v_tamamlanan := v_tamamlanan || jsonb_build_object('kod', g.gorev_kod, 'baslik', g.baslik, 'xp', g.odul_xp, 'altin', g.odul_altin);
    end if;
  end loop;
  return v_tamamlanan;
end $$;

/** Rozet verir: [{kod, altin}] — yeni kazanılanları döner, Altın ödülünü ekler. */
create or replace function public.sistem_rozet_ver(p_kullanici uuid, p_rozetler jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_dershane uuid;
  v_yeni jsonb := '[]'::jsonb;
begin
  select dershane_id into v_dershane from public.kullanici where id = p_kullanici;
  for r in select e ->> 'kod' as kod, coalesce((e ->> 'altin')::integer, 0) as altin from jsonb_array_elements(p_rozetler) e loop
    insert into public.kullanici_rozet (kullanici_id, rozet_kod, dershane_id) values (p_kullanici, r.kod, v_dershane)
    on conflict do nothing;
    if found then
      if r.altin > 0 then perform app.odul_ver(p_kullanici, 0, r.altin); end if;
      v_yeni := v_yeni || to_jsonb(r.kod);
    end if;
  end loop;
  return v_yeni;
end $$;

/** Mağaza: Altınla kozmetik veya seri dondurucu. Altın gerçek parayla satılmaz. */
create or replace function public.sistem_satin_al(p_kullanici uuid, p_kod text, p_fiyat integer, p_dondurucu boolean, p_max_dondurucu smallint)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  i public.ogrenci_ilerleme;
begin
  select * into i from public.ogrenci_ilerleme where kullanici_id = p_kullanici for update;
  if not found or i.altin < p_fiyat then raise exception 'magaza.yetersizAltin'; end if;
  if p_dondurucu then
    if i.seri_dondurucu >= p_max_dondurucu then raise exception 'magaza.dondurucuDolu'; end if;
    update public.ogrenci_ilerleme set seri_dondurucu = seri_dondurucu + 1 where kullanici_id = p_kullanici;
  else
    insert into public.envanter (kullanici_id, esya_kod, dershane_id) values (p_kullanici, p_kod, i.dershane_id)
    on conflict do nothing;
    if not found then raise exception 'magaza.zatenVar'; end if;
  end if;
  update public.ogrenci_ilerleme set altin = altin - p_fiyat where kullanici_id = p_kullanici returning * into i;
  return i.altin;
end $$;

/** Rozet ve görevler için metrikler (tek sorgu). */
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

-- ─────────────────────────────────────────────────────────────
-- Haftalık lig kapanışı ve sezon (cron, pazartesi 00:10 İstanbul)
-- ─────────────────────────────────────────────────────────────
create or replace function public.sistem_lig_kapat(p_hafta date)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  g record;
  v_n integer;
  v_yukselen integer;
  v_dusen integer;
  v_grup_sayisi integer := 0;
  v_sezon_sonu boolean := ((p_hafta - date '2026-11-02') / 7) % 6 = 5;
begin
  for g in select id from public.lig_grubu where hafta = p_hafta and kapandi is null for update loop
    v_grup_sayisi := v_grup_sayisi + 1;
    select count(*) into v_n from public.lig_uyelik where grup_id = g.id;
    v_yukselen := case when v_n >= 10 then 5 else greatest(1, v_n / 3) end;
    v_dusen := case when v_n >= 10 then 5 else 0 end;
    with sirali as (
      select kullanici_id, xp, row_number() over (order by xp desc, olusturma) as s
      from public.lig_uyelik where grup_id = g.id
    )
    update public.lig_uyelik u set
      sira = s.s,
      sonuc = case when s.s <= v_yukselen and s.xp > 0 then 'yukseldi'
                   when s.s > v_n - v_dusen then 'dustu'
                   else 'kaldi' end
    from sirali s
    where u.grup_id = g.id and u.kullanici_id = s.kullanici_id;

    update public.ogrenci_ilerleme i set
      lig_adim = least(18, greatest(1, i.lig_adim + case u.sonuc when 'yukseldi' then 1 when 'dustu' then -1 else 0 end)),
      lig_yukselme = i.lig_yukselme + case when u.sonuc = 'yukseldi' then 1 else 0 end,
      en_iyi_lig_adim = greatest(i.en_iyi_lig_adim, least(18, i.lig_adim + case when u.sonuc = 'yukseldi' then 1 else 0 end))
    from public.lig_uyelik u
    where u.grup_id = g.id and u.kullanici_id = i.kullanici_id;

    update public.lig_grubu set kapandi = now() where id = g.id;
  end loop;

  -- Sezon sonu: kademeye göre Altın ödülü, kademe bir basamak (3 adım) geri
  if v_sezon_sonu then
    with odul as (
      select i.kullanici_id, (array[50, 100, 200, 300, 400, 600])[(i.lig_adim - 1) / 3 + 1] as altin
      from public.ogrenci_ilerleme i
      where exists (select 1 from public.lig_uyelik u where u.kullanici_id = i.kullanici_id
                    and u.hafta between p_hafta - 35 and p_hafta)
    )
    update public.ogrenci_ilerleme i set altin = i.altin + o.altin, lig_adim = greatest(1, i.lig_adim - 3)
    from odul o where o.kullanici_id = i.kullanici_id;
  end if;
  return jsonb_build_object('hafta', p_hafta, 'grup', v_grup_sayisi, 'sezon_sonu', v_sezon_sonu);
end $$;

-- ─────────────────────────────────────────────────────────────
-- İstemci okumaları: lig grubum ve sıralamalar (yalnızca takma ad + karakter)
-- ─────────────────────────────────────────────────────────────
create or replace function public.lig_grubum()
returns table (sira bigint, takma_ad text, karakter text, cerceve text, xp integer, ben boolean, kademe smallint, hafta date)
language sql
stable
security definer
set search_path = ''
as $$
  with benim as (
    select u.grup_id from public.lig_uyelik u
    where u.kullanici_id = auth.uid() and u.hafta = app.hafta_basi(app.bugun())
  )
  select row_number() over (order by u.xp desc, u.olusturma), k.takma_ad::text, ka.tur, ka.cerceve, u.xp,
         u.kullanici_id = auth.uid(), g.kademe, g.hafta
  from benim b
  join public.lig_uyelik u on u.grup_id = b.grup_id
  join public.lig_grubu g on g.id = u.grup_id
  join public.kullanici k on k.id = u.kullanici_id
  left join public.karakter ka on ka.kullanici_id = u.kullanici_id
  order by 1
$$;

/** Sıralama: 'sinif' | 'sube' | 'dershane' | 'dershaneler' ; 'hafta' (haftalık XP) | 'tum' (toplam XP). İlk 50 + ben. */
create or replace function public.siralama(p_kapsam text, p_donem text default 'hafta')
returns table (sira bigint, takma_ad text, karakter text, cerceve text, dershane text, puan bigint, ben boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ben uuid := auth.uid();
  v_dershane uuid := app.dershane_id();
  v_sube uuid := app.sube_id();
  v_hafta date := app.hafta_basi(app.bugun());
begin
  if v_dershane is null then return; end if;
  if p_kapsam = 'dershaneler' and not app.ozellik_acik_mi('dershaneler_arasi_lig', v_dershane) then
    raise exception 'siralama.kapali';
  end if;
  return query
  with aday as (
    select i.kullanici_id,
           case when p_donem = 'tum' then i.xp else case when i.hafta = v_hafta then i.haftalik_xp else 0 end end::bigint as puan
    from public.ogrenci_ilerleme i
    join public.kullanici k on k.id = i.kullanici_id and k.tur = 'ogrenci' and k.silinme_talebi is null
    where case p_kapsam
      when 'sinif' then exists (
        select 1 from public.sinif_uyelik a join public.sinif_uyelik b on b.sinif_id = a.sinif_id
        where a.kullanici_id = v_ben and b.kullanici_id = i.kullanici_id and b.rol = 'ogrenci')
      when 'sube' then k.dershane_id = v_dershane and k.sube_id = v_sube
      when 'dershane' then k.dershane_id = v_dershane
      when 'dershaneler' then app.ozellik_acik_mi('dershaneler_arasi_lig', k.dershane_id)
      else false end
  ), sirali as (
    select a.*, row_number() over (order by a.puan desc, a.kullanici_id) as s from aday a
  )
  select s.s, k.takma_ad::text, ka.tur, ka.cerceve,
         case when p_kapsam = 'dershaneler' then coalesce(d.uygulama_ici_ad, d.ad) end,
         s.puan, s.kullanici_id = v_ben
  from sirali s
  join public.kullanici k on k.id = s.kullanici_id
  join public.dershane d on d.id = k.dershane_id
  left join public.karakter ka on ka.kullanici_id = s.kullanici_id
  where s.s <= 50 or s.kullanici_id = v_ben
  order by s.s;
end $$;

-- Yetkiler
do $$
declare f text;
begin
  foreach f in array array[
    'public.sistem_gorev_ilerlet(uuid, jsonb)',
    'public.sistem_rozet_ver(uuid, jsonb)',
    'public.sistem_satin_al(uuid, text, integer, boolean, smallint)',
    'public.sistem_oyun_metrikleri(uuid)',
    'public.sistem_lig_kapat(date)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
revoke execute on function public.lig_grubum() from public, anon;
grant execute on function public.lig_grubum() to authenticated;
revoke execute on function public.siralama(text, text) from public, anon;
grant execute on function public.siralama(text, text) to authenticated;
