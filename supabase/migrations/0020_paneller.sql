-- ─────────────────────────────────────────────────────────────
-- 0020 · Faz 6: Öğretmen ve Dershane Kurucu panelleri, veli görünümü
--
-- Paneller oturumdaki kullanıcının kendi jetonuyla `panel_*` fonksiyonlarını
-- çağırır. Fonksiyonlar SECURITY DEFINER'dır ama her biri yetkiyi KENDİ İÇİNDE
-- doğrular (app.yetkisi_var / sınıfın öğretmeni / velisi). Öğrenci kimliği
-- (ad-soyad) yalnızca ogrenci_kimlik_okuyabilir ise döner; aksi halde takma ad.
-- ─────────────────────────────────────────────────────────────

create table public.odev (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  olusturan_id uuid references public.kullanici (id) on delete set null,
  baslik text not null check (char_length(baslik) between 2 and 120),
  kazanim_ids uuid[] not null check (cardinality(kazanim_ids) between 1 and 20),
  soru_sayisi smallint not null check (soru_sayisi between 3 and 50),
  zorluk_modu text not null default 'uyarlamali' check (zorluk_modu in ('uyarlamali', 'sabit')),
  sabit_zorluk smallint check (sabit_zorluk between 1 and 10),
  son_tarih timestamptz not null,
  olusturma timestamptz not null default now()
);
create index odev_dershane on public.odev (dershane_id, olusturma desc);

create table public.odev_atama (
  odev_id uuid not null references public.odev (id) on delete cascade,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  cozulen smallint not null default 0,
  dogru smallint not null default 0,
  bitis timestamptz,
  primary key (odev_id, kullanici_id)
);
create index odev_atama_ogrenci on public.odev_atama (kullanici_id) where bitis is null;

create table public.rehberlik_not (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  ogrenci_id uuid not null references public.kullanici (id) on delete cascade,
  yazar_id uuid references public.kullanici (id) on delete set null,
  tur text not null default 'not' check (tur in ('not', 'gorusme', 'hedef')),
  metin text not null check (char_length(metin) between 1 and 2000),
  plan_tarihi timestamptz,
  tamamlandi boolean not null default false,
  olusturma timestamptz not null default now()
);
create index rehberlik_not_ogrenci on public.rehberlik_not (ogrenci_id, olusturma desc);

create table public.duyuru (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  sube_id uuid references public.sube (id) on delete cascade,
  sinif_id uuid references public.sinif (id) on delete cascade,
  olusturan_id uuid references public.kullanici (id) on delete set null,
  baslik text not null check (char_length(baslik) between 2 and 120),
  metin text not null check (char_length(metin) between 1 and 1000),
  olusturma timestamptz not null default now()
);
create index duyuru_dershane on public.duyuru (dershane_id, olusturma desc);

alter table public.odev enable row level security;
alter table public.odev_atama enable row level security;
alter table public.rehberlik_not enable row level security;
alter table public.duyuru enable row level security;
-- Rehberlik notu: yalnız yetkili roller; öğrenci ve veli asla görmez
create policy rehberlik_not_oku on public.rehberlik_not for select to authenticated
  using (app.yetkisi_var('rehberlik.oku', dershane_id));
revoke insert, update, delete on public.odev, public.odev_atama, public.rehberlik_not, public.duyuru from anon, authenticated;

-- ── Yardımcılar ──

/** Görünen ad: kimlik okuyabiliyorsa "Ad Soyad", değilse takma ad. */
create or replace function app.gorunen_ad(p_ogrenci uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case when app.ogrenci_kimlik_okuyabilir(k.id) then k.ad || ' ' || k.soyad else coalesce(k.takma_ad::text, 'Öğrenci') end
  from public.kullanici k where k.id = p_ogrenci
$$;

/** Sınıf analizine erişim: sınıfın öğretmeni ya da şube/dershane raporu yetkilisi. */
create or replace function app.sinif_okuyabilir(p_sinif uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.sinifin_ogretmeni_mi(p_sinif)
      or exists (select 1 from public.sinif s where s.id = p_sinif and app.yetkisi_var('rapor.oku', s.dershane_id, s.sube_id))
$$;

/**
 * Risk skoru (0-100) ve destek odaklı nedenler. Sinyaller: uzun süredir
 * çalışmama, haftalık soru düşüşü, kaçırılan ödev, doğrulukta düşüş, tek derse
 * sıkışma.
 */
create or replace function app.risk(p_ogrenci uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_son timestamptz;
  v_gun integer;
  v_bu integer; v_onceki integer;
  v_dogru_bu numeric; v_dogru_onceki numeric;
  v_kacan integer;
  v_ders integer;
  v_puan integer := 0;
  v_nedenler text[] := '{}';
begin
  select max(olusturma) into v_son from public.cevap where kullanici_id = p_ogrenci and olusturma > now() - interval '60 days';
  v_gun := coalesce(extract(day from now() - v_son)::integer, 60);
  select count(*) filter (where olusturma > now() - interval '7 days'),
         count(*) filter (where olusturma <= now() - interval '7 days'),
         avg(dogru_mu::int) filter (where olusturma > now() - interval '7 days'),
         avg(dogru_mu::int) filter (where olusturma <= now() - interval '7 days')
    into v_bu, v_onceki, v_dogru_bu, v_dogru_onceki
  from public.cevap where kullanici_id = p_ogrenci and olusturma > now() - interval '14 days';
  select count(*) into v_kacan from public.odev_atama a join public.odev o on o.id = a.odev_id
  where a.kullanici_id = p_ogrenci and a.bitis is null and o.son_tarih < now() and o.son_tarih > now() - interval '30 days';
  select count(distinct k.unite_id) into v_ders from public.cevap c join public.kazanim k on k.id = c.kazanim_id
  where c.kullanici_id = p_ogrenci and c.olusturma > now() - interval '14 days';

  if v_gun >= 5 then
    v_puan := v_puan + least(45, 20 + v_gun * 2);
    v_nedenler := v_nedenler || format('%s gündür soru çözmedi', v_gun);
  end if;
  if v_onceki >= 10 and v_bu < v_onceki * 0.5 then
    v_puan := v_puan + 25;
    v_nedenler := v_nedenler || format('Bu hafta %s soru (geçen hafta %s)', v_bu, v_onceki);
  end if;
  if v_kacan > 0 then
    v_puan := v_puan + least(30, v_kacan * 12);
    v_nedenler := v_nedenler || format('%s ödevi yetiştiremedi', v_kacan);
  end if;
  if v_bu >= 15 and v_onceki >= 15 and v_dogru_onceki - v_dogru_bu >= 0.15 then
    v_puan := v_puan + 15;
    v_nedenler := v_nedenler || format('Doğruluk %%%s → %%%s', round(v_dogru_onceki * 100), round(v_dogru_bu * 100));
  end if;
  if v_bu + v_onceki >= 20 and v_ders = 1 then
    v_puan := v_puan + 10;
    v_nedenler := v_nedenler || 'İki haftadır tek üniteye çalışıyor';
  end if;
  return jsonb_build_object('puan', least(100, v_puan), 'nedenler', to_jsonb(v_nedenler), 'son_cozum', v_son);
end;
$$;

-- ── Öğretmen paneli ──

create or replace function public.panel_siniflarim()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', s.id, 'ad', s.ad, 'sinav_turu', s.sinav_turu, 'seviye', s.seviye, 'sube', sb.ad,
      'ogrenci', (select count(*) from public.sinif_uyelik u where u.sinif_id = s.id and u.rol = 'ogrenci'),
      'aktif7', (select count(distinct c.kullanici_id) from public.cevap c join public.sinif_uyelik u on u.kullanici_id = c.kullanici_id and u.sinif_id = s.id and u.rol = 'ogrenci'
                 where c.olusturma > now() - interval '7 days'),
      'soru7', (select count(*) from public.cevap c join public.sinif_uyelik u on u.kullanici_id = c.kullanici_id and u.sinif_id = s.id and u.rol = 'ogrenci'
                where c.olusturma > now() - interval '7 days'),
      'ogretmenim', app.sinifin_ogretmeni_mi(s.id)
    ) order by sb.ad, s.ad), '[]'::jsonb)
  from public.sinif s join public.sube sb on sb.id = s.sube_id
  where app.sinif_okuyabilir(s.id)
