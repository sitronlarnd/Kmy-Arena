-- ─────────────────────────────────────────────────────────────
-- 0024 · Dershane açma ve kayıt yönetimi
--  • Panelden hesap oluşturma (merkez: kurucu; dershane: personel ve toplu
--    öğrenci). Auth hesabı panel sunucusunda service role ile açılır, profil
--    sistem_hesap_kur ile kurulur. Panel, yetkiyi önce panel_yetki ile sorar.
--  • Geçici şifreyle açılan hesapta ilk girişte şifre değiştirme zorunlu.
--  • Davet kodları: aktif/pasif, rol bazlı yetki denetimi, öğrenciye bağlı veli
--    kodu (veli bu kodla katılınca bağ kurulur ve veli onayı verilmiş olur).
--  • Öğretmen-ders ataması (sinif_uyelik.ders_ids; boş = tüm dersler).
-- ─────────────────────────────────────────────────────────────

alter table public.kullanici add column sifre_degismeli boolean not null default false;
alter table public.davet_kodu
  add column ogrenci_id uuid references public.kullanici (id) on delete cascade,
  add column aktif boolean not null default true;
alter table public.sinif_uyelik add column ders_ids uuid[];
alter table public.sinif add column arsiv boolean not null default false;

-- Panel: oturumdaki kullanıcının kendi dershanesinde (ve isteğe bağlı şubede) yetkisi var mı?
-- p_sube boşsa: tüm dershanede ("tum") ya da yalnızca bazı şubelerde ("subeler") yetkili olabilir.
create or replace function public.panel_yetki(p_yetki text, p_sube uuid default null)
returns jsonb language sql stable security definer set search_path = '' as $$
  with d as (select app.dershane_id() as id),
  s as (select array_agg(sb.id) as l from public.sube sb, d where sb.dershane_id = d.id and app.yetkisi_var(p_yetki, d.id, sb.id))
  select jsonb_build_object(
    'var', case when p_sube is not null then app.yetkisi_var(p_yetki, d.id, p_sube) else app.yetkisi_var(p_yetki, d.id) or coalesce(cardinality(s.l), 0) > 0 end,
    'tum', app.yetkisi_var(p_yetki, d.id),
    'subeler', coalesce(to_jsonb(s.l), '[]'),
    'dershane_id', d.id,
    'kullanici_id', auth.uid())
  from d, s
$$;
grant execute on function public.panel_yetki(text, uuid) to authenticated;

