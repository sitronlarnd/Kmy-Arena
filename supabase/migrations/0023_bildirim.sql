-- ─────────────────────────────────────────────────────────────
-- 0023 · Bildirimler: Expo push jetonları, bildirim kuyruğu, sessiz saatler,
--        veliye haftalık özet e-postası için veri fonksiyonu.
--  • Olaylar (düello daveti, ödev, topluluk cevabı/kabulü) tetikleyicilerle
--    kuyruğa yazılır; API'nin "bildirim-gonder" işi kuyruğu Expo'ya iletir.
--  • Sessiz saat (varsayılan 22:00–08:00, Türkiye saati) içinde gönderilmez,
--    saat bitince gönderilir; 12 saatten eski bildirim atılır.
-- ─────────────────────────────────────────────────────────────

alter table public.kullanici
  add column bildirim_acik boolean not null default true,
  add column sessiz_baslangic smallint not null default 22 check (sessiz_baslangic between 0 and 23),
  add column sessiz_bitis smallint not null default 8 check (sessiz_bitis between 0 and 23),
  add column veli_eposta_acik boolean not null default true;

create table public.bildirim_cihaz (
  token text primary key check (token ~ '^(Exponent|Expo)PushToken\[.+\]$'),
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  olusturma timestamptz not null default now(),
  son_gorulme timestamptz not null default now()
);
create index bildirim_cihaz_kullanici on public.bildirim_cihaz (kullanici_id);
alter table public.bildirim_cihaz enable row level security;
-- Yalnız servis erişir; istemci jetonu API üzerinden kaydeder.

create table public.bildirim_kuyruk (
  id bigint generated always as identity primary key,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  tur text not null check (tur in ('duello_davet', 'odev', 'topluluk_cevap', 'topluluk_kabul', 'seri', 'klan_savas', 'duyuru')),
  baslik text not null check (char_length(baslik) <= 80),
  govde text not null check (char_length(govde) <= 200),
  veri jsonb not null default '{}',
  olusturma timestamptz not null default now(),
  gonderildi timestamptz,
  sonuc text
);
create index bildirim_kuyruk_bekleyen on public.bildirim_kuyruk (olusturma) where gonderildi is null;
alter table public.bildirim_kuyruk enable row level security;