$$;

create or replace function public.panel_sinif_analiz(p_sinif uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_s public.sinif;
begin
  select * into v_s from public.sinif where id = p_sinif;
  if not found or not app.sinif_okuyabilir(p_sinif) then raise exception 'panel.yetkisiz'; end if;
  return jsonb_build_object(
    'sinif', jsonb_build_object('id', v_s.id, 'ad', v_s.ad, 'sinav_turu', v_s.sinav_turu),
    'ogrenciler', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id, 'ad', app.gorunen_ad(k.id), 'takma_ad', k.takma_ad::text, 'son_giris', k.son_giris,
        'soru7', (select count(*) from public.cevap c where c.kullanici_id = k.id and c.olusturma > now() - interval '7 days'),
        'dogruluk', (select round(avg(c.dogru_mu::int) * 100) from public.cevap c where c.kullanici_id = k.id and c.olusturma > now() - interval '30 days'),
        'seviye', coalesce(i.seviye, 1), 'risk', app.risk(k.id)) order by k.ad)
      from public.sinif_uyelik u join public.kullanici k on k.id = u.kullanici_id
      left join public.ogrenci_ilerleme i on i.kullanici_id = k.id
      where u.sinif_id = p_sinif and u.rol = 'ogrenci'), '[]'::jsonb),
    -- Isı haritası sütunları: sınıfın en çok çalıştığı 24 kazanım
    'kazanimlar', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.id, 'kod', x.kod, 'aciklama', x.aciklama, 'ders', x.ders) order by x.ders, x.kod)
      from (
        select kz.id, kz.kod, kz.aciklama, d.ad as ders
        from public.beceri b join public.sinif_uyelik u on u.kullanici_id = b.kullanici_id and u.sinif_id = p_sinif and u.rol = 'ogrenci'
        join public.kazanim kz on kz.id = b.kazanim_id join public.unite un on un.id = kz.unite_id join public.ders d on d.id = un.ders_id
        where b.cozulen > 0
        group by kz.id, kz.kod, kz.aciklama, d.ad
        order by count(*) desc, sum(b.cozulen) desc
        limit 24
      ) x), '[]'::jsonb),
    'hucreler', coalesce((
      select jsonb_agg(jsonb_build_array(b.kullanici_id, b.kazanim_id, b.ustalik, round(b.dogru::numeric / greatest(b.cozulen, 1) * 100), b.cozulen))
      from public.beceri b join public.sinif_uyelik u on u.kullanici_id = b.kullanici_id and u.sinif_id = p_sinif and u.rol = 'ogrenci'
      where b.cozulen > 0), '[]'::jsonb),
    -- En çok yanlış yapılan 10 kazanım + en sık seçilen yanlış şıklar (son 30 gün)
    'zayif', coalesce((
      select jsonb_agg(z order by z.yanlis_orani desc)
      from (
        select kz.kod, kz.aciklama, d.ad as ders, count(*) as cozulen,
          round(avg((not c.dogru_mu)::int) * 100) as yanlis_orani,
          (select coalesce(jsonb_agg(jsonb_build_object('govde', left(s2.govde_md, 140), 'sik', y.secilen, 'metin', left(s2.siklar ->> y.secilen, 80), 'sayi', y.n) order by y.n desc), '[]'::jsonb)
           from (select c2.soru_id, c2.secilen, count(*) as n from public.cevap c2
                 join public.sinif_uyelik u2 on u2.kullanici_id = c2.kullanici_id and u2.sinif_id = p_sinif and u2.rol = 'ogrenci'
                 where c2.kazanim_id = kz.id and not c2.dogru_mu and c2.secilen is not null and c2.olusturma > now() - interval '30 days'
                 group by c2.soru_id, c2.secilen having count(*) >= 2 order by count(*) desc limit 3) y
           join public.soru s2 on s2.id = y.soru_id) as celdiriciler
        from public.cevap c join public.sinif_uyelik u on u.kullanici_id = c.kullanici_id and u.sinif_id = p_sinif and u.rol = 'ogrenci'
        join public.kazanim kz on kz.id = c.kazanim_id join public.unite un on un.id = kz.unite_id join public.ders d on d.id = un.ders_id
        where c.olusturma > now() - interval '30 days' and c.baglam <> 'duello'
        group by kz.id, kz.kod, kz.aciklama, d.ad
        having count(*) >= 5
        order by avg((not c.dogru_mu)::int) desc
        limit 10
      ) z), '[]'::jsonb)
  );
end;
$$;

