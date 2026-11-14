-- ─────────────────────────────────────────────────────────────
-- 0026 · Düzeltme: turnuva ve canlı yarışmada ders, sınıfın sınav grubuyla
--        uyumlu olmalı (LGS sınıfına AYT dersi seçilemez). Canlı testte bulundu.
-- ─────────────────────────────────────────────────────────────

create or replace function public.panel_turnuva_olustur(p_ad text, p_sinif uuid, p_ders uuid, p_boyut integer, p_ogrenciler uuid[] default null, p_odul text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_d uuid := app.dershane_id(); v_id uuid; v_l uuid[]; v_n integer; v_b integer; i integer; v_tohum integer[];
begin
  if v_d is null or not app.sinif_okuyabilir(p_sinif) or not app.yetkisi_var('odev.yonet', v_d, app.sube_id()) then raise exception 'panel.yetkisiz'; end if;
  if p_boyut not in (4, 8, 16, 32) then raise exception 'panel.turnuvaBoyut'; end if;
  if not exists (select 1 from public.sinif s join public.ders d on d.id = p_ders where s.id = p_sinif and (s.sinav_turu = 'LGS') = (d.sinav_turu = 'LGS')) then
    raise exception 'panel.dersSinifUyumsuz';
  end if;
  select array_agg(k.id order by coalesce(i.seviye, 1) desc, coalesce(i.toplam_dogru, 0) desc) into v_l
  from public.sinif_uyelik u join public.kullanici k on k.id = u.kullanici_id and k.silinme_talebi is null
  left join public.ogrenci_ilerleme i on i.kullanici_id = k.id
  where u.sinif_id = p_sinif and u.rol = 'ogrenci' and (p_ogrenciler is null or k.id = any (p_ogrenciler));
  v_n := coalesce(cardinality(v_l), 0);
  if v_n < 2 then raise exception 'panel.ogrenciYok'; end if;
  v_b := p_boyut;
  while v_b / 2 >= v_n loop v_b := v_b / 2; end loop;
  v_b := greatest(v_b, 2);
  v_l := v_l[1:v_b];
  insert into public.turnuva (dershane_id, sinif_id, olusturan_id, ad, ders_id, boyut, odul)
  values (v_d, p_sinif, auth.uid(), p_ad, p_ders, greatest(4, v_b), nullif(trim(p_odul), '')) returning id into v_id;
  -- Standart tohum sırası: 1 vs N, 2 vs N-1 …
  for i in 1..(v_b / 2) loop
    insert into public.turnuva_mac (turnuva_id, dershane_id, tur, sira, a, b, durum)
    values (v_id, v_d, 1, i, v_l[i], v_l[v_b + 1 - i], 'hazir');
  end loop;
  -- Bay: rakibi olmayan otomatik geçer
  update public.turnuva_mac set kazanan = coalesce(a, b), durum = 'bitti' where turnuva_id = v_id and (a is null or b is null);
  perform app.turnuva_ilerlet(v_id);
  return v_id;
end $$;

create or replace function public.panel_canli_baslat(p_sinif uuid, p_ders uuid, p_adet integer default 10, p_sure integer default 40, p_sorular uuid[] default null, p_ad text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_d uuid := app.dershane_id(); v_sinav text; v_grup text; v_sorular uuid[]; v_pin text; v_id uuid; v_bas timestamptz := now() + interval '60 seconds';
begin
  if v_d is null or not app.sinif_okuyabilir(p_sinif) or not app.yetkisi_var('odev.yonet', v_d, app.sube_id()) then raise exception 'panel.yetkisiz'; end if;
  select sinav_turu into v_sinav from public.sinif where id = p_sinif and dershane_id = v_d;
  v_grup := case when v_sinav = 'LGS' then 'LGS' else 'YKS' end;
  if p_sorular is null and not exists (select 1 from public.ders d where d.id = p_ders and (d.sinav_turu = 'LGS') = (v_sinav = 'LGS')) then
    raise exception 'panel.dersSinifUyumsuz';
  end if;
  if p_sorular is not null then
    select array_agg(s.id) into v_sorular from unnest(p_sorular) with ordinality u(id, n) join public.soru s on s.id = u.id
    where s.kaynak = 'ogretmen' and s.dershane_id = v_d and s.durum = 'dogrulandi' and (s.ogretmen_id = auth.uid() or s.paylasim = 'dershane');
  else
    select array_agg(id) into v_sorular from (
      select s.id from public.soru s join public.kazanim k on k.id = s.kazanim_id join public.unite un on un.id = k.unite_id
      where s.kaynak = 'ai' and s.durum = 'dogrulandi' and s.zorluk_bandi between 2 and 4 and un.ders_id = p_ders
      order by random() limit greatest(3, least(coalesce(p_adet, 10), 15))
    ) x;
  end if;
  if coalesce(cardinality(v_sorular), 0) < 3 then raise exception 'panel.soruYok'; end if;
  loop
    v_pin := lpad(floor(random() * 1000000)::int::text, 6, '0');
    exit when not exists (select 1 from public.canli_oturum where dershane_id = v_d and pin = v_pin);
  end loop;
  insert into public.canli_oturum (dershane_id, sinav_grubu, gun, baslangic, sorular, sure_sn, aralik_sn, sinif_id, pin, olusturan_id, ad)
  values (v_d, v_grup, (now() at time zone 'Europe/Istanbul')::date, v_bas, v_sorular, greatest(15, least(coalesce(p_sure, 40), 120)),
          greatest(15, least(coalesce(p_sure, 40), 120)) + 15, p_sinif, v_pin, auth.uid(), coalesce(nullif(trim(p_ad), ''), 'Canlı sınıf yarışması'))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'pin', v_pin, 'baslangic', v_bas);
end $$;

-- Yanlış dersle açılmış, hiç maçı oynanmamış turnuvalar iptal
update public.turnuva t set durum = 'iptal', bitis = now()
where t.durum = 'surdu'
  and exists (select 1 from public.sinif s join public.ders d on d.id = t.ders_id where s.id = t.sinif_id and (s.sinav_turu = 'LGS') <> (d.sinav_turu = 'LGS'));