create or replace function app.bildirim_ekle(p_kullanici uuid, p_tur text, p_baslik text, p_govde text, p_veri jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.bildirim_kuyruk (kullanici_id, tur, baslik, govde, veri)
  select p_kullanici, p_tur, left(p_baslik, 80), left(p_govde, 200), p_veri
  from public.kullanici k where k.id = p_kullanici and k.bildirim_acik and k.silinme_talebi is null
$$;

-- Düello daveti (arkadaş düellosu b'ye davet olarak açılınca)
create or replace function app.tg_duello_bildirim() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.mod = 'arkadas' and new.b is not null and new.durum in ('davet', 'oynaniyor')
     and (tg_op = 'INSERT' or old.b is distinct from new.b) then
    perform app.bildirim_ekle(new.b, 'duello_davet', 'Düello daveti',
      app.gorunen_ad(new.a) || ' seni 5 soruluk düelloya çağırıyor!', jsonb_build_object('yol', '/duello/' || new.id));
  end if;
  return new;
end $$;
create trigger duello_bildirim after insert or update of b on public.duello
  for each row execute function app.tg_duello_bildirim();

-- Yeni ödev
create or replace function app.tg_odev_bildirim() returns trigger
language plpgsql security definer set search_path = '' as $$
declare o public.odev;
begin
  select * into o from public.odev where id = new.odev_id;
  perform app.bildirim_ekle(new.kullanici_id, 'odev', 'Yeni ödev: ' || left(o.baslik, 60),
    o.soru_sayisi || ' soru · son gün ' || to_char(o.son_tarih at time zone 'Europe/Istanbul', 'DD.MM HH24:MI'),
    jsonb_build_object('yol', '/'));
  return new;
end $$;
create trigger odev_bildirim after insert on public.odev_atama
  for each row execute function app.tg_odev_bildirim();

-- Topluluk: soruna cevap geldi / cevabın kabul edildi
create or replace function app.tg_topluluk_bildirim() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_soran uuid;
begin
  select soran_id into v_soran from public.topluluk_soru where id = new.soru_id;
  if tg_op = 'INSERT' and v_soran is distinct from new.cevaplayan_id then
    perform app.bildirim_ekle(v_soran, 'topluluk_cevap', 'Soruna cevap geldi',
      app.gorunen_ad(new.cevaplayan_id) || ' soruna bir çözüm yazdı.', jsonb_build_object('yol', '/topluluk/' || new.soru_id));
  elsif tg_op = 'UPDATE' and new.kabul is not null and old.kabul is null then
    perform app.bildirim_ekle(new.cevaplayan_id, 'topluluk_kabul', 'Cevabın kabul edildi',
      'Topluluktaki çözümün doğru kabul edildi, ödülün hesabında!', jsonb_build_object('yol', '/topluluk/' || new.soru_id));
  end if;
  return new;
end $$;
create trigger topluluk_bildirim after insert or update of kabul on public.topluluk_cevap
  for each row execute function app.tg_topluluk_bildirim();

-- ── Servis fonksiyonları ──

create or replace function public.sistem_bildirim_cihaz(p_kullanici uuid, p_token text, p_platform text, p_sil boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_sil then
    delete from public.bildirim_cihaz where token = p_token and kullanici_id = p_kullanici;
    return;
  end if;
  insert into public.bildirim_cihaz (token, kullanici_id, dershane_id, platform)
  select p_token, k.id, k.dershane_id, p_platform from public.kullanici k where k.id = p_kullanici and k.dershane_id is not null
  on conflict (token) do update set kullanici_id = excluded.kullanici_id, dershane_id = excluded.dershane_id,
                                    platform = excluded.platform, son_gorulme = now();
end $$;

create or replace function public.sistem_bildirim_tercih(p_kullanici uuid, p_acik boolean, p_bas smallint, p_bit smallint, p_veli_eposta boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  update public.kullanici set
    bildirim_acik = coalesce(p_acik, bildirim_acik),
    sessiz_baslangic = coalesce(p_bas, sessiz_baslangic),
    sessiz_bitis = coalesce(p_bit, sessiz_bitis),
    veli_eposta_acik = coalesce(p_veli_eposta, veli_eposta_acik)
  where id = p_kullanici
  returning jsonb_build_object('acik', bildirim_acik, 'sessizBaslangic', sessiz_baslangic, 'sessizBitis', sessiz_bitis, 'veliEposta', veli_eposta_acik) into r;
  return r;
end $$;

/** Gönderilecekler: sessiz saatte olmayan kullanıcıların bekleyen bildirimleri ve cihaz jetonları. */
create or replace function public.sistem_bildirim_bekleyenler(p_limit integer default 500)
returns table (id bigint, kullanici_id uuid, baslik text, govde text, veri jsonb, tokenlar text[])
language plpgsql security definer set search_path = '' as $$
declare v_saat integer := extract(hour from now() at time zone 'Europe/Istanbul');
begin
  -- 12 saatten eski olanlar atılır (bayat bildirim gönderme)
  update public.bildirim_kuyruk set gonderildi = now(), sonuc = 'bayat'
  where gonderildi is null and olusturma < now() - interval '12 hours';
  -- Cihazı olmayanlar sessizce kapanır
  update public.bildirim_kuyruk q set gonderildi = now(), sonuc = 'cihaz_yok'
  where q.gonderildi is null and not exists (select 1 from public.bildirim_cihaz c where c.kullanici_id = q.kullanici_id);
  return query
  select q.id, q.kullanici_id, q.baslik, q.govde, q.veri,
         (select array_agg(c.token) from public.bildirim_cihaz c where c.kullanici_id = q.kullanici_id)
  from public.bildirim_kuyruk q
  join public.kullanici k on k.id = q.kullanici_id
  where q.gonderildi is null and k.bildirim_acik
    and not (case when k.sessiz_baslangic > k.sessiz_bitis
                  then v_saat >= k.sessiz_baslangic or v_saat < k.sessiz_bitis
                  else v_saat >= k.sessiz_baslangic and v_saat < k.sessiz_bitis end)
  order by q.id
  limit p_limit;
end $$;

create or replace function public.sistem_bildirim_isaretle(p_idler bigint[], p_sonuc text, p_gecersiz text[] default '{}')
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.bildirim_kuyruk set gonderildi = now(), sonuc = left(p_sonuc, 200) where id = any (p_idler);
  delete from public.bildirim_cihaz where token = any (p_gecersiz);
end $$;

/** Akşam seri hatırlatması: bugün hedefini tamamlamamış, serisi olan öğrenciler. */
create or replace function public.sistem_seri_hatirlat() returns integer
language plpgsql security definer set search_path = '' as $$
declare v_bugun date := (now() at time zone 'Europe/Istanbul')::date; n integer;
begin
  with h as (
    select i.kullanici_id, i.seri_gun
    from public.ogrenci_ilerleme i
    join public.kullanici k on k.id = i.kullanici_id and k.tur = 'ogrenci' and k.silinme_talebi is null and k.bildirim_acik
    where i.seri_gun >= 2 and i.seri_son_gun = v_bugun - 1
      and exists (select 1 from public.bildirim_cihaz c where c.kullanici_id = i.kullanici_id)
      and not exists (select 1 from public.bildirim_kuyruk q where q.kullanici_id = i.kullanici_id and q.tur = 'seri' and q.olusturma > now() - interval '20 hours')
  )
  insert into public.bildirim_kuyruk (kullanici_id, tur, baslik, govde, veri)
  select kullanici_id, 'seri', seri_gun || ' günlük serin tehlikede!', 'Bugünkü hedefini tamamla, serin bozulmasın.', '{"yol":"/"}'
  from h;
  get diagnostics n = row_count;
  return n;
end $$;

/** Veliye haftalık özet: e-postası olan, tercihi açık velilerin çocuklarının son 7 günü. */
create or replace function public.sistem_veli_haftalik()
returns table (veli_id uuid, eposta text, veli_ad text, dershane text, cocuklar jsonb)
language sql security definer set search_path = '' as $$
  select v.id, u.email::text, v.ad, d.coalesce_ad,
         jsonb_agg(jsonb_build_object(
           'ad', o.ad,
           'soru', (select count(*) from public.cevap c where c.kullanici_id = o.id and c.olusturma > now() - interval '7 days'),
           'dogru', (select count(*) from public.cevap c where c.kullanici_id = o.id and c.dogru_mu and c.olusturma > now() - interval '7 days'),
           'gun', (select count(distinct (c.olusturma at time zone 'Europe/Istanbul')::date) from public.cevap c where c.kullanici_id = o.id and c.olusturma > now() - interval '7 days'),
           'dakika', (select coalesce(sum(least(c.sure_ms, 300000)), 0) / 60000 from public.cevap c where c.kullanici_id = o.id and c.olusturma > now() - interval '7 days'),
           'seri', coalesce((select seri_gun from public.ogrenci_ilerleme where kullanici_id = o.id), 0),
           'odev_biten', (select count(*) from public.odev_atama a where a.kullanici_id = o.id and a.bitis > now() - interval '7 days'),
           'odev_bekleyen', (select count(*) from public.odev_atama a join public.odev od on od.id = a.odev_id where a.kullanici_id = o.id and a.bitis is null and od.son_tarih > now())
         ) order by o.ad)
  from public.kullanici v
  join auth.users u on u.id = v.id and u.email is not null
  join lateral (select coalesce(nullif(x.uygulama_ici_ad, ''), x.ad) as coalesce_ad from public.dershane x where x.id = v.dershane_id) d on true
  join public.veli_bag b on b.veli_id = v.id and b.onay_tarihi is not null
  join public.kullanici o on o.id = b.ogrenci_id and o.silinme_talebi is null
  where v.tur = 'veli' and v.veli_eposta_acik and v.silinme_talebi is null
  group by v.id, u.email, v.ad, d.coalesce_ad
$$;

revoke all on function public.sistem_bildirim_cihaz(uuid, text, text, boolean), public.sistem_bildirim_tercih(uuid, boolean, smallint, smallint, boolean),
  public.sistem_bildirim_bekleyenler(integer), public.sistem_bildirim_isaretle(bigint[], text, text[]),
  public.sistem_seri_hatirlat(), public.sistem_veli_haftalik() from public, anon, authenticated;
grant execute on function public.sistem_bildirim_cihaz(uuid, text, text, boolean), public.sistem_bildirim_tercih(uuid, boolean, smallint, smallint, boolean),
  public.sistem_bildirim_bekleyenler(integer), public.sistem_bildirim_isaretle(bigint[], text, text[]),
  public.sistem_seri_hatirlat(), public.sistem_veli_haftalik() to service_role;
revoke all on function app.bildirim_ekle(uuid, text, text, text, jsonb) from public, anon, authenticated;