create or replace function public.panel_ogrenci_detay(p_ogrenci uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_k public.kullanici;
begin
  select * into v_k from public.kullanici where id = p_ogrenci and tur = 'ogrenci';
  if not found or not app.ogrenci_akademik_okuyabilir(p_ogrenci) or p_ogrenci = auth.uid() then raise exception 'panel.yetkisiz'; end if;
  return jsonb_build_object(
    'id', v_k.id, 'ad', app.gorunen_ad(v_k.id), 'takma_ad', v_k.takma_ad::text, 'son_giris', v_k.son_giris,
    'sinif', (select string_agg(s.ad, ', ') from public.sinif_uyelik u join public.sinif s on s.id = u.sinif_id where u.kullanici_id = v_k.id and u.rol = 'ogrenci'),
    'sube', (select ad from public.sube where id = v_k.sube_id),
    'ilerleme', (select jsonb_build_object('seviye', seviye, 'xp', xp, 'seri', seri_gun, 'toplam_cevap', toplam_cevap, 'toplam_dogru', toplam_dogru, 'kupa', kupa)
                 from public.ogrenci_ilerleme where kullanici_id = v_k.id),
    'risk', app.risk(v_k.id),
    -- Son 28 gün: gün başına soru ve dakika
    'gunluk', coalesce((
      select jsonb_agg(jsonb_build_object('gun', g.gun, 'soru', coalesce(x.n, 0), 'dk', coalesce(x.dk, 0)) order by g.gun)
      from generate_series(app.bugun() - 27, app.bugun(), interval '1 day') g(gun)
      left join (
        select (c.olusturma at time zone 'Europe/Istanbul')::date as gun, count(*) as n, round(sum(least(c.sure_ms, 300000)) / 60000.0) as dk
        from public.cevap c where c.kullanici_id = v_k.id and c.olusturma > now() - interval '29 days' group by 1
      ) x on x.gun = g.gun::date), '[]'::jsonb),
    -- Ders bazında son 8 hafta doğruluk
    'dersler', coalesce((
      select jsonb_agg(jsonb_build_object('ders', y.ders, 'haftalar', y.haftalar, 'cozulen', y.toplam) order by y.toplam desc)
      from (
        select d.ad as ders, sum(w.n) as toplam,
          jsonb_agg(jsonb_build_object('hafta', w.hafta, 'n', w.n, 'dogruluk', w.dogruluk) order by w.hafta) as haftalar
        from (
          select un.ders_id, date_trunc('week', c.olusturma)::date as hafta, count(*) as n, round(avg(c.dogru_mu::int) * 100) as dogruluk
          from public.cevap c join public.kazanim kz on kz.id = c.kazanim_id join public.unite un on un.id = kz.unite_id
          where c.kullanici_id = v_k.id and c.olusturma > now() - interval '56 days'
          group by 1, 2
        ) w join public.ders d on d.id = w.ders_id
        group by d.ad
      ) y), '[]'::jsonb),
    'guclu', coalesce((select jsonb_agg(jsonb_build_object('kod', kz.kod, 'aciklama', kz.aciklama, 'ustalik', b.ustalik))
      from (select * from public.beceri where kullanici_id = v_k.id and cozulen >= 5 order by theta desc limit 3) b join public.kazanim kz on kz.id = b.kazanim_id), '[]'::jsonb),
    'zayif', coalesce((select jsonb_agg(jsonb_build_object('kod', kz.kod, 'aciklama', kz.aciklama, 'id', kz.id))
      from (select * from public.beceri where kullanici_id = v_k.id and cozulen >= 3 order by theta asc limit 3) b join public.kazanim kz on kz.id = b.kazanim_id), '[]'::jsonb),
    'hata_defteri', (select count(*) from public.hata_defteri where kullanici_id = v_k.id and durum = 'acik'),
    'odevler', coalesce((select jsonb_agg(jsonb_build_object('baslik', o.baslik, 'son_tarih', o.son_tarih, 'cozulen', a.cozulen, 'soru_sayisi', o.soru_sayisi, 'bitis', a.bitis) order by o.son_tarih desc)
      from public.odev_atama a join public.odev o on o.id = a.odev_id where a.kullanici_id = v_k.id and o.olusturma > now() - interval '60 days'), '[]'::jsonb),
    'duello', (select jsonb_build_object('toplam', duello_toplam, 'galibiyet', duello_galibiyet) from public.ogrenci_ilerleme where kullanici_id = v_k.id),
    'klan', (select k.ad::text from public.klan_uyelik u join public.klan k on k.id = u.klan_id where u.kullanici_id = v_k.id),
    'rozet', (select count(*) from public.kullanici_rozet where kullanici_id = v_k.id),
    'veli_bagli', exists (select 1 from public.veli_bag where ogrenci_id = v_k.id and onay_tarihi is not null),
    'rehberlik', case when app.yetkisi_var('rehberlik.oku', v_k.dershane_id) then coalesce((
      select jsonb_agg(jsonb_build_object('id', n.id, 'tur', n.tur, 'metin', n.metin, 'plan_tarihi', n.plan_tarihi, 'tamamlandi', n.tamamlandi,
        'yazar', (select ad || ' ' || soyad from public.kullanici where id = n.yazar_id), 'olusturma', n.olusturma) order by n.olusturma desc)
      from public.rehberlik_not n where n.ogrenci_id = v_k.id), '[]'::jsonb) end
  );
end;
$$;

/** Ödev oluştur: sınıf(lar) ve/veya öğrenciler; kazanımlar; uyarlamalı ya da sabit zorluk. */
create or replace function public.panel_odev_olustur(
  p_baslik text, p_kazanimlar uuid[], p_siniflar uuid[], p_ogrenciler uuid[], p_soru_sayisi integer,
  p_zorluk_modu text, p_sabit_zorluk integer, p_son_tarih timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d uuid := app.dershane_id();
  v_id uuid;
  v_s uuid;
  v_n integer;
begin
  if v_d is null or not app.yetkisi_var('odev.yonet', v_d) then raise exception 'panel.yetkisiz'; end if;
  if p_son_tarih <= now() then raise exception 'panel.tarihGecersiz'; end if;
  foreach v_s in array coalesce(p_siniflar, '{}') loop
    if not app.sinif_okuyabilir(v_s) then raise exception 'panel.yetkisiz'; end if;
  end loop;
  if exists (select 1 from unnest(coalesce(p_ogrenciler, '{}')) o where not app.ogrenci_akademik_okuyabilir(o)) then raise exception 'panel.yetkisiz'; end if;
  if (select count(*) from public.kazanim where id = any (p_kazanimlar)) <> cardinality(p_kazanimlar) then raise exception 'panel.kazanimGecersiz'; end if;

  insert into public.odev (dershane_id, olusturan_id, baslik, kazanim_ids, soru_sayisi, zorluk_modu, sabit_zorluk, son_tarih)
  values (v_d, auth.uid(), p_baslik, p_kazanimlar, p_soru_sayisi, p_zorluk_modu, case when p_zorluk_modu = 'sabit' then p_sabit_zorluk end, p_son_tarih)
  returning id into v_id;
  insert into public.odev_atama (odev_id, kullanici_id, dershane_id)
  select distinct v_id, x.id, v_d from (
    select u.kullanici_id as id from public.sinif_uyelik u where u.sinif_id = any (coalesce(p_siniflar, '{}')) and u.rol = 'ogrenci'
    union select unnest(coalesce(p_ogrenciler, '{}'))
  ) x join public.kullanici k on k.id = x.id and k.dershane_id = v_d and k.tur = 'ogrenci'
  on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'panel.ogrenciYok'; end if;
  return v_id;
end;
$$;

/** Tek tıkla: sınıfın en zayıf 3 kazanımına 10 soruluk uyarlamalı ödev (3 gün). */
create or replace function public.panel_zayif_konulara_odev(p_sinif uuid, p_ogrenci uuid default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kz uuid[];
begin
  if p_ogrenci is not null then
    select array_agg(kazanim_id) into v_kz from (select kazanim_id from public.beceri where kullanici_id = p_ogrenci and cozulen >= 3 order by theta limit 3) x;
  else
    select array_agg(kazanim_id) into v_kz from (
      select c.kazanim_id from public.cevap c join public.sinif_uyelik u on u.kullanici_id = c.kullanici_id and u.sinif_id = p_sinif and u.rol = 'ogrenci'
      where c.olusturma > now() - interval '30 days' and c.baglam <> 'duello'
      group by c.kazanim_id having count(*) >= 5 order by avg((not c.dogru_mu)::int) desc limit 3) x;
  end if;
  if v_kz is null then raise exception 'panel.veriYok'; end if;
  return public.panel_odev_olustur('Zayıf konular tekrarı', v_kz,
    case when p_ogrenci is null then array[p_sinif] else '{}'::uuid[] end,
    case when p_ogrenci is null then '{}'::uuid[] else array[p_ogrenci] end,
    10, 'uyarlamali', null, now() + interval '3 days');
end;
$$;

create or replace function public.panel_odevler()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'baslik', o.baslik, 'son_tarih', o.son_tarih, 'olusturma', o.olusturma, 'soru_sayisi', o.soru_sayisi, 'zorluk_modu', o.zorluk_modu,
      'kazanimlar', (select jsonb_agg(kod) from public.kazanim where id = any (o.kazanim_ids)),
      'atanan', (select count(*) from public.odev_atama a where a.odev_id = o.id),
      'biten', (select count(*) from public.odev_atama a where a.odev_id = o.id and a.bitis is not null),
      'dogruluk', (select round(sum(a.dogru)::numeric / nullif(sum(a.cozulen), 0) * 100) from public.odev_atama a where a.odev_id = o.id),
      'benim', o.olusturan_id = auth.uid()
    ) order by o.olusturma desc), '[]'::jsonb)
  from public.odev o
  where o.dershane_id = app.dershane_id() and (o.olusturan_id = auth.uid() or app.yetkisi_var('rapor.oku', o.dershane_id))
    and o.olusturma > now() - interval '90 days'
