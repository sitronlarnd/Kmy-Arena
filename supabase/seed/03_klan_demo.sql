-- Demo: 4 klan (Faz 4). Tekrar çalıştırılabilir; klanlar varsa dokunmaz.
do $$
declare
  dm uuid := app.sabit_uuid('dershane:demo');
  r record;
  k uuid;
  i integer;
begin
  if not exists (select 1 from public.dershane where id = dm) then return; end if;
  if exists (select 1 from public.klan where dershane_id = dm) then return; end if;
  for r in select * from (values
    ('Kartallar', 'Zirveye kanat çırparız', '{"kalkan": "klasik", "simge": "kartal", "renk": "#2E86AB"}', 'acik', array[1, 2, 3, 4, 5, 6, 11]),
    ('Yıldızlar', 'Her gün biraz daha parlak', '{"kalkan": "yuvarlak", "simge": "yildiz", "renk": "#FFC914"}', 'basvurulu', array[7, 8, 9, 10, 12, 13, 14]),
    ('Fırtına', 'Soru görünce eseriz', '{"kalkan": "sivri", "simge": "simsek", "renk": "#8E44AD"}', 'acik', array[21, 22, 23, 24, 25, 26, 27]),
    ('Bilgeler', 'Sabır ve çalışma', '{"kalkan": "klasik", "simge": "kitap", "renk": "#76B041"}', 'davet', array[31, 32, 33, 34, 35, 36, 37])
  ) as t (ad, slogan, amblem, katilim, uyeler) loop
    insert into public.klan (dershane_id, ad, slogan, amblem, katilim_turu, lider_id, olusturan_id, katki_toplam, seviye)
    values (dm, r.ad, r.slogan, r.amblem::jsonb, r.katilim,
            app.sabit_uuid(format('kullanici:ogrenci%s@demo.kmyarena.demo', lpad(r.uyeler[1]::text, 2, '0'))),
            app.sabit_uuid(format('kullanici:ogrenci%s@demo.kmyarena.demo', lpad(r.uyeler[1]::text, 2, '0'))),
            150 + length(r.ad) * 40, app.klan_seviyesi(150 + length(r.ad) * 40))
    returning id into k;
    for i in 1..array_length(r.uyeler, 1) loop
      insert into public.klan_uyelik (kullanici_id, klan_id, dershane_id, rol, toplam_katki, hafta, haftalik_katki, son_katki)
      values (app.sabit_uuid(format('kullanici:ogrenci%s@demo.kmyarena.demo', lpad(r.uyeler[i]::text, 2, '0'))), k, dm,
              case when i = 1 then 'lider' when i = 2 then 'yardimci' else 'uye' end,
              20 + i * 7, app.hafta_basi(app.bugun()), (i * 5) % 31, now() - make_interval(hours => i))
      on conflict do nothing;
    end loop;
    insert into public.klan_mesaj (klan_id, dershane_id, tur, kod) values (k, dm, 'sistem', 'kuruldu');
    perform app.klan_hafta_hazirla(k);
  end loop;
end $$;
