-- ─────────────────────────────────────────────────────────────
-- 0027 · Kurucu araçları
--  • Deneme sınavı sonuçları (optik okuyucu Excel/CSV içe aktarma), net
--    eğilimleri, en zayıf ders → o derste zayıf konulara ödev, etki raporu.
--  • Öğrenci numarası (içe aktarma eşleştirmesi için).
--  • Yıl sonu sınıf atlatma / mezun arşivi; seçili öğrencilere duyuru.
--  • Dershane etkinlikleri ve ödül yönetimi (turnuva şampiyonları otomatik).
--  • Öğretmen takibi: yüklenen soru/çözüm/anlatım, moderasyon yanıt süresi.
-- ─────────────────────────────────────────────────────────────

alter table public.kullanici add column ogrenci_no text check (ogrenci_no is null or char_length(ogrenci_no) between 1 and 20);
create unique index kullanici_ogrenci_no on public.kullanici (dershane_id, ogrenci_no) where ogrenci_no is not null;

create table public.deneme (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  ad text not null check (char_length(ad) between 2 and 120),
  tarih date not null,
  sinav_turu text not null check (sinav_turu in ('LGS', 'TYT', 'AYT', 'YDT')),
  olusturan_id uuid references public.kullanici (id) on delete set null,
  olusturma timestamptz not null default now()
);
create table public.deneme_sonuc (
  deneme_id uuid not null references public.deneme (id) on delete cascade,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  ders text not null check (char_length(ders) between 1 and 60),
  dogru numeric(5, 2), yanlis numeric(5, 2),
  net numeric(6, 2) not null,
  primary key (deneme_id, kullanici_id, ders)
);
create index deneme_sonuc_ogrenci on public.deneme_sonuc (kullanici_id);
alter table public.deneme enable row level security;
alter table public.deneme_sonuc enable row level security;
grant select on public.deneme, public.deneme_sonuc to authenticated;
create policy deneme_oku on public.deneme for select to authenticated using (dershane_id = app.dershane_id());
create policy deneme_sonuc_oku on public.deneme_sonuc for select to authenticated
  using (kullanici_id = auth.uid() or app.ogrenci_akademik_okuyabilir(kullanici_id)
         or exists (select 1 from public.veli_bag v where v.veli_id = auth.uid() and v.ogrenci_id = deneme_sonuc.kullanici_id and v.onay_tarihi is not null));

/** Deneme raporu: öğrenci toplam netleri, sınıf/ders ortalamaları, sınıfın en zayıf dersi. */
create or replace function public.panel_deneme_rapor(p_deneme uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_d uuid := app.dershane_id();
begin
  if not exists (select 1 from public.deneme where id = p_deneme and dershane_id = v_d) or not app.yetkisi_var('rapor.oku', v_d) and not exists (
       select 1 from public.sinif_uyelik u where u.kullanici_id = auth.uid() and u.rol = 'ogretmen') then
    raise exception 'panel.yetkisiz';
  end if;
  return jsonb_build_object(
    'ogrenciler', (select coalesce(jsonb_agg(x order by (x ->> 'net')::numeric desc), '[]') from (
      select jsonb_build_object('id', k.id, 'ad', k.ad || ' ' || k.soyad, 'sinif', (select s.ad from public.sinif_uyelik u join public.sinif s on s.id = u.sinif_id where u.kullanici_id = k.id and u.rol = 'ogrenci' limit 1),
                                'net', sum(r.net), 'dersler', jsonb_object_agg(r.ders, r.net)) x
      from public.deneme_sonuc r join public.kullanici k on k.id = r.kullanici_id
      where r.deneme_id = p_deneme and app.ogrenci_akademik_okuyabilir(k.id)
      group by k.id) y),
    'siniflar', (select coalesce(jsonb_agg(z), '[]') from (
      select jsonb_build_object('sinif_id', s.id, 'sinif', s.ad, 'dersler', jsonb_object_agg(d.ders, d.ort), 'en_zayif', (array_agg(d.ders order by d.oran))[1]) z
      from (select u.sinif_id, r.ders, round(avg(r.net), 2) ort, avg(r.net) / nullif(max(r.dogru + r.yanlis + 0.0001), 0) oran
            from public.deneme_sonuc r join public.sinif_uyelik u on u.kullanici_id = r.kullanici_id and u.rol = 'ogrenci'
            where r.deneme_id = p_deneme group by u.sinif_id, r.ders) d
      join public.sinif s on s.id = d.sinif_id
      where app.sinif_okuyabilir(s.id)
      group by s.id, s.ad) w)
  );
end $$;
grant execute on function public.panel_deneme_rapor(uuid) to authenticated;

/** Net eğilimi: öğrenci / sınıf / şube bazında deneme başına ortalama toplam net. */
create or replace function public.panel_net_egilimi(p_sinav text default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'ad', d.ad, 'tarih', d.tarih, 'sinav', d.sinav_turu,
    'ortalama', (select round(avg(t.net), 2) from (select sum(net) net from public.deneme_sonuc r where r.deneme_id = d.id group by r.kullanici_id) t),
    'subeler', (select jsonb_object_agg(coalesce(sb.ad, '—'), x.ort) from (
                  select k.sube_id, round(avg(t.net), 2) ort from (select kullanici_id, sum(net) net from public.deneme_sonuc r where r.deneme_id = d.id group by kullanici_id) t
                  join public.kullanici k on k.id = t.kullanici_id group by k.sube_id) x left join public.sube sb on sb.id = x.sube_id),
    'katilim', (select count(distinct kullanici_id) from public.deneme_sonuc where deneme_id = d.id)
  ) order by d.tarih), '[]')
  from public.deneme d
  where d.dershane_id = app.dershane_id() and app.yetkisi_var('rapor.oku', d.dershane_id) and (p_sinav is null or d.sinav_turu = p_sinav)