$$;

/** Bekleyenler kutusu: şikâyet, soru hata bildirimi, şüpheli düello, öğretmen onayı bekleyen topluluk çözümü, klan adı onayı. */
create or replace function public.panel_bekleyenler()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_d uuid := app.dershane_id();
begin
  if v_d is null or not app.yetkisi_var('moderasyon.yap', v_d) then raise exception 'panel.yetkisiz'; end if;
  return jsonb_build_object(
    'sikayetler', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'hedef_tur', s.hedef_tur, 'hedef_id', s.hedef_id, 'sebep', s.sebep, 'oncelikli', s.oncelikli, 'olusturma', s.olusturma,
        'onizleme', case s.hedef_tur
          when 'klan_mesaj' then (select coalesce(m.metin, m.kod) from public.klan_mesaj m where m.id::text = s.hedef_id)
          when 'topluluk_soru' then (select left(q.metin, 200) from public.topluluk_soru q where q.id::text = s.hedef_id)
          when 'topluluk_cevap' then (select left(c.aciklama, 200) from public.topluluk_cevap c where c.id::text = s.hedef_id)
          when 'klan' then (select ad::text from public.klan where id::text = s.hedef_id) end,
        'sayi', (select count(*) from public.sikayet s2 where s2.hedef_tur = s.hedef_tur and s2.hedef_id = s.hedef_id and s2.durum = 'acik'))
        order by s.oncelikli desc, s.olusturma)
      from (select distinct on (hedef_tur, hedef_id) * from public.sikayet where dershane_id = v_d and durum = 'acik' order by hedef_tur, hedef_id, oncelikli desc, olusturma) s), '[]'::jsonb),
    'soru_hatalari', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'soru_id', b.soru_id, 'aciklama', b.aciklama, 'govde', left(q.govde_md, 300), 'dogru', q.dogru, 'olusturma', b.olusturma) order by b.olusturma)
      from public.soru_hata_bildirimi b join public.soru q on q.id = b.soru_id where b.dershane_id = v_d and b.durum = 'bekliyor'), '[]'::jsonb),
    'duellolar', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'ogrenci', app.gorunen_ad(i.kullanici_id), 'neden', i.neden, 'duello_id', i.duello_id, 'olusturma', i.olusturma) order by i.olusturma)
      from public.duello_inceleme i where i.dershane_id = v_d and i.durum = 'bekliyor'), '[]'::jsonb),
    'topluluk', coalesce((
      select jsonb_agg(jsonb_build_object('id', q.id, 'metin', left(q.metin, 300), 'ai_cozum', q.ai_cozum, 'olusturma', q.olusturma,
        'cevaplar', (select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'aciklama', left(c.aciklama, 400), 'sik', c.sik, 'ai_dogru', c.ai_dogru, 'kabul', c.kabul) order by c.olusturma), '[]'::jsonb)
                     from public.topluluk_cevap c where c.soru_id = q.id and not c.gizli)) order by q.olusturma)
      from public.topluluk_soru q where q.dershane_id = v_d and (q.ogretmen_bekliyor or (q.durum = 'acik' and q.olusturma < now() - interval '2 hours'))
        and q.olusturma > now() - interval '14 days' and q.durum <> 'gizli'), '[]'::jsonb),
    'klanlar', coalesce((
      select jsonb_agg(jsonb_build_object('id', k.id, 'ad', k.ad::text, 'slogan', k.slogan, 'olusturma', k.olusturma))
      from public.klan k where k.dershane_id = v_d and k.onay_durumu = 'bekliyor'), '[]'::jsonb)
  );
