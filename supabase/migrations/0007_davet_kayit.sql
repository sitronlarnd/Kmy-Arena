-- ─────────────────────────────────────────────────────────────
-- 0007 · Davet koduyla katılım, bireysel deneme kaydı, zamanlanmış işler
-- Akış: istemci Supabase Auth ile hesap açar (e-posta + şifre) → oturum
-- açıkken davet_kodu_kullan() çağırır → dershaneye, role ve sınıfa bağlanır.
-- Hata mesajları i18n anahtarıdır (istemci Türkçe metne çevirir).
-- ─────────────────────────────────────────────────────────────

create or replace function app.kullanici_olustur(
  p_dershane uuid, p_sube uuid, p_sinif uuid, p_rol text,
  p_ad text, p_soyad text, p_takma_ad text, p_dogum_yili integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_kapsam text;
  v_tur public.kullanici_turu;
  v_lisans public.lisans_durumu;
  v_limit integer;
  v_ogrenci_sayisi integer;
  v_yas integer;
begin
  if v_uid is null then raise exception 'giris.oturumYok'; end if;
  if exists (select 1 from public.kullanici where id = v_uid) then raise exception 'giris.zatenKayitli'; end if;

  select r.kapsam into v_kapsam from public.rol r where r.kod = p_rol;
  if v_kapsam is null or v_kapsam = 'merkez' then raise exception 'giris.kodGecersiz'; end if;

  select d.lisans_durumu, d.ogrenci_limiti into v_lisans, v_limit from public.dershane d where d.id = p_dershane;
  if v_lisans in ('askida', 'bitti') then raise exception 'giris.lisansPasif'; end if;

  v_tur := case p_rol when 'ogrenci' then 'ogrenci' when 'veli' then 'veli' else 'personel' end;

  if v_tur = 'ogrenci' then
    select count(*) into v_ogrenci_sayisi from public.kullanici k where k.dershane_id = p_dershane and k.tur = 'ogrenci';
    if v_ogrenci_sayisi >= v_limit then raise exception 'giris.lisansDolu'; end if;
  end if;

  if p_takma_ad is not null and p_takma_ad !~ '^[[:alnum:]_.]{3,20}$' then
    raise exception 'giris.takmaAdGecersiz';
  end if;
  if exists (select 1 from public.kullanici k where k.dershane_id = p_dershane and k.takma_ad = p_takma_ad::extensions.citext) then
    raise exception 'giris.takmaAdAlinmis';
  end if;

  v_yas := extract(year from now())::integer - p_dogum_yili;

  insert into public.kullanici (id, dershane_id, sube_id, tur, ad, soyad, takma_ad, dogum_yili, veli_onayi, veli_onay_tarihi, kvkk_onay_tarihi, son_giris)
  values (
    v_uid, p_dershane, p_sube, v_tur, trim(p_ad), trim(p_soyad), nullif(trim(p_takma_ad), ''), p_dogum_yili,
    -- 18 yaş üstü öğrenci ve tüm personel/veliler için veli onayı gerekmez
    (v_tur <> 'ogrenci' or v_yas >= 18), case when v_tur <> 'ogrenci' or v_yas >= 18 then now() end,
    now(), now()
  );

  insert into public.kullanici_rol (kullanici_id, rol_kod, dershane_id, sube_id)
  values (v_uid, p_rol, p_dershane, case when v_kapsam = 'sube' then p_sube end);

  if p_sinif is not null and p_rol in ('ogrenci', 'ogretmen') then
    insert into public.sinif_uyelik (dershane_id, sinif_id, kullanici_id, rol) values (p_dershane, p_sinif, v_uid, p_rol);
  end if;
end;
$$;

create or replace function public.davet_kodu_kullan(
  p_kod text, p_ad text, p_soyad text, p_takma_ad text default null, p_dogum_yili integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.davet_kodu;
begin
  select * into d from public.davet_kodu where kod = upper(trim(p_kod)) for update;
  if not found or d.son_gecerlilik < now() then raise exception 'giris.kodGecersiz'; end if;
  if d.kullanim >= d.max_kullanim then raise exception 'giris.kodKullanildi'; end if;

  perform app.kullanici_olustur(d.dershane_id, d.sube_id, d.sinif_id, d.rol_kod, p_ad, p_soyad, p_takma_ad, p_dogum_yili);
  update public.davet_kodu set kullanim = kullanim + 1 where kod = d.kod;
  perform app.denetle('davet_kodu_kullanildi', d.kod, jsonb_build_object('rol', d.rol_kod));

  return jsonb_build_object('dershane_id', d.dershane_id, 'rol', d.rol_kod);
end;
$$;

/** Açık kayıt: davet kodu olmadan gelen öğrenci "bireysel deneme" tenant'ına düşer. */
create or replace function public.bireysel_kayit(p_ad text, p_soyad text, p_takma_ad text, p_dogum_yili integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dershane uuid;
begin
  select id into v_dershane from public.dershane where bireysel;
  if v_dershane is null then raise exception 'giris.kodGecersiz'; end if;
  perform app.kullanici_olustur(v_dershane, null, null, 'ogrenci', p_ad, p_soyad, p_takma_ad, p_dogum_yili);
  return jsonb_build_object('dershane_id', v_dershane, 'rol', 'ogrenci');
end;
$$;

/** Yöneticinin (kendi yetkisi dahilinde) davet kodu üretmesi. RLS kontrol eder. */
create or replace function public.davet_kodu_olustur(
  p_sube uuid, p_sinif uuid, p_rol text default 'ogrenci', p_max_kullanim integer default 1, p_gun integer default 30
)
returns text
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_kod text;
begin
  loop
    v_kod := app.davet_kodu_uret();
    exit when not exists (select 1 from public.davet_kodu where kod = v_kod);
  end loop;
  insert into public.davet_kodu (kod, dershane_id, sube_id, sinif_id, rol_kod, max_kullanim, son_gecerlilik, olusturan)
  values (v_kod, app.dershane_id(), p_sube, p_sinif, p_rol, p_max_kullanim, now() + make_interval(days => p_gun), auth.uid());
  return v_kod;
end;
$$;

-- RLS fonksiyonları ve iç yardımcılar doğrudan çağrılamasın
revoke execute on function app.kullanici_olustur(uuid, uuid, uuid, text, text, text, text, integer) from public, anon, authenticated;
revoke execute on function public.davet_kodu_kullan(text, text, text, text, integer) from public, anon;
revoke execute on function public.bireysel_kayit(text, text, text, integer) from public, anon;
grant execute on function public.davet_kodu_kullan(text, text, text, text, integer) to authenticated;
grant execute on function public.bireysel_kayit(text, text, text, integer) to authenticated;

-- Davet kodu üretmeye yetkili olmayan biri satır ekleyemez (RLS); ancak
-- 'merkez' kapsamlı rol için kod üretimi de kısıtlanır.
alter table public.davet_kodu add constraint davet_kodu_merkez_rol_yok
  check (rol_kod not in ('merkez_sahip', 'merkez_icerik', 'merkez_destek', 'merkez_satis', 'bayi'));

-- ── Zamanlanmış işler (Supabase'de pg_cron varsa) ──
-- Diğer işler (veli raporu, tampon doldurma, pilot raporu) Vercel Cron'dadır.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'cevap-bolumu-olustur',
      '0 3 25 * *', -- her ayın 25'i 03:00 UTC: gelecek ayın bölümü
      $cron$ select app.cevap_bolumu_olustur((date_trunc('month', now()) + interval '1 month')::date) $cron$
    );
  end if;
end $$;

-- Vercel Cron yedeği (pg_cron yoksa): yalnızca service role çağırabilir
create or replace function public.sistem_cevap_bolumu_olustur()
returns text
language sql
security definer
set search_path = ''
as $$ select app.cevap_bolumu_olustur((date_trunc('month', now()) + interval '1 month')::date) $$;
revoke execute on function public.sistem_cevap_bolumu_olustur() from public, anon, authenticated;
grant execute on function public.sistem_cevap_bolumu_olustur() to service_role;