$$;
grant execute on function public.panel_net_egilimi(text) to authenticated;

/**
 * Etki raporu: ilk ve son denemesi arasında net değişimi, platform kullanım
 * yoğunluğuna göre (o aralıkta çözülen soru: üçte birlik dilimler) gruplanır.
 */
create or replace function public.panel_etki_raporu(p_sinav text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_d uuid := app.dershane_id();
begin
  if not app.yetkisi_var('rapor.oku', v_d) then raise exception 'panel.yetkisiz'; end if;
  return (
    with toplam as (
      select r.kullanici_id, d.tarih, sum(r.net) net
      from public.deneme_sonuc r join public.deneme d on d.id = r.deneme_id
      where d.dershane_id = v_d and d.sinav_turu = p_sinav group by r.kullanici_id, d.id, d.tarih
    ), uc as (
      select kullanici_id, min(tarih) ilk, max(tarih) son,
             (array_agg(net order by tarih))[1] ilk_net, (array_agg(net order by tarih desc))[1] son_net
      from toplam group by kullanici_id having count(*) >= 2
    ), kul as (
      select u.*, (select count(*) from public.cevap c where c.kullanici_id = u.kullanici_id and c.olusturma::date between u.ilk and u.son) soru,
             greatest(1, u.son - u.ilk) gun
      from uc u
    ), dilim as (
      select *, ntile(3) over (order by soru::numeric / gun) d from kul
    )
    select jsonb_build_object(
      'ogrenci', (select count(*) from dilim),
      'gruplar', coalesce((select jsonb_agg(g order by dd desc) from (select d as dd, jsonb_build_object(
          'grup', case d when 3 then 'yuksek' when 2 then 'orta' else 'dusuk' end,
          'ogrenci', count(*), 'gunluk_soru', round(avg(soru::numeric / gun), 1),
          'ilk_net', round(avg(ilk_net), 2), 'son_net', round(avg(son_net), 2), 'degisim', round(avg(son_net - ilk_net), 2)) as g
        from dilim group by d) t), '[]'))
  );
end $$;
grant execute on function public.panel_etki_raporu(text) to authenticated;

/** Denemede sınıfın zayıf dersi → o dersin en çok yanlış yapılan 3 kazanımına uyarlamalı ödev. */
create or replace function public.panel_ders_zayif_odev(p_sinif uuid, p_ders_ad text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_kz uuid[]; v_sinav text; v_ders uuid;
begin
  if not app.sinif_okuyabilir(p_sinif) then raise exception 'panel.yetkisiz'; end if;
  select sinav_turu into v_sinav from public.sinif where id = p_sinif;
  select d.id into v_ders from public.ders d
  where (d.sinav_turu = 'LGS') = (v_sinav = 'LGS') and (lower(d.ad) like lower(left(p_ders_ad, 4)) || '%' or lower(p_ders_ad) like lower(left(d.ad, 4)) || '%')
  order by (d.sinav_turu = v_sinav) desc limit 1;
  if v_ders is null then raise exception 'panel.dersBulunamadi'; end if;
  select array_agg(kazanim_id) into v_kz from (
    select c.kazanim_id from public.cevap c
    join public.sinif_uyelik u on u.kullanici_id = c.kullanici_id and u.sinif_id = p_sinif and u.rol = 'ogrenci'
    join public.kazanim k on k.id = c.kazanim_id join public.unite un on un.id = k.unite_id and un.ders_id = v_ders
    where c.olusturma > now() - interval '60 days' and c.baglam <> 'duello'
    group by c.kazanim_id having count(*) >= 3 order by avg((not c.dogru_mu)::int) desc limit 3) x;
  if v_kz is null then
    select array_agg(id) into v_kz from (select k.id from public.kazanim k join public.unite un on un.id = k.unite_id where un.ders_id = v_ders order by random() limit 3) y;
  end if;
  return public.panel_odev_olustur(p_ders_ad || ' — denemeden telafi', v_kz, array[p_sinif], '{}'::uuid[], 12, 'uyarlamali', null, now() + interval '4 days');
end $$;
grant execute on function public.panel_ders_zayif_odev(uuid, text) to authenticated;

-- ── Seçili öğrencilere duyuru ──
alter table public.duyuru add column ogrenci_ids uuid[];
create or replace function public.panel_duyuru_ogrencilere(p_baslik text, p_metin text, p_ogrenciler uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_d uuid := app.dershane_id(); v_id uuid; o uuid;
begin
  if not app.yetkisi_var('rapor.oku', v_d) and not app.yetkisi_var('odev.yonet', v_d, app.sube_id()) then raise exception 'panel.yetkisiz'; end if;
  if coalesce(cardinality(p_ogrenciler), 0) = 0 then raise exception 'panel.ogrenciYok'; end if;
  if exists (select 1 from unnest(p_ogrenciler) x where not app.ogrenci_akademik_okuyabilir(x)) then raise exception 'panel.yetkisiz'; end if;
  insert into public.duyuru (dershane_id, olusturan_id, baslik, metin, ogrenci_ids) values (v_d, auth.uid(), left(p_baslik, 120), left(p_metin, 1000), p_ogrenciler) returning id into v_id;
  foreach o in array p_ogrenciler loop perform app.bildirim_ekle(o, 'duyuru', left(p_baslik, 80), left(p_metin, 200), '{"yol":"/"}'); end loop;
  return v_id;
end $$;
grant execute on function public.panel_duyuru_ogrencilere(text, text, uuid[]) to authenticated;

-- Öğrenci duyuruları: hedefli duyurular da (redefine)
create or replace function public.duyurularim() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', d.id, 'baslik', d.baslik, 'metin', d.metin, 'olusturma', d.olusturma,
                                               'yazan', coalesce(k.ad || ' ' || left(k.soyad, 1) || '.', '')) order by d.olusturma desc), '[]')
  from (select * from public.duyuru d
        where d.dershane_id = app.dershane_id() and d.olusturma > now() - interval '14 days'
          and (d.ogrenci_ids is null or auth.uid() = any (d.ogrenci_ids))
          and (d.sube_id is null or d.sube_id = app.sube_id())
          and (d.sinif_id is null or exists (select 1 from public.sinif_uyelik u where u.sinif_id = d.sinif_id and u.kullanici_id = auth.uid()))
        order by d.olusturma desc limit 10) d
  left join public.kullanici k on k.id = d.olusturan_id