end;
$$;

/** Bekleyen karar: tur = sikayet | soru_hatasi | duello | klan; karar = onay | red | gizle */
create or replace function public.panel_karar(p_tur text, p_id text, p_karar text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d uuid := app.dershane_id();
  v_s public.sikayet;
begin
  if v_d is null or not app.yetkisi_var('moderasyon.yap', v_d) then raise exception 'panel.yetkisiz'; end if;
  case p_tur
    when 'sikayet' then
      select * into v_s from public.sikayet where id = p_id::uuid and dershane_id = v_d;
      if not found then raise exception 'panel.bulunamadi'; end if;
      if p_karar = 'gizle' then
        if v_s.hedef_tur = 'klan_mesaj' then update public.klan_mesaj set gizli = true where id = v_s.hedef_id::bigint and dershane_id = v_d;
        elsif v_s.hedef_tur = 'topluluk_soru' then update public.topluluk_soru set durum = 'gizli' where id = v_s.hedef_id::uuid and dershane_id = v_d;
        elsif v_s.hedef_tur = 'topluluk_cevap' then update public.topluluk_cevap set gizli = true where id = v_s.hedef_id::uuid and dershane_id = v_d;
        end if;
      elsif p_karar = 'red' then
        -- Şikâyet yersizse otomatik gizlenen içerik geri açılır
        if v_s.hedef_tur = 'klan_mesaj' then update public.klan_mesaj set gizli = false where id = v_s.hedef_id::bigint and dershane_id = v_d;
        elsif v_s.hedef_tur = 'topluluk_soru' then update public.topluluk_soru set durum = 'acik' where id = v_s.hedef_id::uuid and dershane_id = v_d and durum = 'gizli';
        elsif v_s.hedef_tur = 'topluluk_cevap' then update public.topluluk_cevap set gizli = false where id = v_s.hedef_id::uuid and dershane_id = v_d;
        end if;
      end if;
      update public.sikayet set durum = case when p_karar = 'red' then 'reddedildi' else 'incelendi' end
      where dershane_id = v_d and hedef_tur = v_s.hedef_tur and hedef_id = v_s.hedef_id and durum = 'acik';
    when 'soru_hatasi' then
      update public.soru_hata_bildirimi set durum = case when p_karar = 'onay' then 'onaylandi' else 'reddedildi' end,
        inceleyen = auth.uid(), karar_tarihi = now()
      where id = p_id::uuid and dershane_id = v_d;
      -- Onaylanan hata: soru herkes için emekliye ayrılır
      if p_karar = 'onay' then
        update public.soru set durum = 'emekli' where id = (select soru_id from public.soru_hata_bildirimi where id = p_id::uuid);
      end if;
    when 'duello' then
      update public.duello_inceleme set durum = 'incelendi' where id = p_id::uuid and dershane_id = v_d;
    when 'klan' then
      update public.klan set onay_durumu = case when p_karar = 'onay' then 'onayli' else 'reddedildi' end where id = p_id::uuid and dershane_id = v_d;
    else raise exception 'panel.gecersiz';
  end case;
end;
$$;

/** Öğretmen topluluk cevabını onaylar (puanı verir, örnek çözüm işaretleyebilir). */
create or replace function public.panel_topluluk_onay(p_cevap uuid, p_ornek boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.topluluk_cevap c where c.id = p_cevap and app.yetkisi_var('moderasyon.yap', c.dershane_id)) then
    raise exception 'panel.yetkisiz';
  end if;
  return public.sistem_topluluk_kabul(auth.uid(), p_cevap, 'ogretmen', p_ornek, 50, 20, 20, 300, 10);
end;
$$;

-- ── Dershane kurucu paneli ──

create or replace function public.panel_dershane_ozet()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_d uuid := app.dershane_id();
  v_ogrenci integer;
begin
  if v_d is null or not app.yetkisi_var('rapor.oku', v_d) then raise exception 'panel.yetkisiz'; end if;
  select count(*) into v_ogrenci from public.kullanici where dershane_id = v_d and tur = 'ogrenci';
  return jsonb_build_object(
    'ogrenci', v_ogrenci,
    'limit', (select ogrenci_limiti from public.dershane where id = v_d),
    'lisans', (select jsonb_build_object('durum', lisans_durumu, 'bitis', lisans_bitis) from public.dershane where id = v_d),
    'aktif_bugun', (select count(distinct kullanici_id) from public.cevap where dershane_id = v_d and olusturma >= (app.bugun()::timestamp at time zone 'Europe/Istanbul')),
    'aktif_hafta', (select count(distinct kullanici_id) from public.cevap where dershane_id = v_d and olusturma > now() - interval '7 days'),
    'soru_hafta', (select count(*) from public.cevap where dershane_id = v_d and olusturma > now() - interval '7 days'),
    'dk_hafta', (select round(sum(least(sure_ms, 300000)) / 60000.0) from public.cevap where dershane_id = v_d and olusturma > now() - interval '7 days'),
    'aktif_ogretmen', (select count(distinct k.id) from public.kullanici k join public.kullanici_rol r on r.kullanici_id = k.id and r.rol_kod = 'ogretmen'
                       where k.dershane_id = v_d and k.son_giris > now() - interval '7 days'),
    'ogretmen', (select count(distinct r.kullanici_id) from public.kullanici_rol r where r.dershane_id = v_d and r.rol_kod = 'ogretmen'),
    'bekleyen_odev', (select count(*) from public.odev_atama a join public.odev o on o.id = a.odev_id where a.dershane_id = v_d and a.bitis is null and o.son_tarih > now()),
    'riskli', (select count(*) from public.kullanici k where k.dershane_id = v_d and k.tur = 'ogrenci' and (app.risk(k.id) ->> 'puan')::int >= 40),
    'trend', coalesce((
      select jsonb_agg(jsonb_build_object('hafta', g.hafta, 'soru', coalesce(x.soru, 0), 'aktif', coalesce(x.aktif, 0)) order by g.hafta)
      from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') g(hafta)
      left join (select date_trunc('week', olusturma) as hafta, count(*) as soru, count(distinct kullanici_id) as aktif
                 from public.cevap where dershane_id = v_d and olusturma > now() - interval '8 weeks' group by 1) x on x.hafta = g.hafta), '[]'::jsonb),
    'subeler', coalesce((
      select jsonb_agg(jsonb_build_object('ad', sb.ad,
        'ogrenci', (select count(*) from public.kullanici k where k.sube_id = sb.id and k.tur = 'ogrenci'),
        'aktif', (select count(distinct c.kullanici_id) from public.cevap c join public.kullanici k on k.id = c.kullanici_id where k.sube_id = sb.id and c.olusturma > now() - interval '7 days'),
        'soru', (select count(*) from public.cevap c join public.kullanici k on k.id = c.kullanici_id where k.sube_id = sb.id and c.olusturma > now() - interval '7 days'),
        'dogruluk', (select round(avg(c.dogru_mu::int) * 100) from public.cevap c join public.kullanici k on k.id = c.kullanici_id where k.sube_id = sb.id and c.olusturma > now() - interval '7 days'))
        order by sb.ad)
      from public.sube sb where sb.dershane_id = v_d), '[]'::jsonb),
    'gelisenler', coalesce((
      select jsonb_agg(jsonb_build_object('id', x.kullanici_id, 'ad', app.gorunen_ad(x.kullanici_id), 'soru', x.n, 'artis', x.artis) order by x.artis desc)
      from (
        select kullanici_id, count(*) as n, sum(coalesce(theta_sonra, 0) - coalesce(theta_once, 0)) as artis
        from public.cevap where dershane_id = v_d and olusturma > now() - interval '7 days' and theta_once is not null
        group by kullanici_id having count(*) >= 10 order by 3 desc limit 5) x), '[]'::jsonb),
    'aktif_sinif', (
      select jsonb_build_object('ad', s.ad, 'soru', count(*))
      from public.cevap c join public.sinif_uyelik u on u.kullanici_id = c.kullanici_id and u.rol = 'ogrenci' join public.sinif s on s.id = u.sinif_id
      where c.dershane_id = v_d and c.olusturma > now() - interval '7 days'
      group by s.id, s.ad order by count(*) desc limit 1),
    'klan_savaslari', coalesce((
      select jsonb_agg(jsonb_build_object('a', ka.ad::text, 'b', kb.ad::text, 'kazanan', kz.ad::text, 'durum', s.durum) order by s.baslangic desc)
      from public.klan_savasi s join public.klan ka on ka.id = s.klan_a join public.klan kb on kb.id = s.klan_b left join public.klan kz on kz.id = s.kazanan
      where s.dershane_id = v_d and s.hafta >= app.hafta_basi(app.bugun()) - 7), '[]'::jsonb)
  );
end;
$$;

create or replace function public.panel_ogrenciler()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_d uuid := app.dershane_id();
begin
  if v_d is null or not (app.yetkisi_var('rapor.oku', v_d) or app.yetkisi_var('ogrenci.akademik_oku', v_d)) then raise exception 'panel.yetkisiz'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', k.id, 'ad', app.gorunen_ad(k.id), 'takma_ad', k.takma_ad::text, 'sube', sb.ad, 'son_giris', k.son_giris, 'sinav_grubu', k.sinav_grubu,
      'sinif', (select string_agg(s.ad, ', ') from public.sinif_uyelik u join public.sinif s on s.id = u.sinif_id where u.kullanici_id = k.id and u.rol = 'ogrenci'),
      'soru7', (select count(*) from public.cevap c where c.kullanici_id = k.id and c.olusturma > now() - interval '7 days'),
      'dogruluk', (select round(avg(c.dogru_mu::int) * 100) from public.cevap c where c.kullanici_id = k.id and c.olusturma > now() - interval '30 days'),
      'seviye', coalesce(i.seviye, 1),
      'veli', exists (select 1 from public.veli_bag v where v.ogrenci_id = k.id and v.onay_tarihi is not null),
      'risk', app.risk(k.id)) order by k.ad, k.soyad)
    from public.kullanici k left join public.sube sb on sb.id = k.sube_id left join public.ogrenci_ilerleme i on i.kullanici_id = k.id
    where k.dershane_id = v_d and k.tur = 'ogrenci' and app.ogrenci_akademik_okuyabilir(k.id)), '[]'::jsonb);
