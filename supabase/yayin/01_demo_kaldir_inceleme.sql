-- ─────────────────────────────────────────────────────────────
-- Yayına geçiş (2026-11-14, proje sahibi kararı):
--  1) Demo ve rakip dershane, tüm *.kmyarena.demo hesapları ve verileri silinir
--     (merkez sahip hesabı hariç; onun şifresi yenilenir).
--  2) App Store / Google Play incelemesi için küçük "KMY Arena İnceleme"
--     dershanesi ve hesapları kurulur.
-- Tekrar çalıştırılabilir. Şifreler yalnızca bcrypt özeti olarak burada;
-- düz hâli proje sahibine ayrıca iletildi.
-- ─────────────────────────────────────────────────────────────

-- 1 · Demo verisini kaldır
delete from auth.users
where (email like '%@demo.kmyarena.demo' or email like '%@rakip.kmyarena.demo');

delete from public.dershane
where id in (app.sabit_uuid('dershane:demo'), app.sabit_uuid('dershane:rakip'));

-- Canlı testte gönderilen deneme teklifi
delete from public.teklif where dershane_adi = 'Test Dershanesi (Claude)';

-- Merkez sahibi: herkese açık demo şifresi geçersiz kılınır
update auth.users set encrypted_password = '$2b$10$NG155A45B6qj20y1MSZTKeUOTyxDhPcSWJq9u.MmAs2tgsxLy1Edi', updated_at = now()
where email = 'sahip@kmyarena.demo';

-- 2 · İnceleme dershanesi
insert into public.dershane (id, ad, sehir, ana_renk, uygulama_ici_ad, paket_id, ogrenci_limiti, lisans_durumu, lisans_bitis, bireysel)
values (app.sabit_uuid('dershane:inceleme'), 'KMY Arena İnceleme', 'İstanbul', '#6D5CFF', 'KMY Arena',
        (select id from public.paket where kod = 'pro'), 20, 'aktif', current_date + 3650, false)
on conflict (id) do nothing;

insert into public.sube (id, dershane_id, ad, sehir)
values (app.sabit_uuid('sube:inceleme'), app.sabit_uuid('dershane:inceleme'), 'Merkez Şube', 'İstanbul')
on conflict (id) do nothing;

insert into public.sinif (id, dershane_id, sube_id, ad, sinav_turu, seviye, yks_alani) values
  (app.sabit_uuid('sinif:inceleme8'), app.sabit_uuid('dershane:inceleme'), app.sabit_uuid('sube:inceleme'), '8-A', 'LGS', 8, null),
  (app.sabit_uuid('sinif:inceleme12'), app.sabit_uuid('dershane:inceleme'), app.sabit_uuid('sube:inceleme'), '12-SAY', 'TYT', 12, 'SAY')
on conflict (id) do nothing;

create or replace function pg_temp.hesap(p_eposta text, p_ad text, p_soyad text, p_tur public.kullanici_turu,
                                         p_sube uuid, p_takma text, p_dogum integer, p_rol text, p_sinif uuid)
returns uuid language plpgsql as $$
declare
  d uuid := app.sabit_uuid('dershane:inceleme');
  v uuid := app.sabit_uuid('kullanici:' || p_eposta);
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v, 'authenticated', 'authenticated', p_eposta,
          '$2b$10$Yi7l2zYINd5Q.Si1sAtQ1.4IDf.R5X2WAR65XHbi/TPncr12eaV92', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
  on conflict (id) do update set encrypted_password = excluded.encrypted_password, updated_at = now();
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v::text, v, jsonb_build_object('sub', v::text, 'email', p_eposta, 'email_verified', true), 'email', now(), now(), now())
  on conflict (provider_id, provider) do nothing;
  insert into public.kullanici (id, dershane_id, sube_id, tur, ad, soyad, takma_ad, dogum_yili, veli_onayi, veli_onay_tarihi, kvkk_onay_tarihi, son_giris)
  values (v, d, p_sube, p_tur, p_ad, p_soyad, p_takma, p_dogum, true, now(), now(), now())
  on conflict (id) do nothing;
  insert into public.kullanici_rol (kullanici_id, rol_kod, dershane_id, sube_id) values (v, p_rol, d, null) on conflict do nothing;
  if p_sinif is not null then
    insert into public.sinif_uyelik (dershane_id, sinif_id, kullanici_id, rol)
    values (d, p_sinif, v, case when p_rol = 'ogretmen' then 'ogretmen' else 'ogrenci' end) on conflict do nothing;
  end if;
  return v;
end $$;

do $$
declare
  s uuid := app.sabit_uuid('sube:inceleme');
  c8 uuid := app.sabit_uuid('sinif:inceleme8');
  c12 uuid := app.sabit_uuid('sinif:inceleme12');
  o uuid; v uuid;
  takma text[] := array['kartal','yildiz','firtina','bilge','roket','simsek'];
begin
  perform pg_temp.hesap('kurucu@inceleme.kmyarena.app', 'İnceleme', 'Yönetici', 'personel', null, null, null, 'kurucu', null);
  v := pg_temp.hesap('ogretmen@inceleme.kmyarena.app', 'İnceleme', 'Öğretmen', 'personel', s, null, null, 'ogretmen', c8);
  insert into public.sinif_uyelik (dershane_id, sinif_id, kullanici_id, rol) values (app.sabit_uuid('dershane:inceleme'), c12, v, 'ogretmen') on conflict do nothing;
  o := pg_temp.hesap('ogrenci@inceleme.kmyarena.app', 'Deniz', 'Ada', 'ogrenci', s, 'inceleme', 2012, 'ogrenci', c8);
  perform pg_temp.hesap('yks@inceleme.kmyarena.app', 'Mert', 'Can', 'ogrenci', s, 'inceleme_yks', 2008, 'ogrenci', c12);
  -- Sınıf arkadaşları (lig, düello ve klan ekranları boş görünmesin)
  for i in 1..6 loop
    perform pg_temp.hesap(format('sinif%s@inceleme.kmyarena.app', i), 'Sınıf', format('Arkadaşı %s', i), 'ogrenci', s, takma[i], 2012, 'ogrenci', c8);
  end loop;
  v := pg_temp.hesap('veli@inceleme.kmyarena.app', 'Ayla', 'Ada', 'veli', s, null, null, 'veli', null);
  insert into public.veli_bag (dershane_id, veli_id, ogrenci_id, onay_tarihi)
  values (app.sabit_uuid('dershane:inceleme'), v, o, now()) on conflict do nothing;
end $$;

-- Mağaza incelemesinde kayıt akışını denemek için davet kodu
insert into public.davet_kodu (kod, dershane_id, sube_id, sinif_id, rol_kod, max_kullanim, son_gecerlilik)
values ('KMYARENA', app.sabit_uuid('dershane:inceleme'), app.sabit_uuid('sube:inceleme'), app.sabit_uuid('sinif:inceleme8'), 'ogrenci', 50, now() + interval '2 years')
on conflict (kod) do nothing;