$$;

-- ── Yıl sonu: sınıf atlatma ve mezun arşivi ──
/** p_islemler: [{sinif, islem: 'seviye'|'tasi'|'mezun', hedef?}] */
create or replace function public.panel_yil_sonu(p_islemler jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_d uuid := app.dershane_id(); x jsonb; s public.sinif; v_hedef uuid; n_seviye int := 0; n_tasi int := 0; n_mezun int := 0;
begin
  if not app.yetkisi_var('sinif.yonet', v_d) or not app.yetkisi_var('ogrenci.ekle', v_d) then raise exception 'panel.yetkisiz'; end if;
  for x in select * from jsonb_array_elements(p_islemler) loop
    select * into s from public.sinif where id = (x ->> 'sinif')::uuid and dershane_id = v_d;
    if not found then continue; end if;
    case x ->> 'islem'
      when 'seviye' then
        update public.sinif set seviye = least(13, seviye + 1) where id = s.id;
        n_seviye := n_seviye + 1;
      when 'tasi' then
        v_hedef := (x ->> 'hedef')::uuid;
        if not exists (select 1 from public.sinif where id = v_hedef and dershane_id = v_d) then raise exception 'panel.bulunamadi'; end if;
        insert into public.sinif_uyelik (dershane_id, sinif_id, kullanici_id, rol)
        select v_d, v_hedef, u.kullanici_id, 'ogrenci' from public.sinif_uyelik u where u.sinif_id = s.id and u.rol = 'ogrenci'
        on conflict (sinif_id, kullanici_id) do nothing;
        delete from public.sinif_uyelik where sinif_id = s.id and rol = 'ogrenci';
        n_tasi := n_tasi + 1;
      when 'mezun' then
        update public.sinif set arsiv = true, seviye = 13 where id = s.id;
        n_mezun := n_mezun + 1;
      else null;
    end case;
  end loop;
  perform app.denetle('yil_sonu', null, jsonb_build_object('seviye', n_seviye, 'tasi', n_tasi, 'mezun', n_mezun));
  return jsonb_build_object('seviye', n_seviye, 'tasi', n_tasi, 'mezun', n_mezun);
end $$;
grant execute on function public.panel_yil_sonu(jsonb) to authenticated;

-- ── Etkinlikler ve ödüller ──
create table public.etkinlik (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  ad text not null check (char_length(ad) between 2 and 120),
  aciklama text check (aciklama is null or char_length(aciklama) <= 1000),
  tur text not null default 'diger' check (tur in ('turnuva', 'canli', 'deneme', 'diger')),
  baslangic timestamptz not null,
  bitis timestamptz,
  sinif_ids uuid[],
  ders_id uuid references public.ders (id),
  odul text,
  olusturan_id uuid references public.kullanici (id) on delete set null,
  olusturma timestamptz not null default now()
);
create table public.odul (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  kaynak text not null check (kaynak in ('turnuva', 'sezon', 'etkinlik', 'diger')),
  kaynak_id uuid,
  baslik text not null check (char_length(baslik) between 2 and 120),
  kazanan_id uuid references public.kullanici (id) on delete set null,
  odul text not null check (char_length(odul) between 1 and 200),
  teslim timestamptz,
  olusturma timestamptz not null default now(),
  unique nulls not distinct (kaynak, kaynak_id, kazanan_id)
);
alter table public.etkinlik enable row level security;
alter table public.odul enable row level security;
grant select, insert, update, delete on public.etkinlik, public.odul to authenticated;
create policy etkinlik_oku on public.etkinlik for select to authenticated using (dershane_id = app.dershane_id());
create policy etkinlik_yaz on public.etkinlik for all to authenticated
  using (app.yetkisi_var('odul.yonet', dershane_id)) with check (dershane_id = app.dershane_id() and app.yetkisi_var('odul.yonet', dershane_id));
create policy odul_oku on public.odul for select to authenticated using (dershane_id = app.dershane_id() and (kazanan_id = auth.uid() or app.yetkisi_var('odul.yonet', dershane_id) or app.yetkisi_var('rapor.oku', dershane_id)));
create policy odul_yaz on public.odul for all to authenticated
  using (app.yetkisi_var('odul.yonet', dershane_id)) with check (dershane_id = app.dershane_id() and app.yetkisi_var('odul.yonet', dershane_id));

/** Öğrenci: yaklaşan / süren etkinlikler. */
create or replace function public.etkinliklerim() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', e.id, 'ad', e.ad, 'aciklama', e.aciklama, 'tur', e.tur, 'baslangic', e.baslangic, 'bitis', e.bitis, 'odul', e.odul)
                            order by e.baslangic), '[]')
  from public.etkinlik e
  where e.dershane_id = app.dershane_id() and coalesce(e.bitis, e.baslangic + interval '1 day') > now() and e.baslangic < now() + interval '30 days'
    and (e.sinif_ids is null or exists (select 1 from public.sinif_uyelik u where u.kullanici_id = auth.uid() and u.sinif_id = any (e.sinif_ids)))
