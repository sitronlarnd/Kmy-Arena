-- ─────────────────────────────────────────────────────────────
-- 0019 · Faz 5: Topluluk soru-cevap, Sokratik asistan, fotoğraftan çöz,
--        rehberlik bildirimi
--
-- - Topluluk dershane dışına asla çıkmaz; görünürlük sınıf / şube / dershane.
-- - "İlk doğru cevaplayan" kuralı: puan yalnız kabul edilen (soran ya da
--   öğretmen) cevaba verilir; AI değerlendirmesi yalnız etikettir.
-- - Asistan sohbetleri 180 gün saklanır (cron siler). Fotoğraflar asistanda
--   saklanmaz; yalnız okunan metin tutulur.
-- ─────────────────────────────────────────────────────────────

alter table public.ogrenci_ilerleme
  add column topluluk_kabul integer not null default 0,
  add column topluluk_soru integer not null default 0;

create table public.topluluk_soru (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  sube_id uuid references public.sube (id) on delete set null,
  sinif_id uuid references public.sinif (id) on delete set null,
  soran_id uuid not null references public.kullanici (id) on delete cascade,
  gorunurluk text not null default 'dershane' check (gorunurluk in ('sinif', 'sube', 'dershane')),
  ders_id uuid not null references public.ders (id),
  kazanim_id uuid references public.kazanim (id),
  metin text not null check (char_length(metin) between 5 and 2000),
  gorsel_yol text,
  -- Fotoğraftan okunan metin (AI değerlendirme ve ipucu için)
  gorsel_metin text,
  durum text not null default 'acik' check (durum in ('acik', 'cozuldu', 'gizli')),
  ai_ipucu text,
  ai_ipucu_zamani timestamptz,
  ai_cozum text,
  ai_cozum_zamani timestamptz,
  ogretmen_bekliyor boolean not null default false,
  soran_odul boolean not null default false,
  olusturma timestamptz not null default now()
);
create index topluluk_soru_akis on public.topluluk_soru (dershane_id, olusturma desc) where durum <> 'gizli';
create index topluluk_soru_soran on public.topluluk_soru (soran_id, olusturma desc);
create index topluluk_soru_bekleyen on public.topluluk_soru (olusturma) where durum = 'acik';

create table public.topluluk_cevap (
  id uuid primary key default gen_random_uuid(),
  soru_id uuid not null references public.topluluk_soru (id) on delete cascade,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  cevaplayan_id uuid not null references public.kullanici (id) on delete cascade,
  sik char(1) check (sik in ('A', 'B', 'C', 'D', 'E')),
  aciklama text not null check (char_length(aciklama) between 10 and 2000),
  gorsel_yol text,
  ai_durum text not null default 'bekliyor' check (ai_durum in ('bekliyor', 'tamam', 'hata')),
  ai_dogru boolean,
  ai_aciklama_yeterli boolean,
  ai_not text,
  kabul text check (kabul in ('soran', 'ogretmen')),
  kabul_zamani timestamptz,
  ornek_cozum boolean not null default false,
  xp integer not null default 0,
  altin integer not null default 0,
  puan_donduruldu boolean not null default false,
  gizli boolean not null default false,
  olusturma timestamptz not null default now(),
  unique (soru_id, cevaplayan_id)
);
create index topluluk_cevap_soru on public.topluluk_cevap (soru_id, olusturma);
create index topluluk_cevap_cevaplayan on public.topluluk_cevap (cevaplayan_id, kabul_zamani desc);

create table public.asistan_oturum (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  tur text not null check (tur in ('soru', 'fotograf')),
  soru_id uuid references public.soru (id) on delete set null,
  -- fotoğraf: { metin_md, siklar, ders_kod, kazanim_kod, cozum, dogru }
  fotograf jsonb,
  ipucu_seviyesi smallint not null default 0,
  olusturma timestamptz not null default now()
);
create index asistan_oturum_kullanici on public.asistan_oturum (kullanici_id, olusturma desc);