/** Profil kurulumu (service). Lisans, öğrenci limiti, takma ad kuralları uygulanır. */
create or replace function public.sistem_hesap_kur(
  p_uid uuid, p_dershane uuid, p_sube uuid, p_sinif uuid, p_rol text,
  p_ad text, p_soyad text, p_takma_ad text, p_dogum_yili integer, p_sifre_degismeli boolean default true
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_kapsam text; v_tur public.kullanici_turu; v_lisans public.lisans_durumu; v_limit integer; v_yas integer;
begin
  select r.kapsam into v_kapsam from public.rol r where r.kod = p_rol;
  if v_kapsam is null or v_kapsam = 'merkez' then raise exception 'panel.rolGecersiz'; end if;
  select d.lisans_durumu, d.ogrenci_limiti into v_lisans, v_limit from public.dershane d where d.id = p_dershane;
  if v_lisans is null then raise exception 'panel.bulunamadi'; end if;
  if v_lisans in ('askida', 'bitti') then raise exception 'giris.lisansPasif'; end if;
  if p_sube is not null and not exists (select 1 from public.sube where id = p_sube and dershane_id = p_dershane) then raise exception 'panel.bulunamadi'; end if;
  if p_sinif is not null and not exists (select 1 from public.sinif where id = p_sinif and dershane_id = p_dershane) then raise exception 'panel.bulunamadi'; end if;
  v_tur := case p_rol when 'ogrenci' then 'ogrenci' when 'veli' then 'veli' else 'personel' end;
  if v_tur = 'ogrenci' and (select count(*) from public.kullanici k where k.dershane_id = p_dershane and k.tur = 'ogrenci' and k.silinme_talebi is null) >= v_limit then
    raise exception 'giris.lisansDolu';
  end if;
  if p_takma_ad is not null and p_takma_ad !~ '^[[:alnum:]_.]{3,20}$' then raise exception 'giris.takmaAdGecersiz'; end if;
  if p_takma_ad is not null and exists (select 1 from public.kullanici k where k.dershane_id = p_dershane and k.takma_ad = p_takma_ad::extensions.citext) then
    raise exception 'giris.takmaAdAlinmis';
  end if;
  v_yas := extract(year from now())::integer - p_dogum_yili;
  insert into public.kullanici (id, dershane_id, sube_id, tur, ad, soyad, takma_ad, dogum_yili, veli_onayi, veli_onay_tarihi, kvkk_onay_tarihi, sifre_degismeli)
  values (p_uid, p_dershane, p_sube, v_tur, trim(p_ad), trim(p_soyad), nullif(trim(p_takma_ad), ''), p_dogum_yili,
          (v_tur <> 'ogrenci' or v_yas >= 18), case when v_tur <> 'ogrenci' or v_yas >= 18 then now() end, null, p_sifre_degismeli);
  insert into public.kullanici_rol (kullanici_id, rol_kod, dershane_id, sube_id)
  values (p_uid, p_rol, p_dershane, case when v_kapsam = 'sube' then p_sube end);
  if p_sinif is not null and p_rol in ('ogrenci', 'ogretmen') then
    insert into public.sinif_uyelik (dershane_id, sinif_id, kullanici_id, rol) values (p_dershane, p_sinif, p_uid, p_rol);
  end if;
  return jsonb_build_object('id', p_uid, 'tur', v_tur);
end $$;
revoke all on function public.sistem_hesap_kur(uuid, uuid, uuid, uuid, text, text, text, text, integer, boolean) from public, anon, authenticated;
grant execute on function public.sistem_hesap_kur(uuid, uuid, uuid, uuid, text, text, text, text, integer, boolean) to service_role;

-- İlk girişte şifre değiştirildi
create or replace function public.sifre_degisti() returns void
language sql security definer set search_path = '' as $$
  update public.kullanici set sifre_degismeli = false where id = auth.uid()
$$;
grant execute on function public.sifre_degisti() to authenticated;

-- KVKK onayı ilk girişte (panelden açılan hesaplarda kayıt anında alınmadı)
create or replace function public.kvkk_onayla() returns void
language sql security definer set search_path = '' as $$
  update public.kullanici set kvkk_onay_tarihi = coalesce(kvkk_onay_tarihi, now()) where id = auth.uid()
$$;
grant execute on function public.kvkk_onayla() to authenticated;

/** Rol bazlı davet kodu üretimi: öğrenci → ogrenci.ekle, veli → veli.davet, öğretmen → ogretmen.yonet, diğer personel → dershane.rol_ata. */
create or replace function public.panel_davet_olustur(
  p_rol text, p_sube uuid default null, p_sinif uuid default null, p_max integer default 1, p_gun integer default 30, p_ogrenci uuid default null
) returns text language plpgsql security definer set search_path = '' as $$
declare
  v_d uuid := app.dershane_id(); v_kod text; v_kapsam text; v_yetki text; v_sube uuid := p_sube;
begin
  select kapsam into v_kapsam from public.rol where kod = p_rol;
  if v_d is null or v_kapsam is null or v_kapsam = 'merkez' then raise exception 'panel.rolGecersiz'; end if;
  if p_sinif is not null then
    select sube_id into v_sube from public.sinif where id = p_sinif and dershane_id = v_d;
    if v_sube is null then raise exception 'panel.bulunamadi'; end if;
  end if;
  if p_ogrenci is not null then
    select sube_id into v_sube from public.kullanici where id = p_ogrenci and dershane_id = v_d and tur = 'ogrenci';
    if not found then raise exception 'panel.bulunamadi'; end if;
  end if;
  v_yetki := case p_rol when 'ogrenci' then 'ogrenci.ekle' when 'veli' then 'veli.davet' when 'ogretmen' then 'ogretmen.yonet' else 'dershane.rol_ata' end;
  if not (app.yetkisi_var(v_yetki, v_d, v_sube) or (p_rol = 'ogretmen' and app.yetkisi_var('dershane.rol_ata', v_d))) then
    raise exception 'panel.yetkisiz';
  end if;
  if p_rol = 'veli' and p_ogrenci is null then raise exception 'panel.ogrenciGerekli'; end if;
  loop
    v_kod := app.davet_kodu_uret();
    exit when not exists (select 1 from public.davet_kodu where kod = v_kod);
  end loop;
  insert into public.davet_kodu (kod, dershane_id, sube_id, sinif_id, rol_kod, max_kullanim, son_gecerlilik, olusturan, ogrenci_id)
  values (v_kod, v_d, v_sube, case when p_rol in ('ogrenci', 'ogretmen') then p_sinif end, p_rol,
          case when p_rol = 'veli' then 2 else greatest(1, least(coalesce(p_max, 1), 1000)) end,
          now() + make_interval(days => greatest(1, least(coalesce(p_gun, 30), 365))), auth.uid(), p_ogrenci);
  perform app.denetle('davet_kodu_olusturuldu', v_kod, jsonb_build_object('rol', p_rol));
  return v_kod;
end $$;
grant execute on function public.panel_davet_olustur(text, uuid, uuid, integer, integer, uuid) to authenticated;

/** Sınıftaki velisi olmayan öğrencilere toplu veli kodu (mevcut aktif kod varsa onu döner). */
create or replace function public.panel_veli_kodlari(p_sinif uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_d uuid := app.dershane_id(); v_sube uuid; r record; v_kod text; v_sonuc jsonb := '[]';
begin
  select sube_id into v_sube from public.sinif where id = p_sinif and dershane_id = v_d;
  if v_sube is null then raise exception 'panel.bulunamadi'; end if;
  if not app.yetkisi_var('veli.davet', v_d, v_sube) then raise exception 'panel.yetkisiz'; end if;
  for r in
    select k.id, k.ad, k.soyad from public.sinif_uyelik u join public.kullanici k on k.id = u.kullanici_id
    where u.sinif_id = p_sinif and u.rol = 'ogrenci' and k.silinme_talebi is null
      and not exists (select 1 from public.veli_bag b where b.ogrenci_id = k.id)
    order by k.ad, k.soyad
  loop
    select kod into v_kod from public.davet_kodu
    where ogrenci_id = r.id and rol_kod = 'veli' and aktif and kullanim < max_kullanim and son_gecerlilik > now() limit 1;
    if v_kod is null then v_kod := public.panel_davet_olustur('veli', null, null, 2, 60, r.id); end if;
    v_sonuc := v_sonuc || jsonb_build_object('ad', r.ad, 'soyad', r.soyad, 'kod', v_kod);
    v_kod := null;
  end loop;
  return v_sonuc;
end $$;
grant execute on function public.panel_veli_kodlari(uuid) to authenticated;

/** Davet kodu kullanımı: aktiflik ve öğrenciye bağlı veli kodu desteği eklendi. */
create or replace function public.davet_kodu_kullan(
  p_kod text, p_ad text, p_soyad text, p_takma_ad text default null, p_dogum_yili integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare d public.davet_kodu;
begin
  select * into d from public.davet_kodu where kod = upper(trim(p_kod)) for update;
  if not found or not d.aktif or d.son_gecerlilik < now() then raise exception 'giris.kodGecersiz'; end if;
  if d.kullanim >= d.max_kullanim then raise exception 'giris.kodKullanildi'; end if;
  perform app.kullanici_olustur(d.dershane_id, d.sube_id, d.sinif_id, d.rol_kod, p_ad, p_soyad, p_takma_ad, p_dogum_yili);
  update public.davet_kodu set kullanim = kullanim + 1 where kod = d.kod;
  if d.rol_kod = 'veli' and d.ogrenci_id is not null then
    insert into public.veli_bag (dershane_id, veli_id, ogrenci_id, onay_tarihi)
    values (d.dershane_id, auth.uid(), d.ogrenci_id, now()) on conflict do nothing;
    update public.kullanici set veli_onayi = true, veli_onay_tarihi = now() where id = d.ogrenci_id;
  end if;
  perform app.denetle('davet_kodu_kullanildi', d.kod, jsonb_build_object('rol', d.rol_kod));
  return jsonb_build_object('dershane_id', d.dershane_id, 'rol', d.rol_kod);
end $$;
