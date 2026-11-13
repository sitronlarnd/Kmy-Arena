-- 0021 · Risk: hiç çözmemiş öğrenci için ayrı ve daha yumuşak sinyal
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

  if v_son is null then
    v_puan := v_puan + 35;
    v_nedenler := v_nedenler || 'Henüz soru çözmeye başlamadı'::text;
  elsif v_gun >= 5 then
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
    v_nedenler := v_nedenler || 'İki haftadır tek üniteye çalışıyor'::text;
  end if;
  return jsonb_build_object('puan', least(100, v_puan), 'nedenler', to_jsonb(v_nedenler), 'son_cozum', v_son);
end;
$$;