create table public.asistan_mesaj (
  id bigint generated always as identity primary key,
  oturum_id uuid not null references public.asistan_oturum (id) on delete cascade,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  rol text not null check (rol in ('ogrenci', 'asistan')),
  icerik text not null check (char_length(icerik) <= 6000),
  destek boolean not null default false,
  olusturma timestamptz not null default now()
);
create index asistan_mesaj_oturum on public.asistan_mesaj (oturum_id, id);
create index asistan_mesaj_gunluk on public.asistan_mesaj (kullanici_id, olusturma) where rol = 'ogrenci';

-- Kendine zarar / ciddi sıkıntı tespiti → rehberlik servisi (içerik değil, kısa özet)
create table public.rehberlik_bildirim (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  kaynak text not null check (kaynak in ('asistan', 'topluluk', 'klan')),
  ozet text not null check (char_length(ozet) <= 300),
  durum text not null default 'yeni' check (durum in ('yeni', 'goruldu', 'kapandi')),
  olusturma timestamptz not null default now()
);
create index rehberlik_bildirim_yeni on public.rehberlik_bildirim (dershane_id, olusturma desc) where durum = 'yeni';

alter table public.topluluk_soru enable row level security;
alter table public.topluluk_cevap enable row level security;
alter table public.asistan_oturum enable row level security;
alter table public.asistan_mesaj enable row level security;
alter table public.rehberlik_bildirim enable row level security;

create policy topluluk_soru_denetim on public.topluluk_soru for select to authenticated
  using (app.yetkisi_var('moderasyon.yap', dershane_id));
create policy topluluk_cevap_denetim on public.topluluk_cevap for select to authenticated
  using (app.yetkisi_var('moderasyon.yap', dershane_id));
create policy rehberlik_bildirim_oku on public.rehberlik_bildirim for select to authenticated
  using (app.yetkisi_var('rehberlik.oku', dershane_id));
create policy rehberlik_bildirim_guncelle on public.rehberlik_bildirim for update to authenticated
  using (app.yetkisi_var('rehberlik.oku', dershane_id)) with check (app.yetkisi_var('rehberlik.oku', dershane_id));
revoke insert, update, delete on public.topluluk_soru, public.topluluk_cevap, public.asistan_oturum, public.asistan_mesaj from anon, authenticated;
revoke insert, delete on public.rehberlik_bildirim from anon, authenticated;
revoke update on public.rehberlik_bildirim from anon;
-- Personel yalnız durumu değiştirebilir
revoke update on public.rehberlik_bildirim from authenticated;
grant update (durum) on public.rehberlik_bildirim to authenticated;

-- Şikâyet hedefleri: topluluk
create or replace function app.topluluk_gorebilir(p_kullanici uuid, p_soru public.topluluk_soru)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select k.dershane_id = p_soru.dershane_id
    and (p_soru.durum <> 'gizli' or p_soru.soran_id = p_kullanici)
    and (
      p_soru.soran_id = p_kullanici
      or p_soru.gorunurluk = 'dershane'
      or (p_soru.gorunurluk = 'sube' and k.sube_id is not distinct from p_soru.sube_id)
      or (p_soru.gorunurluk = 'sinif' and exists (
            select 1 from public.sinif_uyelik su where su.kullanici_id = p_kullanici and su.sinif_id = p_soru.sinif_id))
    )
  from public.kullanici k where k.id = p_kullanici
$$;

-- ── Topluluk ──

