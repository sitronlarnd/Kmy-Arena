-- ─────────────────────────────────────────────────────────────
-- 0008 · Faz 1: çekirdek soru döngüsü
--
--  • ogrenci_ilerleme   XP, Altın, seviye, seri, adaptif akış sırası
--  • hata_defteri       yanlış/boş sorular ve aralıklı tekrar (1-3-7-21 gün)
--  • tespit_oturumu     ders başına uyarlamalı seviye tespit sınavı
--  • soru_hata_bildirimi öğrencinin "soruda hata var" bildirimi
--  • uretim_kilidi      aynı (kazanım, bant) için eşzamanlı üretimi önler
--  • soru_gosterim'e ipucu sayacı, cevaplanma zamanı, tekrar/tespit bağı
--
-- Hesaplamalar (Elo, XP, ustalık) packages/shared içindeki TEK kaynaktan
-- API'de yapılır; bu fonksiyonlar sonucu TEK İŞLEMDE ve yarış kontrolüyle
-- yazar. Hepsi yalnızca service_role tarafından çağrılabilir: istemci puan,
-- XP, Altın veya beceri yazamaz.
-- ─────────────────────────────────────────────────────────────

-- ── Öğrenci ilerlemesi ──
create table public.ogrenci_ilerleme (
  kullanici_id uuid primary key references public.kullanici (id) on delete cascade,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  xp bigint not null default 0 check (xp >= 0),
  altin integer not null default 0 check (altin >= 0),
  seviye integer not null default 1,
  seri_dogru integer not null default 0,      -- art arda doğru (XP seri çarpanı)
  akis_sirasi integer not null default 0,     -- adaptif akış: her 5 soruda meydan okuma/güven
  toplam_cevap integer not null default 0,
  toplam_dogru integer not null default 0,
  ozellik_puanlari jsonb not null default '{"zeka":0,"enerji":0,"bilgelik":0,"strateji":0,"ceviklik":0}'::jsonb,
  son_cevap timestamptz,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
select app.guncelleme_tetikleyicisi_ekle('public.ogrenci_ilerleme');
create index ogrenci_ilerleme_dershane on public.ogrenci_ilerleme (dershane_id);

-- ── Hata defteri ve aralıklı tekrar ──
create table public.hata_defteri (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  kazanim_id uuid not null references public.kazanim (id),
  soru_id uuid not null references public.soru (id),
  secilen char(1),                          -- öğrencinin ilk cevabı (null = boş)
  asama smallint not null default 0,        -- 0..araliklar; son aşamayı geçen temizlenir
  sonraki_tekrar timestamptz not null,
  tekrar_sayisi integer not null default 0,
  durum text not null default 'acik' check (durum in ('acik', 'temizlendi')),
  temizlenme timestamptz,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  unique (kullanici_id, soru_id)
);
select app.guncelleme_tetikleyicisi_ekle('public.hata_defteri');
create index hata_defteri_vadesi on public.hata_defteri (kullanici_id, sonraki_tekrar) where durum = 'acik';

-- ── Seviye tespit sınavı ──
create table public.tespit_oturumu (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  ders_id uuid not null references public.ders (id),
  theta numeric(7, 2) not null default 1000,
  hedef_soru smallint not null default 10 check (hedef_soru between 4 and 20),
  soru_sayisi smallint not null default 0,
  dogru smallint not null default 0,
  bitis timestamptz,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
select app.guncelleme_tetikleyicisi_ekle('public.tespit_oturumu');
create unique index tespit_oturumu_tek_acik on public.tespit_oturumu (kullanici_id, ders_id) where bitis is null;

-- ── "Soruda hata var" bildirimi ──
create table public.soru_hata_bildirimi (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  soru_id uuid not null references public.soru (id) on delete cascade,
  aciklama text check (char_length(aciklama) <= 500),
  durum text not null default 'bekliyor' check (durum in ('bekliyor', 'onaylandi', 'reddedildi')),
  inceleyen uuid references public.kullanici (id) on delete set null,
  karar_tarihi timestamptz,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  unique (kullanici_id, soru_id)
);
select app.guncelleme_tetikleyicisi_ekle('public.soru_hata_bildirimi');
create index soru_hata_bildirimi_bekleyen on public.soru_hata_bildirimi (dershane_id, durum);

-- ── Üretim kilidi ve sayaçları (yalnızca sunucu) ──
create table public.uretim_kilidi (
  kazanim_id uuid not null references public.kazanim (id) on delete cascade,
  zorluk_bandi smallint not null check (zorluk_bandi between 1 and 5),
  kilit_bitis timestamptz not null default '-infinity',
  uretilen integer not null default 0,
  reddedilen integer not null default 0,
  son_uretim timestamptz,
  primary key (kazanim_id, zorluk_bandi)
);

-- ── Acil durum anahtarları (Merkez Panel > AI Merkezi) ──
-- ai_yedek_mod: KMYAI'ye hiç gidilmez; yalnızca havuzdaki doğrulanmış sorular sunulur.
-- durdurulan_ai_gorevleri: görev bazlı "durdur" (ör. {'soru_uretim'}).
alter table public.uygulama_ayari
  add column ai_yedek_mod boolean not null default false,
  add column durdurulan_ai_gorevleri text[] not null default '{}';

-- ── Gösterim kaydı: tek kullanımlık "soru oturumu" ──
alter table public.soru_gosterim
  add column ipucu_sayisi smallint not null default 0,
  add column cevaplandi timestamptz,
  add column hata_defteri_id uuid references public.hata_defteri (id) on delete set null,
  add column tespit_oturumu_id uuid references public.tespit_oturumu (id) on delete set null;

-- ── RLS ──
alter table public.ogrenci_ilerleme enable row level security;
alter table public.hata_defteri enable row level security;
alter table public.tespit_oturumu enable row level security;
alter table public.soru_hata_bildirimi enable row level security;
alter table public.uretim_kilidi enable row level security;

create policy ogrenci_ilerleme_oku on public.ogrenci_ilerleme for select to authenticated
  using (app.ogrenci_akademik_okuyabilir(kullanici_id));
create policy hata_defteri_oku on public.hata_defteri for select to authenticated
  using (app.ogrenci_akademik_okuyabilir(kullanici_id));
create policy tespit_oturumu_oku on public.tespit_oturumu for select to authenticated
  using (app.ogrenci_akademik_okuyabilir(kullanici_id));
create policy soru_hata_bildirimi_oku on public.soru_hata_bildirimi for select to authenticated
  using (kullanici_id = auth.uid() or app.ogretmeni_mi(kullanici_id)
         or app.yetkisi_var('moderasyon.yap', dershane_id));
-- uretim_kilidi: politika yok → istemci hiç göremez.

revoke insert, update, delete on public.ogrenci_ilerleme, public.hata_defteri, public.tespit_oturumu,
  public.soru_hata_bildirimi, public.uretim_kilidi from anon, authenticated;
revoke all on public.uretim_kilidi from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Sunucu fonksiyonları (service_role)
-- ─────────────────────────────────────────────────────────────

/** packages/shared → seviyeIcinXp ile aynı eğri: L için toplam XP = round(100 × (L − 1)^1,6). */
create or replace function app.xpden_seviye(p_xp bigint)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare l integer := 1;
begin
  while round(100 * power(l::numeric, 1.6)) <= p_xp loop
    l := l + 1;
  end loop;
  return l;
end $$;

/**
 * Öğrenciye bir soru seçer ve gösterim kaydını açar.
 * Kurallar (packages/shared/src/havuz.ts ile aynı):
 *  • yalnızca doğrulanmış, emekli olmamış AI soruları; öğrencinin görmedikleri
 *  • hedef zorluğa en yakın olan; eşitlikte daha önce kullanılmış olan
 *    (taze sorular düelloya kalır), sonra rastgele
 * p_kazanim boşsa p_ders'in tüm kazanımlarında arar (havuzu boş kazanım için yedek).
 * Dönen json: soru (cevap anahtarıyla — API istemciye göndermeden ayıklar),
 * uzaklık ve aynı banttaki kalan görülmemiş stok.
 */
create or replace function public.sistem_soru_sec(
  p_kullanici uuid,
  p_kazanim uuid,
  p_hedef_zorluk numeric,
  p_baglam text,
  p_hata_defteri uuid default null,
  p_tespit uuid default null,
  p_emeklilik integer default 400,
  p_duello_max_gosterim integer default 3,
  p_ders uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dershane uuid;
  v_soru public.soru;
  v_bant smallint := ceil(least(greatest(round(p_hedef_zorluk), 1), 10) / 2.0)::smallint;
  v_stok integer;
begin
  select dershane_id into v_dershane from public.kullanici where id = p_kullanici;
  if v_dershane is null then raise exception 'kullanici.bulunamadi'; end if;

  select s.* into v_soru
  from public.soru s
  where (s.kazanim_id = p_kazanim
         or (p_kazanim is null and s.kazanim_id in (
           select k.id from public.kazanim k join public.unite u on u.id = k.unite_id where u.ders_id = p_ders)))
    and s.kaynak = 'ai'
    and s.durum = 'dogrulandi'
    and s.gosterim_sayisi < p_emeklilik
    and not exists (select 1 from public.soru_gosterim g where g.kullanici_id = p_kullanici and g.soru_id = s.id)
  order by round(abs(coalesce(s.olculmus_zorluk, s.zorluk) - p_hedef_zorluk)),
           case when s.gosterim_sayisi > p_duello_max_gosterim or s.duello_kullanim > 0 then 0 else 1 end,
           random()
  limit 1
  for update of s skip locked;

  if found then
    insert into public.soru_gosterim (kullanici_id, soru_id, dershane_id, baglam, hata_defteri_id, tespit_oturumu_id)
    values (p_kullanici, v_soru.id, v_dershane, p_baglam, p_hata_defteri, p_tespit);
    update public.soru set gosterim_sayisi = gosterim_sayisi + 1, son_gosterim = now() where id = v_soru.id;
  end if;

  select count(*) into v_stok
  from public.soru s
  where s.kazanim_id = coalesce(p_kazanim, v_soru.kazanim_id) and s.kaynak = 'ai' and s.durum = 'dogrulandi'
    and s.zorluk_bandi = v_bant and s.gosterim_sayisi < p_emeklilik
    and not exists (select 1 from public.soru_gosterim g where g.kullanici_id = p_kullanici and g.soru_id = s.id);

  return jsonb_build_object(
    'soru', case when v_soru.id is null then null else to_jsonb(v_soru) end,
    'uzaklik', case when v_soru.id is null then null else abs(coalesce(v_soru.olculmus_zorluk, v_soru.zorluk) - p_hedef_zorluk) end,
    'bant', v_bant,
    'bant_stok', v_stok
  );
end $$;

/** Bir (kazanım, bant) için taze (düelloya uygun) doğrulanmış soru sayısı. */
create or replace function public.sistem_havuz_durumu()
returns table (kazanim_id uuid, zorluk_bandi smallint, dogrulanmis bigint, taze bigint, reddedilen bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select s.kazanim_id, s.zorluk_bandi,
         count(*) filter (where s.durum = 'dogrulandi'),
         count(*) filter (where s.durum = 'dogrulandi' and s.duello_kullanim = 0 and s.gosterim_sayisi <= 3),
         count(*) filter (where s.durum = 'reddedildi')
  from public.soru s
  where s.kaynak = 'ai'
  group by 1, 2
$$;

/** Üretim kilidi: aynı (kazanım, bant) için aynı anda tek üretici çalışır. */
create or replace function public.sistem_uretim_kilidi_al(p_kazanim uuid, p_bant smallint, p_saniye integer)
returns boolean
language sql
security definer
set search_path = ''
as $$
  insert into public.uretim_kilidi as k (kazanim_id, zorluk_bandi, kilit_bitis)
  values (p_kazanim, p_bant, now() + make_interval(secs => p_saniye))
  on conflict (kazanim_id, zorluk_bandi) do update
    set kilit_bitis = excluded.kilit_bitis
    where k.kilit_bitis < now()
  returning true
$$;

create or replace function public.sistem_uretim_kilidi_birak(p_kazanim uuid, p_bant smallint, p_uretilen integer, p_reddedilen integer)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.uretim_kilidi
  set kilit_bitis = '-infinity', uretilen = uretilen + p_uretilen, reddedilen = reddedilen + p_reddedilen,
      son_uretim = now()
  where kazanim_id = p_kazanim and zorluk_bandi = p_bant
$$;

/** İpucu: sunucu sayar (XP çarpanı istemciye güvenilmez). Yeni sayıyı döner; sınırdaysa -1. */
create or replace function public.sistem_ipucu_al(p_kullanici uuid, p_soru uuid, p_max smallint)
returns smallint
language plpgsql
security definer
set search_path = ''
as $$
declare v smallint;
begin
  update public.soru_gosterim
  set ipucu_sayisi = ipucu_sayisi + 1
  where kullanici_id = p_kullanici and soru_id = p_soru and cevaplandi is null and ipucu_sayisi < p_max
    and baglam not in ('duello', 'klan', 'deneme', 'tespit', 'canli')
  returning ipucu_sayisi into v;
  return coalesce(v, -1);
end $$;

/**
 * Cevabı işler — TEK işlemde:
 *  gösterim kapanır (tekrar cevap verilemez) → cevap yazılır → beceri, ilerleme,
 *  soru istatistiği, hata defteri ve tespit oturumu güncellenir.
 * p_theta_once, API'nin hesap yaparken okuduğu θ'dır; bu arada başka bir cevap
 * θ'yı değiştirdiyse 'beceri.yarisma' fırlatılır, API yeniden hesaplar.
 */
create or replace function public.sistem_cevap_isle(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kullanici uuid := (p ->> 'kullanici_id')::uuid;
  v_soru_id uuid := (p ->> 'soru_id')::uuid;
  v_dogru boolean := (p ->> 'dogru_mu')::boolean;
  v_sayildi boolean := coalesce((p ->> 'sayildi')::boolean, true);
  v_g public.soru_gosterim;
  v_soru public.soru;
  v_beceri public.beceri;
  v_theta_once numeric := (p ->> 'theta_once')::numeric;
  v_ilerleme public.ogrenci_ilerleme;
  v_eski_seviye integer;
  v_araliklar integer[] := array(select jsonb_array_elements_text(coalesce(p -> 'tekrar_araliklari_gun', '[1,3,7,21]'))::integer);
  v_hd public.hata_defteri;
  v_tespit public.tespit_oturumu;
  v_tespit_bitti boolean := false;
  v_hd_durum text := null;
  v_ozellik text := p ->> 'ozellik';
begin
  select * into v_g from public.soru_gosterim
  where kullanici_id = v_kullanici and soru_id = v_soru_id
  for update;
  if not found then raise exception 'soru.gosterilmedi'; end if;
  if v_g.cevaplandi is not null then raise exception 'soru.zatenCevaplandi'; end if;

  select * into v_soru from public.soru where id = v_soru_id;

  -- Beceri (yarış kontrolü)
  select * into v_beceri from public.beceri
  where kullanici_id = v_kullanici and kazanim_id = v_soru.kazanim_id
  for update;
  if abs(coalesce(v_beceri.theta, 1000) - v_theta_once) > 0.01 then
    raise exception 'beceri.yarisma';
  end if;

  insert into public.beceri as b (dershane_id, kullanici_id, kazanim_id, theta, cozulen, dogru, son10, ustalik)
  values (v_g.dershane_id, v_kullanici, v_soru.kazanim_id, (p ->> 'theta_sonra')::numeric,
          case when v_sayildi then 1 else 0 end, case when v_dogru then 1 else 0 end,
          array[case when v_dogru then 1 else 0 end]::smallint[], p ->> 'ustalik')
  on conflict (kullanici_id, kazanim_id) do update set
    theta = excluded.theta,
    cozulen = b.cozulen + excluded.cozulen,
    dogru = b.dogru + excluded.dogru,
    son10 = (b.son10 || excluded.son10)[greatest(1, cardinality(b.son10) + 2 - 10):],
    ustalik = excluded.ustalik;

  insert into public.cevap (dershane_id, kullanici_id, soru_id, kazanim_id, baglam, secilen, dogru_mu, sure_ms,
                            ipucu_sayisi, theta_once, theta_sonra, beklenen, xp, altin)
  values (v_g.dershane_id, v_kullanici, v_soru_id, v_soru.kazanim_id, v_g.baglam,
          nullif(p ->> 'secilen', ''), v_dogru, (p ->> 'sure_ms')::integer, v_g.ipucu_sayisi,
          v_theta_once, (p ->> 'theta_sonra')::numeric, (p ->> 'beklenen')::numeric,
          (p ->> 'xp')::integer, (p ->> 'altin')::integer);

  update public.soru_gosterim set cevaplandi = now()
  where kullanici_id = v_kullanici and soru_id = v_soru_id;

  update public.soru set cevap_sayisi = cevap_sayisi + 1, dogru_sayisi = dogru_sayisi + case when v_dogru then 1 else 0 end
  where id = v_soru_id;

  -- İlerleme
  insert into public.ogrenci_ilerleme (kullanici_id, dershane_id) values (v_kullanici, v_g.dershane_id)
  on conflict (kullanici_id) do nothing;
  select * into v_ilerleme from public.ogrenci_ilerleme where kullanici_id = v_kullanici for update;
  v_eski_seviye := v_ilerleme.seviye;
  update public.ogrenci_ilerleme set
    xp = xp + (p ->> 'xp')::integer,
    altin = altin + (p ->> 'altin')::integer,
    seviye = app.xpden_seviye(xp + (p ->> 'xp')::integer),
    seri_dogru = case when v_dogru then seri_dogru + 1 else 0 end,
    akis_sirasi = akis_sirasi + 1,
    toplam_cevap = toplam_cevap + 1,
    toplam_dogru = toplam_dogru + case when v_dogru then 1 else 0 end,
    ozellik_puanlari = case
      when v_dogru and v_ozellik is not null
        then jsonb_set(ozellik_puanlari, array[v_ozellik], to_jsonb(coalesce((ozellik_puanlari ->> v_ozellik)::integer, 0) + 1))
      else ozellik_puanlari end,
    son_cevap = now()
  where kullanici_id = v_kullanici
  returning * into v_ilerleme;

  -- Hata defteri: tekrar sorusuysa aşamayı ilerlet/sıfırla, değilse yanlışı deftere ekle
  if v_g.hata_defteri_id is not null then
    select * into v_hd from public.hata_defteri where id = v_g.hata_defteri_id for update;
    if found and v_hd.durum = 'acik' then
      if v_dogru then
        if v_hd.asama + 1 >= cardinality(v_araliklar) then
          update public.hata_defteri set asama = asama + 1, durum = 'temizlendi', temizlenme = now(),
                 tekrar_sayisi = tekrar_sayisi + 1 where id = v_hd.id;
          v_hd_durum := 'temizlendi';
        else
          update public.hata_defteri set asama = asama + 1, tekrar_sayisi = tekrar_sayisi + 1,
                 sonraki_tekrar = now() + make_interval(days => v_araliklar[v_hd.asama + 2]) where id = v_hd.id;
          v_hd_durum := 'ilerledi';
        end if;
      else
        update public.hata_defteri set asama = 0, tekrar_sayisi = tekrar_sayisi + 1,
               sonraki_tekrar = now() + make_interval(days => v_araliklar[1]) where id = v_hd.id;
        v_hd_durum := 'basa_dondu';
      end if;
    end if;
  elsif not v_dogru and v_g.baglam in ('antrenman', 'tespit', 'odev', 'tekrar') then
    insert into public.hata_defteri (dershane_id, kullanici_id, kazanim_id, soru_id, secilen, sonraki_tekrar)
    values (v_g.dershane_id, v_kullanici, v_soru.kazanim_id, v_soru_id, nullif(p ->> 'secilen', ''),
            now() + make_interval(days => v_araliklar[1]))
    on conflict (kullanici_id, soru_id) do nothing;
    v_hd_durum := 'eklendi';
  end if;

  -- Tespit sınavı
  if v_g.tespit_oturumu_id is not null then
    update public.tespit_oturumu set
      theta = coalesce((p ->> 'tespit_theta')::numeric, theta),
      soru_sayisi = soru_sayisi + 1,
      dogru = dogru + case when v_dogru then 1 else 0 end,
      bitis = case when soru_sayisi + 1 >= hedef_soru then now() else null end
    where id = v_g.tespit_oturumu_id and bitis is null
    returning * into v_tespit;
    if found and v_tespit.bitis is not null then
      v_tespit_bitti := true;
      -- Dersin henüz çözülmemiş kazanımlarının başlangıç θ'sı tespit sonucudur.
      insert into public.beceri as b (dershane_id, kullanici_id, kazanim_id, theta)
      select v_g.dershane_id, v_kullanici, k.id, v_tespit.theta
      from public.kazanim k join public.unite u on u.id = k.unite_id
      where u.ders_id = v_tespit.ders_id
      on conflict (kullanici_id, kazanim_id) do update set theta = excluded.theta
        where b.cozulen = 0;
    end if;
  end if;

  return jsonb_build_object(
    'xp_toplam', v_ilerleme.xp,
    'altin_toplam', v_ilerleme.altin,
    'seviye', v_ilerleme.seviye,
    'seviye_atladi', v_ilerleme.seviye > v_eski_seviye,
    'seri', v_ilerleme.seri_dogru,
    'hata_defteri', v_hd_durum,
    'tespit_bitti', v_tespit_bitti,
    'tespit_theta', v_tespit.theta
  );
end $$;

/** Öğrencinin kendi hata defteri (cevaplanmış sorular; anahtarı zaten görmüştür). */
create or replace function public.hata_defterim()
returns table (
  id uuid, kazanim_kodu text, kazanim text, ders text, govde_md text, siklar jsonb, dogru char(1),
  secilen char(1), cozum_adimlari jsonb, asama smallint, sonraki_tekrar timestamptz, vadesi_geldi boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select h.id, k.kod, k.aciklama, d.ad, s.govde_md, s.siklar, s.dogru, h.secilen, s.cozum_adimlari,
         h.asama, h.sonraki_tekrar, h.sonraki_tekrar <= now()
  from public.hata_defteri h
  join public.soru s on s.id = h.soru_id
  join public.kazanim k on k.id = h.kazanim_id
  join public.unite u on u.id = k.unite_id
  join public.ders d on d.id = u.ders_id
  where h.kullanici_id = auth.uid() and h.durum = 'acik'
  order by h.sonraki_tekrar
$$;

-- Bildirim gelince sorunun sayacı artar (havuz kalitesi için)
create or replace function app.hata_bildirimi_sayac()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.soru set hata_bildirim_sayisi = hata_bildirim_sayisi + 1 where id = new.soru_id;
  return new;
end $$;
create trigger hata_bildirimi_sayac after insert on public.soru_hata_bildirimi
  for each row execute function app.hata_bildirimi_sayac();

-- Sistem fonksiyonları yalnızca service_role'e açık
do $$
declare f text;
begin
  foreach f in array array[
    'public.sistem_soru_sec(uuid, uuid, numeric, text, uuid, uuid, integer, integer, uuid)',
    'public.sistem_havuz_durumu()',
    'public.sistem_uretim_kilidi_al(uuid, smallint, integer)',
    'public.sistem_uretim_kilidi_birak(uuid, smallint, integer, integer)',
    'public.sistem_ipucu_al(uuid, uuid, smallint)',
    'public.sistem_cevap_isle(jsonb)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;
revoke execute on function public.hata_defterim() from public, anon;
grant execute on function public.hata_defterim() to authenticated;