$$;
grant execute on function public.etkinliklerim() to authenticated;

-- Turnuva şampiyonu ödül listesine otomatik düşer (ödül tanımlıysa)
create or replace function app.tg_turnuva_odul() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.durum = 'bitti' and old.durum <> 'bitti' and new.kazanan_id is not null and new.odul is not null then
    insert into public.odul (dershane_id, kaynak, kaynak_id, baslik, kazanan_id, odul)
    values (new.dershane_id, 'turnuva', new.id, new.ad, new.kazanan_id, new.odul) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger turnuva_odul after update of durum on public.turnuva for each row execute function app.tg_turnuva_odul();

/** Sezon/hafta önerisi: her sınıfın bu ayki en çok XP kazanan öğrencisi. */
create or replace function public.panel_odul_onerileri()
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('sinif', s.ad, 'kullanici_id', x.kullanici_id, 'ad', k.ad || ' ' || k.soyad, 'xp', x.xp) order by s.ad), '[]')
  from public.sinif s
  join lateral (
    select lu.kullanici_id, sum(lu.xp) xp from public.lig_uyelik lu
    join public.sinif_uyelik u on u.kullanici_id = lu.kullanici_id and u.sinif_id = s.id and u.rol = 'ogrenci'
    where lu.hafta >= date_trunc('month', now())::date group by lu.kullanici_id order by 2 desc limit 1
  ) x on true
  join public.kullanici k on k.id = x.kullanici_id
  where s.dershane_id = app.dershane_id() and not s.arsiv and app.yetkisi_var('odul.yonet', s.dershane_id)
