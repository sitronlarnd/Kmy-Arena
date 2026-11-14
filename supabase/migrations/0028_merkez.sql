-- ─────────────────────────────────────────────────────────────
-- 0028 · Merkez yönetim paneli
--  • Genel bakış: KPI'lar, MRR (dershane.aylik_ucret), KMYAI maliyeti
--    (model_fiyat × token), brüt marj, dershane sağlık skoru.
--  • Fatura ve ödeme takibi; 15 gün gecikmede uyarı, 30 günde salt okunur.
--  • Destek talepleri (dershane ↔ merkez), merkez duyuruları, e-posta şablonları.
--  • Moderasyon: merkeze iletilen şikâyetler, ek yasaklı kelimeler,
--    hesap kısıtlama (sosyal kapatma / puan dondurma) gerekçeli.
--  • Platform takvimi: çift XP, tematik hafta, sezon, dershaneler arası turnuva.
--  • Sistem: sağlık özeti, uygulama duyurusu; mağaza eşyası ayarları;
--    müfredat panelden düzenlenen kazanımlar tohumla ezilmez.
--  • "Dershane olarak görüntüle" oturumları (dershane panelinde bant).
-- ─────────────────────────────────────────────────────────────

alter table public.dershane add column aylik_ucret numeric(10, 2) check (aylik_ucret is null or aylik_ucret >= 0);
alter table public.kazanim add column panel_duzenleme boolean not null default false;
alter table public.uygulama_ayari add column duyuru text check (duyuru is null or char_length(duyuru) <= 300);
alter table public.sikayet add column merkeze_ilet boolean not null default false, add column merkez_notu text;
alter table public.kullanici
  add column sosyal_kisit_bitis timestamptz,
  add column puan_donduruldu boolean not null default false,
  add column kisit_gerekce text check (kisit_gerekce is null or char_length(kisit_gerekce) <= 500);

-- ── Maliyet ──
create table public.model_fiyat (
  model text primary key,
  giris_1m numeric(10, 4) not null default 0,   -- 1M giriş token başına USD
  cikis_1m numeric(10, 4) not null default 0,
  guncelleme timestamptz not null default now()
);
insert into public.model_fiyat (model) values ('mimo-v2.6-flash'), ('gpt-6-luna'), ('claude-haiku-5-5'), ('claude-haiku-4-5') on conflict do nothing;
alter table public.model_fiyat enable row level security;

create or replace function app.ai_maliyet(p_bas timestamptz, p_bit timestamptz, p_dershane uuid default null)
returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(l.token_giris * coalesce(f.giris_1m, 0) / 1e6 + l.token_cikis * coalesce(f.cikis_1m, 0) / 1e6), 0)
  from public.ai_cagri_log l left join public.model_fiyat f on f.model = l.model
  where l.olusturma >= p_bas and l.olusturma < p_bit and (p_dershane is null or l.dershane_id = p_dershane)
$$;

/** Sağlık skoru (0-100): aktiflik, öğretmen kullanımı, ödeme, destek, lisans bitişi. */
create or replace function app.saglik_skoru(p_dershane uuid) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare v_ogr int; v_aktif int; v_ogt int; v_ogt_aktif int; v_gec int; v_destek int; v_bitis date; p numeric := 0;
begin
  select count(*) into v_ogr from public.kullanici where dershane_id = p_dershane and tur = 'ogrenci' and silinme_talebi is null;
  select count(distinct c.kullanici_id) into v_aktif from public.cevap c where c.dershane_id = p_dershane and c.olusturma > now() - interval '7 days';
  select count(*) into v_ogt from public.kullanici_rol where dershane_id = p_dershane and rol_kod = 'ogretmen';
  select count(distinct olusturan_id) into v_ogt_aktif from public.odev where dershane_id = p_dershane and olusturma > now() - interval '30 days';
  select count(*) into v_gec from public.fatura where dershane_id = p_dershane and durum <> 'odendi' and vade < current_date;
  select count(*) into v_destek from public.destek_talep where dershane_id = p_dershane and durum <> 'kapandi' and olusturma < now() - interval '3 days';
  select lisans_bitis into v_bitis from public.dershane where id = p_dershane;
  p := 40 * least(1, coalesce(v_aktif::numeric / nullif(v_ogr, 0), 0) / 0.6)
     + 20 * least(1, coalesce(v_ogt_aktif::numeric / nullif(v_ogt, 0), 0) / 0.5)
     + 20 * case when v_gec = 0 then 1 when v_gec = 1 then 0.4 else 0 end
     + 10 * case when v_destek = 0 then 1 else 0.3 end
     + 10 * case when v_bitis is null or v_bitis > current_date + 60 then 1 when v_bitis > current_date + 14 then 0.5 else 0 end;
  return round(p)::int;