end;
$$;

create or replace function public.panel_ogretmenler()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_d uuid := app.dershane_id();
begin
  if v_d is null or not app.yetkisi_var('ogretmen.takip', v_d) then raise exception 'panel.yetkisiz'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', k.id, 'ad', k.ad || ' ' || k.soyad, 'son_giris', k.son_giris,
      'siniflar', (select coalesce(jsonb_agg(s.ad order by s.ad), '[]'::jsonb) from public.sinif_uyelik u join public.sinif s on s.id = u.sinif_id where u.kullanici_id = k.id and u.rol = 'ogretmen'),
      'odev30', (select count(*) from public.odev o where o.olusturan_id = k.id and o.olusturma > now() - interval '30 days'),
      'onay30', (select count(*) from public.topluluk_cevap c join public.topluluk_soru q on q.id = c.soru_id
                 where q.dershane_id = v_d and c.kabul = 'ogretmen' and c.kabul_zamani > now() - interval '30 days'),
      'sinif_aktiflik', (select round(avg(case when exists (select 1 from public.cevap c where c.kullanici_id = u2.kullanici_id and c.olusturma > now() - interval '7 days') then 100 else 0 end))
                         from public.sinif_uyelik u join public.sinif_uyelik u2 on u2.sinif_id = u.sinif_id and u2.rol = 'ogrenci'
                         where u.kullanici_id = k.id and u.rol = 'ogretmen')
    ) order by k.ad)
    from public.kullanici k
    where k.dershane_id = v_d and exists (select 1 from public.kullanici_rol r where r.kullanici_id = k.id and r.rol_kod = 'ogretmen')), '[]'::jsonb);
end;
$$;

create or replace function public.panel_rehberlik()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_d uuid := app.dershane_id();
begin
  if v_d is null or not app.yetkisi_var('rehberlik.oku', v_d) then raise exception 'panel.yetkisiz'; end if;
  return jsonb_build_object(
    'bildirimler', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'ogrenci_id', b.kullanici_id, 'ogrenci', app.gorunen_ad(b.kullanici_id),
        'kaynak', b.kaynak, 'ozet', b.ozet, 'durum', b.durum, 'olusturma', b.olusturma) order by (b.durum = 'yeni') desc, b.olusturma desc)
      from public.rehberlik_bildirim b where b.dershane_id = v_d and b.olusturma > now() - interval '60 days'), '[]'::jsonb),
    'riskliler', coalesce((select jsonb_agg(x order by (x ->> 'puan')::int desc) from (
        select jsonb_build_object('id', k.id, 'ad', app.gorunen_ad(k.id), 'puan', (r ->> 'puan')::int, 'nedenler', r -> 'nedenler') as x
        from public.kullanici k, lateral (select app.risk(k.id) as r) rr(r)
        where k.dershane_id = v_d and k.tur = 'ogrenci' and (r ->> 'puan')::int >= 40) y), '[]'::jsonb),
    'planlar', coalesce((select jsonb_agg(jsonb_build_object('id', n.id, 'ogrenci_id', n.ogrenci_id, 'ogrenci', app.gorunen_ad(n.ogrenci_id), 'tur', n.tur, 'metin', n.metin, 'plan_tarihi', n.plan_tarihi) order by n.plan_tarihi)
      from public.rehberlik_not n where n.dershane_id = v_d and n.tur in ('gorusme', 'hedef') and not n.tamamlandi), '[]'::jsonb)
  );