create or replace function public.sistem_topluluk_sor(
  p_kullanici uuid, p_ders uuid, p_kazanim uuid, p_metin text, p_gorsel_yol text, p_gorsel_metin text,
  p_gorunurluk text, p_gunluk_max integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_k public.kullanici;
  v_sinif uuid;
  v_id uuid;
begin
  select * into v_k from public.kullanici where id = p_kullanici and tur = 'ogrenci';
  if not found then raise exception 'topluluk.yetkisiz'; end if;
  if not exists (select 1 from public.sistem_ogrenci_dersleri(p_kullanici) d where d.id = p_ders) then raise exception 'topluluk.dersGecersiz'; end if;
  if p_kazanim is not null and not exists (
    select 1 from public.kazanim k join public.unite u on u.id = k.unite_id where k.id = p_kazanim and u.ders_id = p_ders)
  then raise exception 'topluluk.dersGecersiz'; end if;
  if (select count(*) from public.topluluk_soru where soran_id = p_kullanici and olusturma >= (app.bugun()::timestamp at time zone 'Europe/Istanbul')) >= p_gunluk_max
  then raise exception 'topluluk.gunlukSinir'; end if;
  select sinif_id into v_sinif from public.sinif_uyelik where kullanici_id = p_kullanici and rol = 'ogrenci' order by olusturma limit 1;
  insert into public.topluluk_soru (dershane_id, sube_id, sinif_id, soran_id, gorunurluk, ders_id, kazanim_id, metin, gorsel_yol, gorsel_metin)
  values (v_k.dershane_id, v_k.sube_id, v_sinif, p_kullanici,
          case when p_gorunurluk = 'sinif' and v_sinif is null then 'sube' else p_gorunurluk end,
          p_ders, p_kazanim, p_metin, p_gorsel_yol, p_gorsel_metin)
  returning id into v_id;
  update public.ogrenci_ilerleme set topluluk_soru = topluluk_soru + 1 where kullanici_id = p_kullanici;
  return v_id;
end;
$$;

/** Akış: görünür sorular, en yeni önce. p_filtre: hepsi | acik | benim | cevapladiklarim */
create or replace function public.sistem_topluluk_akis(p_kullanici uuid, p_filtre text, p_ders uuid, p_once timestamptz, p_limit integer default 20)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x.olusturma desc), '[]'::jsonb) from (
    select s.id, s.metin, s.gorsel_yol is not null as gorselli, s.durum, s.gorunurluk, s.olusturma,
      d.ad as ders, d.kod as ders_kod, kz.kod as kazanim_kod,
      k.takma_ad::text as soran, s.soran_id = p_kullanici as benim,
      (select count(*) from public.topluluk_cevap c where c.soru_id = s.id and not c.gizli) as cevap_sayisi,
      exists (select 1 from public.topluluk_cevap c where c.soru_id = s.id and c.cevaplayan_id = p_kullanici) as cevapladim,
      s.ai_ipucu is not null as ipuclu
    from public.topluluk_soru s
    join public.ders d on d.id = s.ders_id
    left join public.kazanim kz on kz.id = s.kazanim_id
    join public.kullanici k on k.id = s.soran_id
    where app.topluluk_gorebilir(p_kullanici, s)
      and s.durum <> 'gizli'
      and (p_ders is null or s.ders_id = p_ders)
      and (p_once is null or s.olusturma < p_once)
      and case p_filtre
        when 'acik' then s.durum = 'acik'
        when 'benim' then s.soran_id = p_kullanici
        when 'cevapladiklarim' then exists (select 1 from public.topluluk_cevap c where c.soru_id = s.id and c.cevaplayan_id = p_kullanici)
        else true end
    order by s.olusturma desc
    limit least(p_limit, 50)
  ) x
$$;

create or replace function public.sistem_topluluk_detay(p_kullanici uuid, p_soru uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_s public.topluluk_soru;
begin
  select * into v_s from public.topluluk_soru where id = p_soru;
  if not found or not app.topluluk_gorebilir(p_kullanici, v_s) then raise exception 'topluluk.bulunamadi'; end if;
  return jsonb_build_object(
    'id', v_s.id, 'metin', v_s.metin, 'gorsel_yol', v_s.gorsel_yol, 'durum', v_s.durum, 'gorunurluk', v_s.gorunurluk,
    'olusturma', v_s.olusturma, 'benim', v_s.soran_id = p_kullanici,
    'soran', (select takma_ad::text from public.kullanici where id = v_s.soran_id),
    'ders', (select ad from public.ders where id = v_s.ders_id),
    'kazanim', (select jsonb_build_object('kod', kod, 'aciklama', aciklama) from public.kazanim where id = v_s.kazanim_id),
    'ai_ipucu', v_s.ai_ipucu, 'ai_cozum', v_s.ai_cozum,
    'cevaplar', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'sik', c.sik, 'aciklama', c.aciklama, 'gorsel_yol', c.gorsel_yol, 'olusturma', c.olusturma,
        'cevaplayan', k.takma_ad::text, 'benim', c.cevaplayan_id = p_kullanici,
        'ai_durum', c.ai_durum, 'ai_dogru', c.ai_dogru, 'ai_aciklama_yeterli', c.ai_aciklama_yeterli,
        'kabul', c.kabul, 'ornek_cozum', c.ornek_cozum, 'xp', c.xp,
        'mentor', (select count(*) >= 10 from public.topluluk_cevap c2
                   join public.topluluk_soru s2 on s2.id = c2.soru_id
                   join public.beceri b on b.kullanici_id = c2.cevaplayan_id and b.kazanim_id = s2.kazanim_id and b.ustalik = 'altin'
                   where c2.cevaplayan_id = c.cevaplayan_id and c2.kabul is not null))
        order by (c.kabul is not null) desc, c.olusturma)
      from public.topluluk_cevap c join public.kullanici k on k.id = c.cevaplayan_id
      where c.soru_id = v_s.id and (not c.gizli or c.cevaplayan_id = p_kullanici)), '[]'::jsonb)
  );