end $$;

-- ── Faturalar ──
create table public.fatura (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  donem text not null check (donem ~ '^\d{4}-\d{2}$'),
  tutar numeric(10, 2) not null check (tutar >= 0),
  vade date not null,
  durum text not null default 'bekliyor' check (durum in ('bekliyor', 'odendi', 'iptal')),
  odeme_tarihi date,
  aciklama text,
  olusturma timestamptz not null default now(),
  unique (dershane_id, donem)
);
alter table public.fatura enable row level security;
grant select on public.fatura to authenticated;
create policy fatura_oku on public.fatura for select to authenticated using (app.yetkisi_var('dershane.lisans', dershane_id));

/** Günlük: gecikme 15 gün → 'gecikmis' + uyarı; 30 gün → 'askida' (öğrenci uygulaması salt okunur). */
create or replace function public.sistem_lisans_takip() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uyari int; v_askida int;
begin
  with g as (select dershane_id, min(vade) vade from public.fatura where durum = 'bekliyor' and vade < current_date group by dershane_id)
  update public.dershane d set lisans_durumu = 'gecikmis' from g
  where d.id = g.dershane_id and d.lisans_durumu = 'aktif' and g.vade <= current_date - 15;
  get diagnostics v_uyari = row_count;
  with g as (select dershane_id, min(vade) vade from public.fatura where durum = 'bekliyor' and vade < current_date group by dershane_id)
  update public.dershane d set lisans_durumu = 'askida' from g
  where d.id = g.dershane_id and d.lisans_durumu in ('aktif', 'gecikmis') and g.vade <= current_date - 30;
  get diagnostics v_askida = row_count;
  -- Bitiş tarihi geçen pilot / aktif lisans
  update public.dershane set lisans_durumu = 'bitti' where lisans_bitis < current_date - 7 and lisans_durumu in ('pilot');
  return jsonb_build_object('gecikmis', v_uyari, 'askida', v_askida);
end $$;
revoke all on function public.sistem_lisans_takip() from public, anon, authenticated;
grant execute on function public.sistem_lisans_takip() to service_role;