$$;
grant execute on function public.panel_odul_onerileri() to authenticated;

-- ── Öğretmen takibi (zenginleştirilmiş) ──
create or replace function public.panel_ogretmenler()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_d uuid := app.dershane_id();
begin
  if v_d is null or not app.yetkisi_var('ogretmen.takip', v_d) then raise exception 'panel.yetkisiz'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', k.id, 'ad', k.ad || ' ' || k.soyad, 'son_giris', k.son_giris,
      'siniflar', (select coalesce(jsonb_agg(s.ad order by s.ad), '[]'::jsonb) from public.sinif_uyelik u join public.sinif s on s.id = u.sinif_id where u.kullanici_id = k.id and u.rol = 'ogretmen'),
      'odev30', (select count(*) from public.odev o where o.olusturan_id = k.id and o.olusturma > now() - interval '30 days'),
      'soru30', (select count(*) from public.soru q where q.ogretmen_id = k.id and q.olusturma > now() - interval '30 days' and q.durum = 'dogrulandi'),
      'cozum', (select count(*) from public.soru q where q.ogretmen_id = k.id and q.ogretmen_cozum is not null),
      'anlatim', (select count(*) from public.konu_anlatimi a where a.ogretmen_id = k.id),
      'turnuva30', (select count(*) from public.turnuva t where t.olusturan_id = k.id and t.olusturma > now() - interval '30 days')
                 + (select count(*) from public.canli_oturum c where c.olusturan_id = k.id and c.olusturma > now() - interval '30 days'),
      'onay30', (select count(*) from public.topluluk_cevap c join public.topluluk_soru q on q.id = c.soru_id
                 where q.dershane_id = v_d and c.kabul = 'ogretmen' and c.kabul_zamani > now() - interval '30 days'
                   and exists (select 1 from public.sinif_uyelik u where u.kullanici_id = k.id and u.rol = 'ogretmen' and u.sinif_id = q.sinif_id)),
      'yanit_dk', (select round(avg(extract(epoch from (c.kabul_zamani - q.olusturma)) / 60)) from public.topluluk_cevap c join public.topluluk_soru q on q.id = c.soru_id
                   where q.dershane_id = v_d and c.kabul = 'ogretmen' and c.kabul_zamani > now() - interval '30 days'
                     and exists (select 1 from public.sinif_uyelik u where u.kullanici_id = k.id and u.rol = 'ogretmen' and u.sinif_id = q.sinif_id)),
      'sinif_aktiflik', (select round(avg(case when exists (select 1 from public.cevap c where c.kullanici_id = u2.kullanici_id and c.olusturma > now() - interval '7 days') then 100 else 0 end))
                         from public.sinif_uyelik u join public.sinif_uyelik u2 on u2.sinif_id = u.sinif_id and u2.rol = 'ogrenci'
                         where u.kullanici_id = k.id and u.rol = 'ogretmen'),
      'sinif_gelisim', (select round(avg(b.theta) filter (where b.guncelleme > now() - interval '7 days') - avg(b.theta) filter (where b.guncelleme <= now() - interval '7 days'), 2)
                        from public.sinif_uyelik u join public.sinif_uyelik u2 on u2.sinif_id = u.sinif_id and u2.rol = 'ogrenci'
                        join public.beceri b on b.kullanici_id = u2.kullanici_id
                        where u.kullanici_id = k.id and u.rol = 'ogretmen')
    ) order by k.ad)
    from public.kullanici k
    where k.dershane_id = v_d and k.silinme_talebi is null and exists (select 1 from public.kullanici_rol r where r.kullanici_id = k.id and r.rol_kod = 'ogretmen')), '[]'::jsonb);
end $$;
