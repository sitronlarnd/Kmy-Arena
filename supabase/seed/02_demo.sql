-- ─────────────────────────────────────────────────────────────
-- Demo tohum verisi — YALNIZCA demo/geliştirme ortamı için.
-- Tüm demo hesaplarının şifresi: KmyDemo!2026  (canlıda kullanma)
--
-- Faz 0 kapsamı: dershane, 2 şube, 4 sınıf, kurucu, 2 şube müdürü,
-- rehber öğretmen, 3 öğretmen, sekreter, 40 öğrenci, veli, davet kodları,
-- örnek havuz soruları ve cevaplar; RLS testi için ikinci bir dershane;
-- bireysel deneme tenant'ı; merkez sahip hesabı.
-- Deneme sonuçları, klanlar ve düello kayıtları ilgili fazlarda eklenir.
-- ─────────────────────────────────────────────────────────────

create or replace function pg_temp.hesap(
  p_eposta text, p_ad text, p_soyad text, p_tur public.kullanici_turu,
  p_dershane uuid, p_sube uuid, p_takma text, p_dogum integer
) returns uuid
language plpgsql as $$
declare
  v_id uuid := app.sabit_uuid('kullanici:' || p_eposta);
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', p_eposta,
          extensions.crypt('KmyDemo!2026', extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
  on conflict (id) do nothing;
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (v_id::text, v_id, jsonb_build_object('sub', v_id::text, 'email', p_eposta, 'email_verified', true), 'email', now(), now(), now())
  on conflict (provider_id, provider) do nothing;
  insert into public.kullanici (id, dershane_id, sube_id, tur, ad, soyad, takma_ad, dogum_yili, veli_onayi, veli_onay_tarihi, kvkk_onay_tarihi, son_giris)
  values (v_id, p_dershane, p_sube, p_tur, p_ad, p_soyad, p_takma, p_dogum,
          p_tur <> 'ogrenci' or extract(year from now()) - p_dogum >= 18, now(), now(), now())
  on conflict (id) do nothing;
  return v_id;
end $$;

create or replace function pg_temp.rol(p_kullanici uuid, p_rol text, p_dershane uuid, p_sube uuid default null)
returns void language sql as $$
  insert into public.kullanici_rol (kullanici_id, rol_kod, dershane_id, sube_id)
  values (p_kullanici, p_rol, p_dershane, p_sube) on conflict do nothing
$$;

-- ── Paketler ──
insert into public.paket (id, kod, ad, ozellikler, ai_kotasi_token, ogrenci_basi_fiyat) values
  (app.sabit_uuid('paket:temel'), 'temel', 'Temel', '{"dershaneler_arasi_lig": false, "fotograftan_coz": false}', 20000000, null),
  (app.sabit_uuid('paket:pro'), 'pro', 'Pro', '{}', 60000000, null),
  (app.sabit_uuid('paket:kurumsal'), 'kurumsal', 'Kurumsal', '{"dershaneler_arasi_lig": true}', 150000000, null)
on conflict (kod) do nothing;

-- ── Dershaneler ──
insert into public.dershane (id, ad, sehir, ana_renk, uygulama_ici_ad, paket_id, ogrenci_limiti, lisans_durumu, lisans_bitis, bireysel) values
  (app.sabit_uuid('dershane:demo'), 'Demo Dershanesi', 'İstanbul', '#5B5BF0', 'Demo Arena', app.sabit_uuid('paket:pro'), 200, 'aktif', current_date + 365, false),
  (app.sabit_uuid('dershane:rakip'), 'Rakip Dershane', 'Ankara', '#E4572E', null, app.sabit_uuid('paket:temel'), 50, 'pilot', current_date + 30, false),
  (app.sabit_uuid('dershane:bireysel'), 'Bireysel Deneme', null, '#5B5BF0', 'KMY Arena', app.sabit_uuid('paket:temel'), 100000, 'aktif', null, true)
on conflict (id) do nothing;

insert into public.sube (id, dershane_id, ad, sehir) values
  (app.sabit_uuid('sube:kadikoy'), app.sabit_uuid('dershane:demo'), 'Kadıköy Şubesi', 'İstanbul'),
  (app.sabit_uuid('sube:uskudar'), app.sabit_uuid('dershane:demo'), 'Üsküdar Şubesi', 'İstanbul'),
  (app.sabit_uuid('sube:cankaya'), app.sabit_uuid('dershane:rakip'), 'Çankaya Şubesi', 'Ankara')
on conflict (id) do nothing;

insert into public.sinif (id, dershane_id, sube_id, ad, sinav_turu, seviye) values
  (app.sabit_uuid('sinif:8A'), app.sabit_uuid('dershane:demo'), app.sabit_uuid('sube:kadikoy'), '8-A', 'LGS', 8),
  (app.sabit_uuid('sinif:12SAY'), app.sabit_uuid('dershane:demo'), app.sabit_uuid('sube:kadikoy'), '12-SAY', 'TYT', 12),
  (app.sabit_uuid('sinif:8B'), app.sabit_uuid('dershane:demo'), app.sabit_uuid('sube:uskudar'), '8-B', 'LGS', 8),
  (app.sabit_uuid('sinif:12EA'), app.sabit_uuid('dershane:demo'), app.sabit_uuid('sube:uskudar'), '12-EA', 'TYT', 12),
  (app.sabit_uuid('sinif:R8'), app.sabit_uuid('dershane:rakip'), app.sabit_uuid('sube:cankaya'), '8-R', 'LGS', 8)
on conflict (id) do nothing;

-- YKS alanları (demo dershane Pro paketiyle LGS + YKS)
update public.sinif set yks_alani = 'SAY' where id = app.sabit_uuid('sinif:12SAY');
update public.sinif set yks_alani = 'EA' where id = app.sabit_uuid('sinif:12EA');

-- ── Hesaplar ──
do $$
declare
  d uuid := app.sabit_uuid('dershane:demo');
  r uuid := app.sabit_uuid('dershane:rakip');
  kad uuid := app.sabit_uuid('sube:kadikoy');
  usk uuid := app.sabit_uuid('sube:uskudar');
  can uuid := app.sabit_uuid('sube:cankaya');
  v uuid;
  adlar text[] := array['Ayşe','Mehmet','Zeynep','Emir','Elif','Yusuf','Defne','Ömer','Ecrin','Kerem',
                        'Asel','Alparslan','Nehir','Göktuğ','Duru','Çınar','Lina','Aras','Masal','Ege'];
  soyadlar text[] := array['Yılmaz','Kaya','Demir','Şahin','Çelik','Yıldız','Aydın','Öztürk','Arslan','Doğan'];
  siniflar uuid[] := array[app.sabit_uuid('sinif:8A'), app.sabit_uuid('sinif:12SAY'), app.sabit_uuid('sinif:8B'), app.sabit_uuid('sinif:12EA')];
  subeler uuid[] := array[kad, kad, usk, usk];
  dogum integer[] := array[2012, 2008, 2012, 2008];
  s integer;
begin
  -- Merkez
  v := pg_temp.hesap('sahip@kmyarena.demo', 'Platform', 'Sahibi', 'merkez', null, null, null, null);
  perform pg_temp.rol(v, 'merkez_sahip', null);

  -- Demo dershane yönetimi
  v := pg_temp.hesap('kurucu@demo.kmyarena.demo', 'Selin', 'Arıkan', 'personel', d, null, null, null);
  perform pg_temp.rol(v, 'kurucu', d);
  v := pg_temp.hesap('mudur.kadikoy@demo.kmyarena.demo', 'Burak', 'Tan', 'personel', d, kad, null, null);
  perform pg_temp.rol(v, 'sube_muduru', d, kad);
  v := pg_temp.hesap('mudur.uskudar@demo.kmyarena.demo', 'Derya', 'Koç', 'personel', d, usk, null, null);
  perform pg_temp.rol(v, 'sube_muduru', d, usk);
  v := pg_temp.hesap('rehber@demo.kmyarena.demo', 'Gül', 'Ersoy', 'personel', d, null, null, null);
  perform pg_temp.rol(v, 'rehber_ogretmen', d);
  v := pg_temp.hesap('sekreter@demo.kmyarena.demo', 'Hakan', 'Uçar', 'personel', d, kad, null, null);
  perform pg_temp.rol(v, 'sekreter', d, kad);

  -- Öğretmenler ve sınıf atamaları
  v := pg_temp.hesap('ogretmen.mat@demo.kmyarena.demo', 'Kemal', 'Işık', 'personel', d, kad, null, null);
  perform pg_temp.rol(v, 'ogretmen', d);
  insert into public.sinif_uyelik (dershane_id, sinif_id, kullanici_id, rol) values (d, siniflar[1], v, 'ogretmen'), (d, siniflar[2], v, 'ogretmen') on conflict do nothing;
  v := pg_temp.hesap('ogretmen.fen@demo.kmyarena.demo', 'Seda', 'Güler', 'personel', d, kad, null, null);
  perform pg_temp.rol(v, 'ogretmen', d);
  insert into public.sinif_uyelik (dershane_id, sinif_id, kullanici_id, rol) values (d, siniflar[1], v, 'ogretmen') on conflict do nothing;
  v := pg_temp.hesap('ogretmen.tr@demo.kmyarena.demo', 'Onur', 'Bal', 'personel', d, usk, null, null);
  perform pg_temp.rol(v, 'ogretmen', d);
  insert into public.sinif_uyelik (dershane_id, sinif_id, kullanici_id, rol) values (d, siniflar[3], v, 'ogretmen'), (d, siniflar[4], v, 'ogretmen') on conflict do nothing;

  -- 40 öğrenci: her sınıfa 10
  for i in 1..40 loop
    s := ((i - 1) / 10) + 1;
    v := pg_temp.hesap(
      format('ogrenci%s@demo.kmyarena.demo', lpad(i::text, 2, '0')),
      adlar[((i - 1) % 20) + 1], soyadlar[((i * 7) % 10) + 1], 'ogrenci', d, subeler[s],
      format('oyuncu%s', lpad(i::text, 2, '0')), dogum[s]
    );
    perform pg_temp.rol(v, 'ogrenci', d);
    insert into public.sinif_uyelik (dershane_id, sinif_id, kullanici_id, rol) values (d, siniflar[s], v, 'ogrenci') on conflict do nothing;
  end loop;

  -- Erken uyarı demosu: 6 gündür giriş yapmayan öğrenci
  update public.kullanici set son_giris = now() - interval '6 days'
  where id = app.sabit_uuid('kullanici:ogrenci05@demo.kmyarena.demo');

  -- Veli: ogrenci01'in velisi (onaylı)
  v := pg_temp.hesap('veli01@demo.kmyarena.demo', 'Fatma', 'Yılmaz', 'veli', d, kad, null, null);
  perform pg_temp.rol(v, 'veli', d);
  insert into public.veli_bag (dershane_id, veli_id, ogrenci_id, onay_tarihi)
  values (d, v, app.sabit_uuid('kullanici:ogrenci01@demo.kmyarena.demo'), now()) on conflict do nothing;
  update public.kullanici set veli_onayi = true, veli_onay_tarihi = now()
  where id = app.sabit_uuid('kullanici:ogrenci01@demo.kmyarena.demo');

  -- Rakip dershane (RLS testleri için)
  v := pg_temp.hesap('kurucu@rakip.kmyarena.demo', 'Rakip', 'Kurucu', 'personel', r, null, null, null);
  perform pg_temp.rol(v, 'kurucu', r);
  for i in 1..2 loop
    v := pg_temp.hesap(format('ogrenci%s@rakip.kmyarena.demo', i), 'Rakip', format('Öğrenci%s', i), 'ogrenci', r, can, format('rakip%s', i), 2012);
    perform pg_temp.rol(v, 'ogrenci', r);
    insert into public.sinif_uyelik (dershane_id, sinif_id, kullanici_id, rol) values (r, app.sabit_uuid('sinif:R8'), v, 'ogrenci') on conflict do nothing;
  end loop;
end $$;

-- ── Davet kodları (demo) ──
insert into public.davet_kodu (kod, dershane_id, sube_id, sinif_id, rol_kod, max_kullanim, son_gecerlilik) values
  ('DEMA8AKD', app.sabit_uuid('dershane:demo'), app.sabit_uuid('sube:kadikoy'), app.sabit_uuid('sinif:8A'), 'ogrenci', 100, now() + interval '1 year'),
  ('DEMTYTKD', app.sabit_uuid('dershane:demo'), app.sabit_uuid('sube:kadikoy'), app.sabit_uuid('sinif:12SAY'), 'ogrenci', 100, now() + interval '1 year'),
  ('DEMHCRTM', app.sabit_uuid('dershane:demo'), app.sabit_uuid('sube:kadikoy'), null, 'ogretmen', 10, now() + interval '1 year'),
  ('RAKP8RKD', app.sabit_uuid('dershane:rakip'), app.sabit_uuid('sube:cankaya'), app.sabit_uuid('sinif:R8'), 'ogrenci', 48, now() + interval '30 days')
on conflict (kod) do nothing;

-- ── Örnek havuz soruları (doğrulanmış AI soruları, platform geneli) ──
insert into public.soru (id, kaynak, kazanim_id, sinav_turu, soru_tipi, zorluk, tahmini_sure_sn, govde_md, siklar, dogru,
                         cozum_adimlari, celdirici_notlari, ipuclari, prompt_surumu, uretici_model, dogrulayici_model, durum, gosterim_sayisi)
values
  (app.sabit_uuid('soru:demo1'), 'ai', app.sabit_uuid('kazanim:M.8.1.2.1'), 'LGS', 'islem', 3, 45,
   '$(-2)^3 + 2^3$ işleminin sonucu kaçtır?', '{"A":"-16","B":"0","C":"8","D":"16"}', 'B',
   '["$(-2)^3 = -8$", "$2^3 = 8$", "$-8 + 8 = 0$"]', '{"A":"İki terimi de negatif aldı","D":"Negatif tabanın tek kuvvetinin işaretini unuttu"}',
   '["Negatif sayının tek kuvveti negatiftir.", "Önce her terimi ayrı hesapla.", "-8 ile 8 toplanıyor."]',
   'uretim-v1', 'claude-sonnet-4-6', 'claude-sonnet-5-5', 'dogrulandi', 0),
  (app.sabit_uuid('soru:demo2'), 'ai', app.sabit_uuid('kazanim:M.8.1.2.1'), 'LGS', 'islem', 5, 60,
   '$\dfrac{3^{-2} \cdot 3^{5}}{3^{2}}$ ifadesinin değeri kaçtır?', '{"A":"1","B":"3","C":"9","D":"27"}', 'B',
   '["Payda üsler toplanır: $-2+5=3$", "$3^3 / 3^2 = 3^1$", "Sonuç $3$"]', '{"C":"Paydadaki üssü çıkarmayı unuttu"}',
   '["Aynı tabanlı çarpımda üsler toplanır.", "Bölmede üsler çıkarılır.", "$3^{3-2}$"]',
   'uretim-v1', 'claude-sonnet-4-6', 'claude-sonnet-5-5', 'dogrulandi', 12),
  (app.sabit_uuid('soru:demo3'), 'ai', app.sabit_uuid('kazanim:M.8.1.2.1'), 'LGS', 'yeni_nesil', 7, 90,
   'Bir bakteri kolonisi her saat **ikiye** katlanmaktadır. Başlangıçta $2^{5}$ bakteri varsa 3 saat sonra kaç bakteri olur?', '{"A":"$2^{6}$","B":"$2^{8}$","C":"$2^{15}$","D":"$6^{5}$"}', 'B',
   '["Her saat 2 ile çarpılır: $2^5 \\cdot 2^3$", "$= 2^8$"]', '{"C":"Üsleri çarptı","A":"Saat sayısını üsse eklemedi"}',
   '["Her saat bir kez 2 ile çarpılıyor.", "3 saat → $2^3$ ile çarpım.", "Üsleri topla."]',
   'uretim-v1', 'claude-sonnet-4-6', 'claude-sonnet-5-5', 'dogrulandi', 0)
on conflict (id) do nothing;

-- ogrenci01 demo2'yi görmüş ve doğru cevaplamış
insert into public.soru_gosterim (kullanici_id, soru_id, dershane_id, baglam)
values (app.sabit_uuid('kullanici:ogrenci01@demo.kmyarena.demo'), app.sabit_uuid('soru:demo2'), app.sabit_uuid('dershane:demo'), 'antrenman')
on conflict do nothing;
insert into public.cevap (dershane_id, kullanici_id, soru_id, kazanim_id, baglam, secilen, dogru_mu, sure_ms, theta_once, theta_sonra, beklenen, xp, altin)
select app.sabit_uuid('dershane:demo'), app.sabit_uuid('kullanici:ogrenci01@demo.kmyarena.demo'), app.sabit_uuid('soru:demo2'),
       app.sabit_uuid('kazanim:M.8.1.2.1'), 'antrenman', 'B', true, 41000, 1000, 1026.5, 0.337, 54, 2
where not exists (select 1 from public.cevap where kullanici_id = app.sabit_uuid('kullanici:ogrenci01@demo.kmyarena.demo'));
insert into public.beceri (dershane_id, kullanici_id, kazanim_id, theta, cozulen, dogru, son10)
values (app.sabit_uuid('dershane:demo'), app.sabit_uuid('kullanici:ogrenci01@demo.kmyarena.demo'), app.sabit_uuid('kazanim:M.8.1.2.1'), 1026.5, 1, 1, '{1}')
on conflict do nothing;

-- Rakip dershane öğrencisinin de bir beceri kaydı olsun (RLS sızıntı testi)
insert into public.beceri (dershane_id, kullanici_id, kazanim_id, theta, cozulen, dogru)
values (app.sabit_uuid('dershane:rakip'), app.sabit_uuid('kullanici:ogrenci1@rakip.kmyarena.demo'), app.sabit_uuid('kazanim:M.8.1.2.1'), 980, 3, 1)
on conflict do nothing;

-- Rakip dershaneye özel bayrak (dershane bazlı bayrak sızıntı testi)
insert into public.ozellik_bayragi (kod, dershane_id, acik) values ('duello', app.sabit_uuid('dershane:rakip'), false)
on conflict do nothing;