-- ── Destek talepleri ──
create table public.destek_talep (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  acan_id uuid references public.kullanici (id) on delete set null,
  konu text not null check (char_length(konu) between 3 and 120),
  oncelik text not null default 'normal' check (oncelik in ('dusuk', 'normal', 'yuksek', 'acil')),
  durum text not null default 'acik' check (durum in ('acik', 'yanitlandi', 'bekliyor', 'kapandi')),
  atanan_id uuid references public.kullanici (id) on delete set null,
  ilk_yanit timestamptz,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
create table public.destek_mesaj (
  id bigint generated always as identity primary key,
  talep_id uuid not null references public.destek_talep (id) on delete cascade,
  yazan_id uuid references public.kullanici (id) on delete set null,
  merkez boolean not null default false,
  metin text not null check (char_length(metin) between 1 and 4000),
  olusturma timestamptz not null default now()
);
alter table public.destek_talep enable row level security;
alter table public.destek_mesaj enable row level security;
grant select, insert on public.destek_talep, public.destek_mesaj to authenticated;
grant update (durum) on public.destek_talep to authenticated;
create policy destek_oku on public.destek_talep for select to authenticated using (app.yetkisi_var('destek.talep', dershane_id));
create policy destek_ac on public.destek_talep for insert to authenticated with check (dershane_id = app.dershane_id() and acan_id = auth.uid() and app.yetkisi_var('destek.talep', dershane_id));
create policy destek_kapat on public.destek_talep for update to authenticated using (app.yetkisi_var('destek.talep', dershane_id)) with check (durum in ('kapandi', 'acik'));
create policy destek_mesaj_oku on public.destek_mesaj for select to authenticated
  using (exists (select 1 from public.destek_talep t where t.id = talep_id and app.yetkisi_var('destek.talep', t.dershane_id)));
create policy destek_mesaj_yaz on public.destek_mesaj for insert to authenticated
  with check (yazan_id = auth.uid() and not merkez and exists (select 1 from public.destek_talep t where t.id = talep_id and app.yetkisi_var('destek.talep', t.dershane_id)));

-- ── Merkez duyuruları ve dershane olarak görüntüleme ──
create table public.merkez_duyuru (
  id uuid primary key default gen_random_uuid(),
  baslik text not null check (char_length(baslik) between 2 and 120),
  metin text not null check (char_length(metin) between 1 and 2000),
  dershane_ids uuid[],
  bitis timestamptz,
  olusturan_id uuid references public.kullanici (id) on delete set null,
  olusturma timestamptz not null default now()
);
alter table public.merkez_duyuru enable row level security;
grant select on public.merkez_duyuru to authenticated;
create policy merkez_duyuru_oku on public.merkez_duyuru for select to authenticated
  using ((dershane_ids is null or app.dershane_id() = any (dershane_ids)) and (bitis is null or bitis > now()) and app.dershane_id() is not null);

create table public.destek_goruntuleme (
  id bigint generated always as identity primary key,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  merkez_id uuid references public.kullanici (id) on delete set null,
  baslangic timestamptz not null default now(),
  bitis timestamptz not null default now() + interval '30 minutes'
);
alter table public.destek_goruntuleme enable row level security;
grant select on public.destek_goruntuleme to authenticated;
create policy destek_goruntuleme_oku on public.destek_goruntuleme for select to authenticated using (dershane_id = app.dershane_id());

-- ── E-posta şablonları ──
create table public.eposta_sablon (
  kod text primary key,
  konu text not null,
  govde text not null,
  aciklama text,
  guncelleme timestamptz not null default now()
);
insert into public.eposta_sablon (kod, konu, govde, aciklama) values
  ('hos_geldin', 'KMY Arena hesabınız açıldı', E'Merhaba {ad},\n\n{dershane} için KMY Arena {rol} hesabınız açıldı.\n\nGiriş: {giris}\nGeçici şifre: {sifre}\n{panel}\nİlk girişte şifrenizi değiştirmeniz istenecek.\n\nKMY Arena', 'Personel ve kurucu hesabı açılınca'),
  ('lisans_bitiyor', 'KMY Arena lisansınızın bitmesine {gun} gün kaldı', E'Merhaba,\n\n{dershane} için KMY Arena lisansınız {tarih} tarihinde sona eriyor. Kesintisiz devam için bizimle iletişime geçin.\n\nKMY Arena', 'Lisans bitişine 14 gün kala'),
  ('odeme_gecikti', 'KMY Arena ödemesi gecikti', E'Merhaba,\n\n{dershane} için {donem} dönemi faturanızın ({tutar} TL) vadesi {vade} tarihinde geçti. 30 günü aşan gecikmede öğrenci uygulaması salt okunur moda geçer; veriler silinmez.\n\nKMY Arena', 'Vadesi 15 gün geçen fatura'),
  ('teklif_tesekkur', 'Talebinizi aldık', E'Merhaba {yetkili},\n\n{dershane} için KMY Arena {talep} talebinizi aldık. En geç bir iş günü içinde sizi arayacağız.\n\nKMY Arena', 'Tanıtım sitesi formu'),
  ('veli_haftalik', '{cocuklar} · haftalık KMY Arena özeti', E'Merhaba {ad},\n\n{ozet}\n\nAyrıntılar için KMY Arena uygulamasındaki veli ekranına bakabilirsiniz.', 'Pazar akşamı veli özeti (özet bölümü otomatik)')
on conflict (kod) do nothing;
alter table public.eposta_sablon enable row level security;

-- ── Moderasyon ──
create table public.yasakli_kelime (
  id bigint generated always as identity primary key,
  kelime text not null check (char_length(kelime) between 2 and 40),
  dershane_id uuid references public.dershane (id) on delete cascade,
  olusturma timestamptz not null default now(),
  unique nulls not distinct (kelime, dershane_id)
);
alter table public.yasakli_kelime enable row level security;
create or replace function public.sistem_yasakli_kelimeler(p_dershane uuid) returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(kelime), '{}') from public.yasakli_kelime where dershane_id is null or dershane_id = p_dershane
$$;

