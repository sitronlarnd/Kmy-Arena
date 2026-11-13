-- ─────────────────────────────────────────────────────────────
-- 0012 · LGS / YKS paketleri ve öğrenciye göre ders kapsamı
--
-- Dershanelere LGS ve YKS ayrı paket olarak satılır. Öğrencinin çözebileceği
-- dersler:
--   sınav grubu = kullanici.sinav_grubu  (elle atama)
--              ?? sınıfının sınav türü    (LGS → LGS, TYT/AYT/YDT → YKS)
--              ?? paketin tek grubu
--   ve bu grup dershanenin PAKETİNDE olmalı (değilse hiçbir ders açılmaz).
-- YKS'de alan (SAY, EA, SOZ, DIL) AYT/YDT derslerini daraltır:
--   kullanici.yks_alani ?? sınıfın yks_alani ?? (boş = tüm AYT dersleri).
-- ─────────────────────────────────────────────────────────────

alter table public.paket
  add column sinav_gruplari text[] not null default '{LGS,YKS}'
    check (sinav_gruplari <@ array['LGS', 'YKS']::text[] and cardinality(sinav_gruplari) > 0);

alter table public.ders
  add column alanlar text[] not null default '{}'
    check (alanlar <@ array['SAY', 'EA', 'SOZ', 'DIL']::text[]);

alter table public.sinif
  add column yks_alani text check (yks_alani in ('SAY', 'EA', 'SOZ', 'DIL'));

alter table public.kullanici
  add column sinav_grubu text check (sinav_grubu in ('LGS', 'YKS')),
  add column yks_alani text check (yks_alani in ('SAY', 'EA', 'SOZ', 'DIL'));
-- Bu iki alan yalnızca dershane yönetimi/merkez tarafından (service role) yazılır;
-- öğrencinin güncelleyebildiği tek sütun takma_ad olarak kalır (0006).

/** Öğrencinin sınav grubu ve alanı (null: erişim yok). */
create or replace function app.ogrenci_kapsami(p_kullanici uuid)
returns table (sinav_grubu text, yks_alani text)
language sql
stable
security definer
set search_path = ''
as $$
  with k as (
    select ku.id, ku.sinav_grubu, ku.yks_alani, p.sinav_gruplari
    from public.kullanici ku
    join public.dershane d on d.id = ku.dershane_id
    left join public.paket p on p.id = d.paket_id
    where ku.id = p_kullanici
  ), s as (
    select case when si.sinav_turu = 'LGS' then 'LGS' else 'YKS' end as grup, si.yks_alani
    from public.sinif_uyelik su join public.sinif si on si.id = su.sinif_id
    where su.kullanici_id = p_kullanici and su.rol = 'ogrenci'
    order by su.olusturma desc
    limit 1
  )
  select g.grup,
         case when g.grup = 'YKS' then coalesce((select yks_alani from k), (select yks_alani from s)) end
  from (
    select coalesce(
      (select sinav_grubu from k),
      (select grup from s),
      (select case when cardinality(sinav_gruplari) = 1 then sinav_gruplari[1] end from k)
    ) as grup
  ) g
  where g.grup is not null
    and g.grup = any (coalesce((select sinav_gruplari from k), '{LGS,YKS}'::text[]))
$$;

/** Öğrencinin çalışabileceği dersler. */
create or replace function public.sistem_ogrenci_dersleri(p_kullanici uuid)
returns setof public.ders
language sql
stable
security definer
set search_path = ''
as $$
  select d.*
  from public.ders d
  cross join app.ogrenci_kapsami(p_kullanici) k
  where (k.sinav_grubu = 'LGS' and d.sinav_turu = 'LGS')
     or (k.sinav_grubu = 'YKS' and (
          d.sinav_turu = 'TYT'
          or (d.sinav_turu in ('AYT', 'YDT') and (k.yks_alani is null or k.yks_alani = any (d.alanlar)))
        ))
  order by d.sira
$$;
revoke execute on function public.sistem_ogrenci_dersleri(uuid) from public, anon, authenticated;
grant execute on function public.sistem_ogrenci_dersleri(uuid) to service_role;

/** İstemci: kendi dersleri ve kapsamı. Personel/veli için tüm dersler (harita görüntüleme). */
create or replace function public.derslerim()
returns table (id uuid, kod text, ad text, sinav_turu text, sira smallint, sinav_grubu text, yks_alani text)
language sql
stable
security definer
set search_path = ''
as $$
  select d.id, d.kod, d.ad, d.sinav_turu, d.sira, k.sinav_grubu, k.yks_alani
  from public.sistem_ogrenci_dersleri(auth.uid()) d
  cross join app.ogrenci_kapsami(auth.uid()) k
$$;
revoke execute on function public.derslerim() from public, anon;
grant execute on function public.derslerim() to authenticated;

-- Ayrı satış paketleri (Merkez Panel > Dershaneler'de atanır, Faz 6)
insert into public.paket (kod, ad, ozellikler, ai_kotasi_token, sinav_gruplari) values
  ('lgs', 'LGS Paketi', '{}', 60000000, '{LGS}'),
  ('yks', 'YKS Paketi', '{}', 60000000, '{YKS}')
on conflict (kod) do update set sinav_gruplari = excluded.sinav_gruplari;