end;
$$;

create or replace function public.panel_rehberlik_not(p_ogrenci uuid, p_tur text, p_metin text, p_plan timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d uuid;
  v_id uuid;
begin
  select dershane_id into v_d from public.kullanici where id = p_ogrenci and tur = 'ogrenci';
  if v_d is null or not (app.yetkisi_var('rehberlik.yaz', v_d) or app.yetkisi_var('rehberlik.oku', v_d)) then raise exception 'panel.yetkisiz'; end if;
  insert into public.rehberlik_not (dershane_id, ogrenci_id, yazar_id, tur, metin, plan_tarihi)
  values (v_d, p_ogrenci, auth.uid(), p_tur, p_metin, p_plan) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.panel_rehberlik_guncelle(p_tur text, p_id uuid, p_durum text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d uuid := app.dershane_id();
begin
  if v_d is null or not app.yetkisi_var('rehberlik.oku', v_d) then raise exception 'panel.yetkisiz'; end if;
  if p_tur = 'bildirim' then
    update public.rehberlik_bildirim set durum = p_durum where id = p_id and dershane_id = v_d and p_durum in ('goruldu', 'kapandi');
  else
    update public.rehberlik_not set tamamlandi = true where id = p_id and dershane_id = v_d;
  end if;
end;
$$;

create or replace function public.panel_duyuru(p_baslik text, p_metin text, p_sube uuid, p_sinif uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d uuid := app.dershane_id();
  v_id uuid;
begin
  if v_d is null then raise exception 'panel.yetkisiz'; end if;
  if p_sinif is not null then
    if not (app.sinifin_ogretmeni_mi(p_sinif) or exists (select 1 from public.sinif s where s.id = p_sinif and app.yetkisi_var('sinif.yonet', s.dershane_id, s.sube_id))) then
      raise exception 'panel.yetkisiz';
    end if;
  elsif p_sube is not null then
    if not app.yetkisi_var('sinif.yonet', v_d, p_sube) then raise exception 'panel.yetkisiz'; end if;
  elsif not app.yetkisi_var('dershane.ayar', v_d) then
    raise exception 'panel.yetkisiz';
  end if;
  insert into public.duyuru (dershane_id, sube_id, sinif_id, olusturan_id, baslik, metin)
  values (v_d, p_sube, p_sinif, auth.uid(), p_baslik, p_metin) returning id into v_id;
  return v_id;
end;
$$;

/** Dershane ayarları (Merkezin izin verdiği anahtarlar ve aralıklar). */
create or replace function public.panel_ayar_guncelle(p_ayarlar jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d uuid := app.dershane_id();
  v_temiz jsonb := '{}'::jsonb;
begin
  if v_d is null or not app.yetkisi_var('dershane.ayar', v_d) then raise exception 'panel.yetkisiz'; end if;
  if p_ayarlar ? 'canli_saat' and (p_ayarlar ->> 'canli_saat') ~ '^([01]\d|2[0-3]):[0-5]\d$' then
    v_temiz := v_temiz || jsonb_build_object('canli_saat', p_ayarlar ->> 'canli_saat');
  end if;
  if p_ayarlar ? 'klan_onayi' then v_temiz := v_temiz || jsonb_build_object('klan_onayi', (p_ayarlar ->> 'klan_onayi')::boolean); end if;
  if p_ayarlar ? 'gunluk_hedef' and (p_ayarlar ->> 'gunluk_hedef')::int between 5 and 50 then
    v_temiz := v_temiz || jsonb_build_object('gunluk_hedef', (p_ayarlar ->> 'gunluk_hedef')::int);
  end if;
  if p_ayarlar ? 'sessiz_baslangic' and (p_ayarlar ->> 'sessiz_baslangic') ~ '^([01]\d|2[0-3]):[0-5]\d$' then
    v_temiz := v_temiz || jsonb_build_object('sessiz_baslangic', p_ayarlar ->> 'sessiz_baslangic');
  end if;
  if p_ayarlar ? 'sessiz_bitis' and (p_ayarlar ->> 'sessiz_bitis') ~ '^([01]\d|2[0-3]):[0-5]\d$' then
    v_temiz := v_temiz || jsonb_build_object('sessiz_bitis', p_ayarlar ->> 'sessiz_bitis');
  end if;
  if p_ayarlar ? 'karsilama' then v_temiz := v_temiz || jsonb_build_object('karsilama', left(p_ayarlar ->> 'karsilama', 200)); end if;
  update public.dershane set ayarlar = coalesce(ayarlar, '{}'::jsonb) || v_temiz where id = v_d;
  -- Sohbet ve dershaneler arası lig: dershaneye özel özellik bayrağı
  if p_ayarlar ? 'klan_sohbeti_serbest' then
    insert into public.ozellik_bayragi (kod, dershane_id, acik, yuzde) values ('klan_sohbeti_serbest', v_d, (p_ayarlar ->> 'klan_sohbeti_serbest')::boolean, 100)
    on conflict (kod, dershane_id) do update set acik = excluded.acik;
  end if;
  if p_ayarlar ? 'dershaneler_arasi_lig' then
    insert into public.ozellik_bayragi (kod, dershane_id, acik, yuzde) values ('dershaneler_arasi_lig', v_d, (p_ayarlar ->> 'dershaneler_arasi_lig')::boolean, 100)
    on conflict (kod, dershane_id) do update set acik = excluded.acik;
  end if;
  insert into public.denetim_log (dershane_id, kullanici_id, islem, hedef, ayrinti) values (v_d, auth.uid(), 'dershane.ayar', v_d::text, p_ayarlar);
  return (select ayarlar from public.dershane where id = v_d);
end;
$$;

-- ── Öğrenci tarafı: ödevlerim ve duyurular ──

create or replace function public.odevlerim()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', o.id, 'baslik', o.baslik, 'son_tarih', o.son_tarih, 'soru_sayisi', o.soru_sayisi, 'cozulen', a.cozulen, 'dogru', a.dogru,
      'bitti', a.bitis is not null, 'gecikti', a.bitis is null and o.son_tarih < now(),
      'kazanimlar', (select jsonb_agg(kod) from public.kazanim where id = any (o.kazanim_ids))
    ) order by (a.bitis is null) desc, o.son_tarih), '[]'::jsonb)
  from public.odev_atama a join public.odev o on o.id = a.odev_id
  where a.kullanici_id = auth.uid() and (a.bitis is null or a.bitis > now() - interval '7 days') and o.son_tarih > now() - interval '7 days'
$$;

create or replace function public.duyurularim()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'baslik', d.baslik, 'metin', d.metin, 'olusturma', d.olusturma) order by d.olusturma desc), '[]'::jsonb)
  from (
    select d.* from public.duyuru d join public.kullanici k on k.id = auth.uid()
    where d.dershane_id = k.dershane_id and d.olusturma > now() - interval '14 days'
      and (d.sube_id is null or d.sube_id = k.sube_id)
      and (d.sinif_id is null or exists (select 1 from public.sinif_uyelik u where u.sinif_id = d.sinif_id and u.kullanici_id = k.id))
    order by d.olusturma desc limit 10
  ) d