/** Puanı dondurulan öğrenci XP/Altın kazanmaz (odul_ver yeniden tanımı); çift XP etkinliği çarpanı uygulanır. */
create table public.platform_etkinlik (
  id uuid primary key default gen_random_uuid(),
  ad text not null check (char_length(ad) between 2 and 120),
  tur text not null check (tur in ('cift_xp', 'tema', 'sezon', 'turnuva')),
  baslangic timestamptz not null,
  bitis timestamptz not null check (bitis > baslangic),
  dershane_ids uuid[],
  xp_carpan numeric(3, 1) not null default 1 check (xp_carpan between 1 and 3),
  aciklama text,
  olusturma timestamptz not null default now()
);
alter table public.platform_etkinlik enable row level security;
grant select on public.platform_etkinlik to authenticated;
create policy platform_etkinlik_oku on public.platform_etkinlik for select to authenticated
  using (dershane_ids is null or app.dershane_id() = any (dershane_ids));

create or replace function app.odul_ver(p_kullanici uuid, p_xp integer, p_altin integer)
returns public.ogrenci_ilerleme
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hafta date := app.hafta_basi(app.bugun());
  v public.ogrenci_ilerleme;
  v_xp integer := greatest(p_xp, 0);
  v_k public.kullanici;
  v_carpan numeric;
begin
  select * into v_k from public.kullanici where id = p_kullanici;
  if v_k.puan_donduruldu then
    select * into v from public.ogrenci_ilerleme where kullanici_id = p_kullanici;
    return v;
  end if;
  select max(xp_carpan) into v_carpan from public.platform_etkinlik
  where tur = 'cift_xp' and now() between baslangic and bitis and (dershane_ids is null or v_k.dershane_id = any (dershane_ids));
  v_xp := round(v_xp * coalesce(v_carpan, 1))::integer;
  update public.ogrenci_ilerleme set
    xp = xp + v_xp,
    altin = greatest(0, altin + p_altin),
    seviye = app.xpden_seviye(xp + v_xp),
    haftalik_xp = case when hafta = v_hafta then haftalik_xp else 0 end + v_xp,
    hafta = v_hafta
  where kullanici_id = p_kullanici
  returning * into v;
  if v_xp > 0 then
    perform app.lig_katil(p_kullanici);
    update public.lig_uyelik set xp = xp + v_xp where kullanici_id = p_kullanici and hafta = v_hafta;
  end if;
  return v;
end $$;

-- ── Mağaza eşyası ayarları (fiyat / satış / yayın tarihi) ──
create table public.esya_ayari (
  kod text primary key,
  fiyat integer check (fiyat is null or fiyat between 0 and 100000),
  aktif boolean not null default true,
  yayin_tarihi timestamptz,
  guncelleme timestamptz not null default now()
);
alter table public.esya_ayari enable row level security;
grant select on public.esya_ayari to authenticated;
create policy esya_ayari_oku on public.esya_ayari for select to authenticated using (true);