end;
$$;

create or replace function public.sistem_topluluk_cevapla(p_kullanici uuid, p_soru uuid, p_sik text, p_aciklama text, p_gorsel_yol text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_s public.topluluk_soru;
  v_id uuid;
begin
  select * into v_s from public.topluluk_soru where id = p_soru;
  if not found or not app.topluluk_gorebilir(p_kullanici, v_s) then raise exception 'topluluk.bulunamadi'; end if;
  if v_s.soran_id = p_kullanici then raise exception 'topluluk.kendiSorun'; end if;
  if v_s.durum <> 'acik' then raise exception 'topluluk.kapali'; end if;
  if not exists (select 1 from public.kullanici where id = p_kullanici and tur = 'ogrenci') then raise exception 'topluluk.yetkisiz'; end if;
  insert into public.topluluk_cevap (soru_id, dershane_id, cevaplayan_id, sik, aciklama, gorsel_yol)
  values (p_soru, v_s.dershane_id, p_kullanici, nullif(p_sik, ''), p_aciklama, p_gorsel_yol)
  returning id into v_id;
  return v_id;
exception when unique_violation then
  raise exception 'topluluk.zatenCevapladin';
end;
$$;

create or replace function public.sistem_topluluk_ai_sonuc(p_cevap uuid, p_dogru boolean, p_yeterli boolean, p_not text, p_hata boolean)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.topluluk_cevap set
    ai_durum = case when p_hata then 'hata' else 'tamam' end,
    ai_dogru = p_dogru, ai_aciklama_yeterli = p_yeterli, ai_not = left(p_not, 300)
  where id = p_cevap
$$;

/**
 * Kabul: soran ("Bu cevap çözdü") ya da öğretmen (her zaman üstün; örnek çözüm işaretleyebilir).
 * İlk kabul edilen doğru cevap 50 XP + 20 Altın, sonrakiler 20 XP. Günlük topluluk XP sınırı.
 * Puan döngüsü (iki hesap 7 günde karşılıklı ≥3 kabul) → puan dondurulur, öğretmene düşer.
 */
create or replace function public.sistem_topluluk_kabul(
  p_kabul_eden uuid, p_cevap uuid, p_kim text, p_ornek boolean,
  p_ilk_xp integer, p_ilk_altin integer, p_sonraki_xp integer, p_gunluk_xp integer, p_soran_xp integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.topluluk_cevap;
  v_s public.topluluk_soru;
  v_ilk boolean;
  v_xp integer;
  v_altin integer;
  v_bugun integer;
  v_dongu boolean;
  v_ozellik text;
begin
  select * into v_c from public.topluluk_cevap where id = p_cevap for update;
  if not found then raise exception 'topluluk.bulunamadi'; end if;
  select * into v_s from public.topluluk_soru where id = v_c.soru_id for update;
  if p_kim = 'soran' and v_s.soran_id <> p_kabul_eden then raise exception 'topluluk.yetkisiz'; end if;
  if p_kim = 'ogretmen' and not exists (
    select 1 from public.kullanici_rol r where r.kullanici_id = p_kabul_eden and r.dershane_id = v_s.dershane_id
      and r.rol_kod in ('kurucu', 'sube_muduru', 'ogretmen'))
  then raise exception 'topluluk.yetkisiz'; end if;
  if v_c.gizli then raise exception 'topluluk.bulunamadi'; end if;

  if v_c.kabul is not null then
    -- Öğretmen sonradan "örnek çözüm" işaretleyebilir / soran kabulünü onaylayabilir
    if p_kim = 'ogretmen' then
      update public.topluluk_cevap set kabul = 'ogretmen', ornek_cozum = ornek_cozum or coalesce(p_ornek, false) where id = p_cevap;
    end if;
    return jsonb_build_object('xp', 0, 'altin', 0, 'zaten', true);
  end if;

  v_ilk := not exists (select 1 from public.topluluk_cevap where soru_id = v_s.id and kabul is not null);
  v_xp := case when v_ilk then p_ilk_xp else p_sonraki_xp end;
  v_altin := case when v_ilk then p_ilk_altin else 0 end;

  -- Günlük sınır
  select coalesce(sum(xp), 0) into v_bugun from public.topluluk_cevap
  where cevaplayan_id = v_c.cevaplayan_id and kabul_zamani >= (app.bugun()::timestamp at time zone 'Europe/Istanbul');
  v_xp := greatest(0, least(v_xp, p_gunluk_xp - v_bugun));

  -- Puan döngüsü: soran kabul ettiyse ve iki hesap karşılıklı ≥3 kabul
  v_dongu := p_kim = 'soran' and (
    select count(*) from public.topluluk_cevap c join public.topluluk_soru s on s.id = c.soru_id
    where c.cevaplayan_id = v_c.cevaplayan_id and s.soran_id = v_s.soran_id and c.kabul = 'soran' and c.kabul_zamani > now() - interval '7 days') >= 2
    and (
    select count(*) from public.topluluk_cevap c join public.topluluk_soru s on s.id = c.soru_id
    where c.cevaplayan_id = v_s.soran_id and s.soran_id = v_c.cevaplayan_id and c.kabul = 'soran' and c.kabul_zamani > now() - interval '7 days') >= 3;
  if v_dongu then v_xp := 0; v_altin := 0; end if;

  update public.topluluk_cevap set kabul = p_kim, kabul_zamani = now(), ornek_cozum = coalesce(p_ornek, false) and p_kim = 'ogretmen',
    xp = v_xp, altin = v_altin, puan_donduruldu = v_dongu
  where id = p_cevap;
  update public.topluluk_soru set durum = 'cozuldu', ogretmen_bekliyor = false where id = v_s.id;

  if v_xp > 0 or v_altin > 0 then
    perform app.odul_ver(v_c.cevaplayan_id, v_xp, v_altin);
  end if;
  if not v_dongu then
    -- Özellik (dersin) ve klan katkısı
    select d.ozellik into v_ozellik from public.ders d where d.id = v_s.ders_id;
    update public.ogrenci_ilerleme set topluluk_kabul = topluluk_kabul + 1,
      ozellik_puanlari = jsonb_set(coalesce(ozellik_puanlari, '{}'::jsonb), array[v_ozellik],
        to_jsonb(coalesce((ozellik_puanlari ->> v_ozellik)::integer, 0) + 1))
    where kullanici_id = v_c.cevaplayan_id;
    perform public.sistem_klan_katki(jsonb_build_object('kullanici_id', v_c.cevaplayan_id, 'dogru', false));
    -- Net ve çözülebilir soru soran küçük XP alır (bir kez)
    if not v_s.soran_odul then
      perform app.odul_ver(v_s.soran_id, p_soran_xp, 0);
      update public.topluluk_soru set soran_odul = true where id = v_s.id;
    end if;
  end if;
  return jsonb_build_object('xp', v_xp, 'altin', v_altin, 'ilk', v_ilk, 'donduruldu', v_dongu, 'cevaplayan_id', v_c.cevaplayan_id);
end;
$$;

/** 15 dk cevapsız → ipucu; 2 saat kabulsüz → tam çözüm + öğretmen bekleyenleri. */
create or replace function public.sistem_topluluk_ai_bekleyenler(p_ipucu_dk integer, p_cozum_dk integer, p_limit integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select s.id, s.dershane_id, s.metin, s.gorsel_metin, d.ad as ders, kz.aciklama as kazanim,
      case when s.ai_cozum is null and s.olusturma < now() - make_interval(mins => p_cozum_dk) then 'cozum' else 'ipucu' end as tur
    from public.topluluk_soru s join public.ders d on d.id = s.ders_id left join public.kazanim kz on kz.id = s.kazanim_id
    where s.durum = 'acik' and s.olusturma > now() - interval '7 days' and (
      (s.ai_cozum is null and s.olusturma < now() - make_interval(mins => p_cozum_dk))
      or (s.ai_ipucu is null and s.olusturma < now() - make_interval(mins => p_ipucu_dk)
          and not exists (select 1 from public.topluluk_cevap c where c.soru_id = s.id and not c.gizli)))
    order by s.olusturma
    limit p_limit
  ) x
$$;

create or replace function public.sistem_topluluk_ai_yaz(p_soru uuid, p_tur text, p_metin text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.topluluk_soru set
    ai_ipucu = case when p_tur = 'ipucu' then left(p_metin, 1500) else ai_ipucu end,
    ai_ipucu_zamani = case when p_tur = 'ipucu' then now() else ai_ipucu_zamani end,
    ai_cozum = case when p_tur = 'cozum' then left(p_metin, 4000) else ai_cozum end,
    ai_cozum_zamani = case when p_tur = 'cozum' then now() else ai_cozum_zamani end,
    ogretmen_bekliyor = ogretmen_bekliyor or p_tur = 'cozum'
  where id = p_soru
$$;

-- Şikâyet: topluluk hedefleri (3 şikâyette gizle; kendi içeriğini şikâyet edemez)
create or replace function public.sistem_sikayet(p_kullanici uuid, p_hedef_tur text, p_hedef_id text, p_sebep text, p_aciklama text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_d uuid;
  v_m public.klan_mesaj;
  v_s public.topluluk_soru;
  v_c public.topluluk_cevap;
  v_sayi integer;
begin
  select dershane_id into v_d from public.kullanici where id = p_kullanici;
  if p_hedef_tur = 'klan_mesaj' then
    select m.* into v_m from public.klan_mesaj m
    join public.klan_uyelik u on u.klan_id = m.klan_id and u.kullanici_id = p_kullanici
    where m.id = p_hedef_id::bigint;
    if not found or v_m.kullanici_id = p_kullanici then raise exception 'sikayet.gecersiz'; end if;
  elsif p_hedef_tur = 'klan' then
    if not exists (select 1 from public.klan where id = p_hedef_id::uuid and dershane_id = v_d) then raise exception 'sikayet.gecersiz'; end if;
  elsif p_hedef_tur = 'topluluk_soru' then
    select * into v_s from public.topluluk_soru where id = p_hedef_id::uuid;
    if not found or not app.topluluk_gorebilir(p_kullanici, v_s) or v_s.soran_id = p_kullanici then raise exception 'sikayet.gecersiz'; end if;
  elsif p_hedef_tur = 'topluluk_cevap' then
    select * into v_c from public.topluluk_cevap where id = p_hedef_id::uuid;
    if not found or v_c.cevaplayan_id = p_kullanici then raise exception 'sikayet.gecersiz'; end if;
    select * into v_s from public.topluluk_soru where id = v_c.soru_id;
    if not app.topluluk_gorebilir(p_kullanici, v_s) then raise exception 'sikayet.gecersiz'; end if;
  else
    raise exception 'sikayet.gecersiz';
  end if;
  insert into public.sikayet (dershane_id, sikayet_eden, hedef_tur, hedef_id, sebep, aciklama, oncelikli)
  values (v_d, p_kullanici, p_hedef_tur, p_hedef_id, p_sebep, left(p_aciklama, 500), p_sebep = 'zorbalik')
  on conflict do nothing;
  select count(*) into v_sayi from public.sikayet where hedef_tur = p_hedef_tur and hedef_id = p_hedef_id and durum = 'acik';
  if v_sayi >= 3 then
    if p_hedef_tur = 'klan_mesaj' then update public.klan_mesaj set gizli = true where id = p_hedef_id::bigint;
    elsif p_hedef_tur = 'topluluk_soru' then update public.topluluk_soru set durum = 'gizli' where id = p_hedef_id::uuid;
    elsif p_hedef_tur = 'topluluk_cevap' then update public.topluluk_cevap set gizli = true where id = p_hedef_id::uuid;
    end if;
  end if;
end;
$$;

-- ── Asistan ──

/** Günlük sayaçlar (İstanbul günü): öğrenci mesajı ve fotoğraf oturumu */
create or replace function public.sistem_asistan_kullanim(p_kullanici uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'mesaj', (select count(*) from public.asistan_mesaj where kullanici_id = p_kullanici and rol = 'ogrenci'
              and olusturma >= (app.bugun()::timestamp at time zone 'Europe/Istanbul')),
    'fotograf', (select count(*) from public.asistan_oturum where kullanici_id = p_kullanici and tur = 'fotograf'
              and olusturma >= (app.bugun()::timestamp at time zone 'Europe/Istanbul'))
  )
$$;

/** Soru oturumu: yalnız cevaplanmış (düello/klan/deneme dışı) bir soru için. */
create or replace function public.sistem_asistan_soru_oturumu(p_kullanici uuid, p_soru uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from public.cevap c where c.kullanici_id = p_kullanici and c.soru_id = p_soru and c.baglam in ('antrenman', 'tespit', 'tekrar', 'odev'))
  then raise exception 'asistan.soruUygunDegil'; end if;
  select id into v_id from public.asistan_oturum
  where kullanici_id = p_kullanici and soru_id = p_soru and tur = 'soru' and olusturma > now() - interval '1 day'
  order by olusturma desc limit 1;
  if v_id is null then
    insert into public.asistan_oturum (kullanici_id, dershane_id, tur, soru_id)
    select p_kullanici, dershane_id, 'soru', p_soru from public.kullanici where id = p_kullanici
    returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.sistem_asistan_fotograf_oturumu(p_kullanici uuid, p_fotograf jsonb)
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.asistan_oturum (kullanici_id, dershane_id, tur, fotograf)
  select p_kullanici, dershane_id, 'fotograf', p_fotograf from public.kullanici where id = p_kullanici
  returning id
$$;

create or replace function public.sistem_asistan_mesaj_ekle(p_oturum uuid, p_kullanici uuid, p_rol text, p_icerik text, p_destek boolean, p_ipucu smallint)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if not exists (select 1 from public.asistan_oturum where id = p_oturum and kullanici_id = p_kullanici) then raise exception 'asistan.oturumYok'; end if;
  insert into public.asistan_mesaj (oturum_id, kullanici_id, rol, icerik, destek) values (p_oturum, p_kullanici, p_rol, left(p_icerik, 6000), p_destek)
  returning id into v_id;
  if p_ipucu is not null then update public.asistan_oturum set ipucu_seviyesi = greatest(ipucu_seviyesi, p_ipucu) where id = p_oturum; end if;
  return v_id;
end;
$$;

create or replace function public.sistem_rehberlik_bildir(p_kullanici uuid, p_kaynak text, p_ozet text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.rehberlik_bildirim (dershane_id, kullanici_id, kaynak, ozet)
  select dershane_id, p_kullanici, p_kaynak, left(p_ozet, 300) from public.kullanici where id = p_kullanici
    -- Aynı öğrenci için 1 saatte bir bildirim yeter
    and not exists (select 1 from public.rehberlik_bildirim b where b.kullanici_id = p_kullanici and b.olusturma > now() - interval '1 hour')
$$;

/** Saklama: asistan sohbetleri 180 gün */
create or replace function public.sistem_asistan_temizle()
returns integer
language sql
security definer
set search_path = ''
as $$
  with s as (delete from public.asistan_oturum where olusturma < now() - interval '180 days' returning 1)
  select count(*)::integer from s
$$;

-- Rozet metrikleri: topluluk
create or replace function public.sistem_oyun_metrikleri(p_kullanici uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'toplam_cevap', coalesce(i.toplam_cevap, 0),
    'toplam_dogru', coalesce(i.toplam_dogru, 0),
    'seviye', coalesce(i.seviye, 1),
    'seri_gun', coalesce(i.seri_gun, 0),
    'en_uzun_seri', coalesce(i.en_uzun_seri, 0),
    'max_ardisik', coalesce(i.max_ardisik, 0),
    'sabah_cozum', coalesce(i.sabah_cozum, 0),
    'zor_dogru', coalesce(i.zor_dogru, 0),
    'ipucusuz_dogru', coalesce(i.ipucusuz_dogru, 0),
    'temizlenen_hata', coalesce(i.temizlenen_hata, 0),
    'gorev_tamamlanan', coalesce(i.gorev_tamamlanan, 0),
    'haftalik_gorev_tamamlanan', coalesce(i.haftalik_gorev_tamamlanan, 0),
    'lig_yukselme', coalesce(i.lig_yukselme, 0),
    'en_iyi_lig_adim', coalesce(i.en_iyi_lig_adim, 1),
    'duello_galibiyet', coalesce(i.duello_galibiyet, 0),
    'en_uzun_duello_seri', coalesce(i.en_uzun_duello_seri, 0),
    'klan_uyesi', case when exists (select 1 from public.klan_uyelik u where u.kullanici_id = p_kullanici) then 1 else 0 end,
    'boss_hasar_max', coalesce((select max(h.hasar) from public.boss_hasar h where h.kullanici_id = p_kullanici), 0),
    'klan_savas_galibiyet', coalesce(i.klan_savas_galibiyet, 0),
    'topluluk_kabul', coalesce(i.topluluk_kabul, 0),
    'topluluk_ornek', (select count(*) from public.topluluk_cevap c where c.cevaplayan_id = p_kullanici and c.ornek_cozum),
    'ozellik_min', coalesce((select min(coalesce((i.ozellik_puanlari ->> o)::integer, 0))
                             from unnest(array['zeka', 'enerji', 'bilgelik', 'strateji', 'ceviklik']) o), 0),
    'bronz_ustu', (select count(*) from public.beceri b where b.kullanici_id = p_kullanici and b.ustalik in ('bronz', 'gumus', 'altin')),
    'gumus_ustu', (select count(*) from public.beceri b where b.kullanici_id = p_kullanici and b.ustalik in ('gumus', 'altin')),
    'altin', (select count(*) from public.beceri b where b.kullanici_id = p_kullanici and b.ustalik = 'altin'),
    'acik_hata', (select count(*) from public.hata_defteri h where h.kullanici_id = p_kullanici and h.durum = 'acik'),
    'tespit_biten', (select count(*) from public.tespit_oturumu t where t.kullanici_id = p_kullanici and t.bitis is not null),
    'ders_sayisi', (select count(*) from public.sistem_ogrenci_dersleri(p_kullanici)),
    'tam_set', exists (
      select 1 from public.sistem_ogrenci_dersleri(p_kullanici) d
      where not exists (
        select 1 from public.kazanim k join public.unite u on u.id = k.unite_id
        left join public.beceri b on b.kazanim_id = k.id and b.kullanici_id = p_kullanici
        where u.ders_id = d.id and coalesce(b.ustalik, 'kesfedilmedi') = 'kesfedilmedi')),
    'envanter', (select count(*) from public.envanter e where e.kullanici_id = p_kullanici)
  )
  from (select 1) x
  left join public.ogrenci_ilerleme i on i.kullanici_id = p_kullanici
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'public.sistem_topluluk_sor(uuid, uuid, uuid, text, text, text, text, integer)',
    'public.sistem_topluluk_akis(uuid, text, uuid, timestamptz, integer)',
    'public.sistem_topluluk_detay(uuid, uuid)',
    'public.sistem_topluluk_cevapla(uuid, uuid, text, text, text)',
    'public.sistem_topluluk_ai_sonuc(uuid, boolean, boolean, text, boolean)',
    'public.sistem_topluluk_kabul(uuid, uuid, text, boolean, integer, integer, integer, integer, integer)',
    'public.sistem_topluluk_ai_bekleyenler(integer, integer, integer)',
    'public.sistem_topluluk_ai_yaz(uuid, text, text)',
    'public.sistem_sikayet(uuid, text, text, text, text)',
    'public.sistem_asistan_kullanim(uuid)',
    'public.sistem_asistan_soru_oturumu(uuid, uuid)',
    'public.sistem_asistan_fotograf_oturumu(uuid, jsonb)',
    'public.sistem_asistan_mesaj_ekle(uuid, uuid, text, text, boolean, smallint)',
    'public.sistem_rehberlik_bildir(uuid, text, text)',
    'public.sistem_asistan_temizle()',
    'public.sistem_oyun_metrikleri(uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