$$;

/** Ödev sorusu seçimi için: öğrencinin bu ödevdeki sıradaki kazanımı (en az çözülen) ve zorluk modu. */
create or replace function public.sistem_odev_sonraki(p_kullanici uuid, p_odev uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'kazanim_id', (
      select kz from unnest(o.kazanim_ids) kz
      order by (select count(*) from public.cevap c where c.kullanici_id = p_kullanici and c.kazanim_id = kz and c.baglam = 'odev' and c.olusturma >= o.olusturma), random()
      limit 1),
    'zorluk_modu', o.zorluk_modu, 'sabit_zorluk', o.sabit_zorluk, 'kalan', o.soru_sayisi - a.cozulen, 'son_tarih', o.son_tarih, 'baslik', o.baslik)
  from public.odev o join public.odev_atama a on a.odev_id = o.id and a.kullanici_id = p_kullanici
  where o.id = p_odev
$$;

create or replace function public.sistem_odev_isle(p_kullanici uuid, p_odev uuid, p_dogru boolean)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  update public.odev_atama a set cozulen = a.cozulen + 1, dogru = a.dogru + p_dogru::int,
    bitis = case when a.bitis is null and a.cozulen + 1 >= (select soru_sayisi from public.odev where id = p_odev) then now() else a.bitis end
  where a.odev_id = p_odev and a.kullanici_id = p_kullanici
  returning jsonb_build_object('cozulen', a.cozulen, 'bitti', a.bitis is not null)
$$;

-- ── Veli görünümü ──

create or replace function public.veli_ozet()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', k.id, 'ad', k.ad, 'takma_ad', k.takma_ad::text,
      'hafta_dk', (select round(sum(least(c.sure_ms, 300000)) / 60000.0) from public.cevap c where c.kullanici_id = k.id and c.olusturma > now() - interval '7 days'),
      'hafta_soru', (select count(*) from public.cevap c where c.kullanici_id = k.id and c.olusturma > now() - interval '7 days'),
      'dogruluk', (select round(avg(c.dogru_mu::int) * 100) from public.cevap c where c.kullanici_id = k.id and c.olusturma > now() - interval '7 days'),
      'gunler', (select coalesce(jsonb_agg(jsonb_build_object('gun', g.gun::date, 'soru', coalesce(x.n, 0)) order by g.gun), '[]'::jsonb)
                 from generate_series(app.bugun() - 6, app.bugun(), interval '1 day') g(gun)
                 left join (select (c.olusturma at time zone 'Europe/Istanbul')::date as gun, count(*) as n from public.cevap c
                            where c.kullanici_id = k.id and c.olusturma > now() - interval '8 days' group by 1) x on x.gun = g.gun::date),
      'guclu', (select coalesce(jsonb_agg(kz.aciklama), '[]'::jsonb) from (select kazanim_id from public.beceri where kullanici_id = k.id and cozulen >= 5 order by theta desc limit 3) b join public.kazanim kz on kz.id = b.kazanim_id),
      'gelisecek', (select coalesce(jsonb_agg(kz.aciklama), '[]'::jsonb) from (select kazanim_id from public.beceri where kullanici_id = k.id and cozulen >= 3 order by theta limit 3) b join public.kazanim kz on kz.id = b.kazanim_id),
      'odevler', (select coalesce(jsonb_agg(jsonb_build_object('baslik', o.baslik, 'cozulen', a.cozulen, 'soru_sayisi', o.soru_sayisi, 'son_tarih', o.son_tarih, 'bitti', a.bitis is not null)), '[]'::jsonb)
                  from public.odev_atama a join public.odev o on o.id = a.odev_id where a.kullanici_id = k.id and o.son_tarih > now() - interval '7 days'),
      'rozetler', (select coalesce(jsonb_agg(r.rozet_kod order by r.olusturma desc), '[]'::jsonb) from (select * from public.kullanici_rozet where kullanici_id = k.id order by olusturma desc limit 6) r),
      'seviye', (select seviye from public.ogrenci_ilerleme where kullanici_id = k.id),
      'seri', (select seri_gun from public.ogrenci_ilerleme where kullanici_id = k.id)
    )), '[]'::jsonb)
  from public.veli_bag v join public.kullanici k on k.id = v.ogrenci_id
  where v.veli_id = auth.uid() and v.onay_tarihi is not null
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.panel_siniflarim()', 'public.panel_sinif_analiz(uuid)', 'public.panel_ogrenci_detay(uuid)',
    'public.panel_odev_olustur(text, uuid[], uuid[], uuid[], integer, text, integer, timestamptz)',
    'public.panel_zayif_konulara_odev(uuid, uuid)', 'public.panel_odevler()', 'public.panel_bekleyenler()',
    'public.panel_karar(text, text, text)', 'public.panel_topluluk_onay(uuid, boolean)', 'public.panel_dershane_ozet()',
    'public.panel_ogrenciler()', 'public.panel_ogretmenler()', 'public.panel_rehberlik()',
    'public.panel_rehberlik_not(uuid, text, text, timestamptz)', 'public.panel_rehberlik_guncelle(text, uuid, text)',
    'public.panel_duyuru(text, text, uuid, uuid)', 'public.panel_ayar_guncelle(jsonb)',
    'public.odevlerim()', 'public.duyurularim()', 'public.veli_ozet()'
  ] loop
    execute format('revoke execute on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  foreach f in array array['public.sistem_odev_sonraki(uuid, uuid)', 'public.sistem_odev_isle(uuid, uuid, boolean)'] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