-- ── Sistem sağlığı ──
create or replace function public.sistem_saglik() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'aktif_duello', (select count(*) from public.duello where durum = 'oynaniyor' and son_a > now() - interval '5 minutes'),
    'esz_kullanici', (select count(distinct kullanici_id) from public.cevap where olusturma > now() - interval '5 minutes'),
    'saatlik_cevap', (select count(*) from public.cevap where olusturma > now() - interval '1 hour'),
    'ai_istek_24s', (select count(*) from public.ai_cagri_log where olusturma > now() - interval '24 hours'),
    'ai_hata_orani', (select round(100.0 * count(*) filter (where not basarili) / nullif(count(*), 0), 1) from public.ai_cagri_log where olusturma > now() - interval '24 hours'),
    'ai_p50_ms', (select percentile_cont(0.5) within group (order by sure_ms) from public.ai_cagri_log where olusturma > now() - interval '24 hours' and basarili),
    'ai_p95_ms', (select percentile_cont(0.95) within group (order by sure_ms) from public.ai_cagri_log where olusturma > now() - interval '24 hours' and basarili),
    'bildirim_bekleyen', (select count(*) from public.bildirim_kuyruk where gonderildi is null),
    'havuz_dogrulanmis', (select count(*) from public.soru where kaynak = 'ai' and durum = 'dogrulandi'),
    'havuz_24s_uretim', (select count(*) from public.soru where kaynak = 'ai' and olusturma > now() - interval '24 hours'),
    'havuz_24s_red', (select count(*) from public.soru where kaynak = 'ai' and durum = 'reddedildi' and olusturma > now() - interval '24 hours'),
    'veritabani_mb', (select round(pg_database_size(current_database()) / 1048576.0)),
    'acik_sikayet', (select count(*) from public.sikayet where durum = 'acik'),
    'acik_destek', (select count(*) from public.destek_talep where durum <> 'kapandi')
  )
$$;

/** Platform geneli anonim etki raporu (dershane adları gizli). */
create or replace function public.sistem_platform_etki(p_sinav text) returns jsonb
language sql stable security definer set search_path = '' as $$
  with toplam as (
    select r.kullanici_id, r.dershane_id, d.tarih, sum(r.net) net from public.deneme_sonuc r join public.deneme d on d.id = r.deneme_id
    where d.sinav_turu = p_sinav group by r.kullanici_id, r.dershane_id, d.id, d.tarih
  ), uc as (
    select kullanici_id, dershane_id, min(tarih) ilk, max(tarih) son, (array_agg(net order by tarih))[1] ilk_net, (array_agg(net order by tarih desc))[1] son_net
    from toplam group by kullanici_id, dershane_id having count(*) >= 2
  ), kul as (
    select u.*, (select count(*) from public.cevap c where c.kullanici_id = u.kullanici_id and c.olusturma::date between u.ilk and u.son)::numeric / greatest(1, u.son - u.ilk) yogunluk from uc u
  ), dilim as (select *, ntile(3) over (order by yogunluk) d from kul)
  select jsonb_build_object('ogrenci', (select count(*) from dilim), 'dershane', (select count(distinct dershane_id) from dilim),
    'gruplar', coalesce((select jsonb_agg(g order by dd desc) from (select d dd, jsonb_build_object('grup', case d when 3 then 'yuksek' when 2 then 'orta' else 'dusuk' end,
      'ogrenci', count(*), 'gunluk_soru', round(avg(yogunluk), 1), 'degisim', round(avg(son_net - ilk_net), 2)) g from dilim group by d) t), '[]'))
$$;

revoke all on function public.sistem_yasakli_kelimeler(uuid), public.sistem_saglik(), public.sistem_platform_etki(text) from public, anon, authenticated;
grant execute on function public.sistem_yasakli_kelimeler(uuid), public.sistem_saglik(), public.sistem_platform_etki(text) to service_role;
revoke all on function app.ai_maliyet(timestamptz, timestamptz, uuid), app.saglik_skoru(uuid) from public, anon, authenticated;

/** Merkez genel bakış (servis; panel merkez yetkisini önce denetler). */
create or replace function public.sistem_merkez_ozet() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'dershane', (select count(*) from public.dershane where not bireysel),
    'aktif', (select count(*) from public.dershane where not bireysel and lisans_durumu = 'aktif'),
    'pilot', (select count(*) from public.dershane where not bireysel and lisans_durumu = 'pilot'),
    'ogrenci', (select count(*) from public.kullanici where tur = 'ogrenci' and silinme_talebi is null),
    'gunluk_aktif', (select count(distinct kullanici_id) from public.cevap where olusturma > now() - interval '1 day'),
    'haftalik_aktif', (select count(distinct kullanici_id) from public.cevap where olusturma > now() - interval '7 days'),
    'bugun_soru', (select count(*) from public.cevap where olusturma >= (now() at time zone 'Europe/Istanbul')::date::timestamp at time zone 'Europe/Istanbul'),
    'mrr', (select coalesce(sum(aylik_ucret), 0) from public.dershane where lisans_durumu in ('aktif', 'gecikmis')),
    'ai_maliyet_ay', app.ai_maliyet(date_trunc('month', now()), now() + interval '1 second'),
    'fiyatsiz_model', (select count(distinct l.model) from public.ai_cagri_log l left join public.model_fiyat f on f.model = l.model
                       where l.olusturma > date_trunc('month', now()) and coalesce(f.giris_1m, 0) = 0 and coalesce(f.cikis_1m, 0) = 0),
    'dershaneler', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', d.id, 'ad', d.ad, 'sehir', d.sehir, 'lisans', d.lisans_durumu, 'bitis', d.lisans_bitis, 'limit', d.ogrenci_limiti, 'ucret', d.aylik_ucret,
        'ogrenci', (select count(*) from public.kullanici k where k.dershane_id = d.id and k.tur = 'ogrenci' and k.silinme_talebi is null),
        'haftalik_aktif', (select count(distinct c.kullanici_id) from public.cevap c where c.dershane_id = d.id and c.olusturma > now() - interval '7 days'),
        'soru30', (select count(*) from public.cevap c where c.dershane_id = d.id and c.olusturma > now() - interval '30 days'),
        'maliyet30', app.ai_maliyet(now() - interval '30 days', now(), d.id),
        'saglik', app.saglik_skoru(d.id)
      ) order by d.ad), '[]') from public.dershane d where not d.bireysel),
    'akis', jsonb_build_object(
      'yeni_dershane', (select coalesce(jsonb_agg(jsonb_build_object('ad', ad, 'olusturma', olusturma) order by olusturma desc), '[]') from (select ad, olusturma from public.dershane where not bireysel order by olusturma desc limit 5) x),
      'teklif', (select coalesce(jsonb_agg(jsonb_build_object('ad', dershane_adi, 'sehir', sehir, 'olusturma', olusturma) order by olusturma desc), '[]') from (select dershane_adi, sehir, olusturma from public.teklif order by olusturma desc limit 5) x),
      'sikayet', (select count(*) from public.sikayet where merkeze_ilet and durum = 'acik'),
      'destek', (select count(*) from public.destek_talep where durum in ('acik', 'bekliyor'))
    )
  )
$$;
revoke all on function public.sistem_merkez_ozet() from public, anon, authenticated;
grant execute on function public.sistem_merkez_ozet() to service_role;

-- Dershane: şikâyeti merkeze ilet (moderasyon yetkisi)
create or replace function public.panel_sikayet_merkeze(p_sikayet uuid, p_not text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.sikayet set merkeze_ilet = true, merkez_notu = left(p_not, 500)
  where id = p_sikayet and dershane_id = app.dershane_id() and app.yetkisi_var('moderasyon.yap', dershane_id, app.sube_id());
  if not found then raise exception 'panel.yetkisiz'; end if;
end $$;
grant execute on function public.panel_sikayet_merkeze(uuid, text) to authenticated;

-- Sosyal kısıtlı öğrenci (merkez kararı) klan sohbeti/topluluk yazamaz: API sosyalGerekli bu alanı da denetler.
