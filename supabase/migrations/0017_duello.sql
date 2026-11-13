-- ─────────────────────────────────────────────────────────────
-- 0017 · Faz 3: Düello ve Canlı Soru Saati
--
-- Sunucusuz durum makinesi: oyun ilerlemesi zaman damgalarıyla tutulur ve her
-- istek (durum / cevap) başında `app.duello_ilerlet` ile "tembel" ilerletilir:
-- süresi dolan tur kapanır, robot cevabı uygulanır, kopan oyuncu turu kaybeder,
-- sıradaki tur 8 sn sonra (5 sn ara + 3-2-1) açılır. Tüm kontrol sunucuda;
-- doğru cevap tur kapanmadan istemciye gitmez, soru metni geri sayım bitmeden gitmez.
--
-- Modlar: dereceli (Kupa, Elo K=32), arkadas (davet kodu, Kupa yok),
--         robot (açıkça "Robot", Kupa yok), asenkron (aynı 5 soru, 24 saat, yarım Kupa).
-- Düello cevapları beceriyi (θ) değiştirmez; doğru cevap başına XP ve Altın verir.
-- ─────────────────────────────────────────────────────────────

alter table public.ogrenci_ilerleme
  add column duello_toplam integer not null default 0,
  add column duello_galibiyet integer not null default 0,
  add column duello_seri integer not null default 0,
  add column en_uzun_duello_seri integer not null default 0,
  add column ders_dongusu smallint not null default 0;

create table public.duello (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  mod text not null check (mod in ('dereceli', 'arkadas', 'robot', 'asenkron')),
  ders_id uuid references public.ders (id),
  a uuid not null references public.kullanici (id) on delete cascade,
  b uuid references public.kullanici (id) on delete cascade,
  robot_theta numeric(7, 2),
  durum text not null default 'oynaniyor' check (durum in ('davet', 'oynaniyor', 'bitti', 'iptal')),
  davet_kodu text unique check (davet_kodu ~ '^[A-HJ-NP-Z2-9]{6}$'),
  tur_sayisi smallint not null default 5,
  gecerli_tur smallint not null default 1,
  skor_a smallint not null default 0,
  skor_b smallint not null default 0,
  sure_a integer not null default 0,           -- toplam cevap süresi (eşitlik bozma)
  sure_b integer not null default 0,
  kazanan text check (kazanan in ('a', 'b', 'berabere')),
  hukmen boolean not null default false,
  kupa_a integer not null default 0,           -- Kupa değişimi
  kupa_b integer not null default 0,
  kupa_durduruldu boolean not null default false, -- puan aktarma şüphesi
  sekme_a smallint not null default 0,
  sekme_b smallint not null default 0,
  kopma_a smallint not null default 0,
  kopma_b smallint not null default 0,
  son_a timestamptz,
  son_b timestamptz,
  tepki_a text, tepki_a_zaman timestamptz,      -- önceden tanımlı 8 tepkiden biri (serbest yazı yok)
  tepki_b text, tepki_b_zaman timestamptz,
  rovans_id uuid,                              -- bitince "Rövanş" ile açılan davet
  son_kullanma timestamptz,                    -- davet / asenkron için
  baslangic timestamptz,
  bitis timestamptz,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);
select app.guncelleme_tetikleyicisi_ekle('public.duello');
create index duello_oyuncu_a on public.duello (a, olusturma desc);
create index duello_oyuncu_b on public.duello (b, olusturma desc);

create table public.duello_tur (
  duello_id uuid not null references public.duello (id) on delete cascade,
  sira smallint not null,
  soru_id uuid not null references public.soru (id),
  sure_sn smallint not null,
  acilis timestamptz,          -- canlı modlarda ortak açılış
  son_an timestamptz,
  kapandi timestamptz,
  kazanan text check (kazanan in ('a', 'b')),
  a_acilis timestamptz,        -- asenkron: oyuncunun kendi açılışı
  a_secilen char(1), a_sure_ms integer, a_dogru boolean,
  b_acilis timestamptz,
  b_secilen char(1), b_sure_ms integer, b_dogru boolean,
  robot_sure_ms integer, robot_dogru boolean, robot_secilen char(1),
  primary key (duello_id, sira)
);

create table public.duello_kuyruk (
  kullanici_id uuid primary key references public.kullanici (id) on delete cascade,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  sube_id uuid,
  ders_id uuid not null references public.ders (id),
  kupa integer not null,
  giris timestamptz not null default now(),
  son_yoklama timestamptz not null default now()
);

create table public.duello_inceleme (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  duello_id uuid not null references public.duello (id) on delete cascade,
  neden text not null,
  durum text not null default 'bekliyor' check (durum in ('bekliyor', 'incelendi')),
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now()
);

-- ── Canlı Soru Saati ──
create table public.canli_oturum (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  sinav_grubu text not null check (sinav_grubu in ('LGS', 'YKS')),
  gun date not null,
  baslangic timestamptz not null,
  sorular uuid[] not null,
  sure_sn smallint not null default 40,
  aralik_sn smallint not null default 60,
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  unique (dershane_id, sinav_grubu, gun)
);

create table public.canli_cevap (
  oturum_id uuid not null references public.canli_oturum (id) on delete cascade,
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  sira smallint not null,
  secilen char(1),
  dogru boolean not null,
  sure_ms integer not null,
  derece smallint,              -- doğruysa kaçıncı doğru
  olusturma timestamptz not null default now(),
  guncelleme timestamptz not null default now(),
  primary key (oturum_id, kullanici_id, sira)
);

-- ── RLS: okuma yalnızca taraflara / dershaneye; yazma yalnızca sunucu ──
alter table public.duello enable row level security;
alter table public.duello_tur enable row level security;
alter table public.duello_kuyruk enable row level security;
alter table public.duello_inceleme enable row level security;
alter table public.canli_oturum enable row level security;
alter table public.canli_cevap enable row level security;

create policy duello_oku on public.duello for select to authenticated
  using (a = auth.uid() or b = auth.uid() or app.ogretmeni_mi(a) or (b is not null and app.ogretmeni_mi(b)));
-- duello_tur cevap anahtarı içermez ama soru kimliği içerir; istemci turları API'den alır.
create policy duello_inceleme_oku on public.duello_inceleme for select to authenticated
  using (app.ogretmeni_mi(kullanici_id) or app.yetkisi_var('moderasyon.yap', dershane_id));
create policy canli_cevap_oku on public.canli_cevap for select to authenticated
  using (kullanici_id = auth.uid());

revoke all on public.duello_tur, public.duello_kuyruk, public.canli_oturum from anon, authenticated;
revoke insert, update, delete on public.duello, public.duello_inceleme, public.canli_cevap from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Soru seçimi ve düello kurulumu
-- ─────────────────────────────────────────────────────────────

/**
 * Düello soruları: iki oyuncunun da görmediği, dersin (tercihen ikisinin de en az
 * Bronz olduğu) kazanımlarından, hedef zorluğa en yakın, düelloya taze sorular.
 */
create or replace function public.sistem_duello_sorulari(p_a uuid, p_b uuid, p_ders uuid, p_hedef numeric, p_adet integer)
returns uuid[]
language sql
security definer
set search_path = ''
as $$
  with kz as (
    select k.id,
           exists (select 1 from public.beceri b where b.kullanici_id = p_a and b.kazanim_id = k.id and b.ustalik <> 'kesfedilmedi')
           and (p_b is null or exists (select 1 from public.beceri b where b.kullanici_id = p_b and b.kazanim_id = k.id and b.ustalik <> 'kesfedilmedi')) as ortak
    from public.kazanim k join public.unite u on u.id = k.unite_id
    where u.ders_id = p_ders
  )
  select coalesce(array_agg(id), '{}') from (
    select s.id
    from public.soru s join kz on kz.id = s.kazanim_id
    where s.kaynak = 'ai' and s.durum = 'dogrulandi'
      and not exists (select 1 from public.soru_gosterim g where g.soru_id = s.id and g.kullanici_id in (p_a, p_b))
    order by (not kz.ortak), (s.duello_kullanim > 0 or s.gosterim_sayisi > 3),
             round(abs(coalesce(s.olculmus_zorluk, s.zorluk) - p_hedef)), random()
    limit p_adet
  ) x
$$;

/** Oyuncunun düelloda gördüğü soruları antrenmanda bir daha görmemesi için işaretler. */
create or replace function app.duello_gosterim(p_duello uuid, p_kullanici uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.soru_gosterim (kullanici_id, soru_id, dershane_id, baglam, cevaplandi)
  select p_kullanici, t.soru_id, d.dershane_id, 'duello', now()
  from public.duello_tur t join public.duello d on d.id = t.duello_id
  where t.duello_id = p_duello
  on conflict do nothing
$$;

/**
 * Düello oluşturur. p_robot: [{sure_ms, dogru, secilen}] (robot modu).
 * Canlı modlarda ilk tur 4 sn sonra açılır (3-2-1 + tampon).
 */
create or replace function public.sistem_duello_olustur(
  p_mod text, p_dershane uuid, p_ders uuid, p_a uuid, p_b uuid, p_sorular uuid[], p_sureler integer[],
  p_robot jsonb default null, p_robot_theta numeric default null, p_davet_kodu text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_acilis timestamptz := clock_timestamp() + interval '4 seconds';
  v_davet boolean := p_mod = 'arkadas' and p_b is null;
  i integer;
begin
  if cardinality(p_sorular) < 3 then raise exception 'duello.soruYok'; end if;
  insert into public.duello (dershane_id, mod, ders_id, a, b, robot_theta, durum, davet_kodu, tur_sayisi, baslangic, son_kullanma, son_a, son_b)
  values (p_dershane, p_mod, p_ders, p_a, p_b, p_robot_theta,
          case when v_davet then 'davet' else 'oynaniyor' end,
          p_davet_kodu, cardinality(p_sorular),
          case when v_davet then null else now() end,
          case when v_davet then now() + interval '10 minutes' when p_mod = 'asenkron' then now() + interval '24 hours' end,
          now(), case when p_b is not null then now() end)
  returning id into v_id;
  for i in 1..cardinality(p_sorular) loop
    insert into public.duello_tur (duello_id, sira, soru_id, sure_sn, acilis, son_an, robot_sure_ms, robot_dogru, robot_secilen)
    values (v_id, i, p_sorular[i], p_sureler[i],
            case when i = 1 and not v_davet and p_mod <> 'asenkron' then v_acilis end,
            case when i = 1 and not v_davet and p_mod <> 'asenkron' then v_acilis + make_interval(secs => p_sureler[i]) end,
            (p_robot -> (i - 1) ->> 'sure_ms')::integer, (p_robot -> (i - 1) ->> 'dogru')::boolean, p_robot -> (i - 1) ->> 'secilen');
    update public.soru set duello_kullanim = duello_kullanim + 1 where id = p_sorular[i];
  end loop;
  perform app.duello_gosterim(v_id, p_a);
  if p_b is not null then perform app.duello_gosterim(v_id, p_b); end if;
  return v_id;
end $$;

/** Davet koduyla arkadaş düellosuna katılır ve oyunu başlatır. */
create or replace function public.sistem_duello_katil(p_kod text, p_kullanici uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.duello;
  v_acilis timestamptz := clock_timestamp() + interval '4 seconds';
begin
  select * into d from public.duello where davet_kodu = upper(p_kod) for update;
  if not found or d.durum <> 'davet' or d.son_kullanma < now() then raise exception 'duello.davetGecersiz'; end if;
  if d.a = p_kullanici then raise exception 'duello.kendinle'; end if;
  if (select dershane_id from public.kullanici where id = p_kullanici) <> d.dershane_id then raise exception 'duello.davetGecersiz'; end if;
  update public.duello set b = p_kullanici, durum = 'oynaniyor', baslangic = now(), son_a = now(), son_b = now(), davet_kodu = null
  where id = d.id;
  update public.duello_tur set acilis = v_acilis, son_an = v_acilis + make_interval(secs => sure_sn) where duello_id = d.id and sira = 1;
  perform app.duello_gosterim(d.id, p_kullanici);
  return d.id;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Durum makinesi
-- ─────────────────────────────────────────────────────────────

/** Düello bitişi: kazanan, Kupa (Elo), XP/Altın, seri, puan aktarma kontrolü. */
create or replace function app.duello_bitir(p_id uuid, p_kupa_k integer, p_hukmen_kaybeden text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.duello;
  v_kazanan text;
  ka integer; kb integer; ea numeric; v_ka integer := 0; v_kb integer := 0;
  v_xp_a integer; v_xp_b integer; v_al_a integer; v_al_b integer;
  v_carpan numeric;
  v_aktarma boolean := false;
begin
  select * into d from public.duello where id = p_id for update;
  if d.durum = 'bitti' then return; end if;
  v_kazanan := case
    when p_hukmen_kaybeden = 'a' then 'b'
    when p_hukmen_kaybeden = 'b' then 'a'
    when d.skor_a > d.skor_b then 'a'
    when d.skor_b > d.skor_a then 'b'
    when d.sure_a < d.sure_b then 'a'
    when d.sure_b < d.sure_a then 'b'
    else 'berabere' end;

  -- Kupa: yalnızca dereceli (tam) ve asenkron (yarım); robot ve arkadaş yok
  if d.mod in ('dereceli', 'asenkron') and d.b is not null then
    -- Puan aktarma: aynı ikili son 7 günde ≥ 4 dereceli düello ve hep aynı kazanan → Kupa durur
    select count(*) >= 4 and count(distinct case when x.kazanan = 'a' then x.a else x.b end) = 1 into v_aktarma
    from public.duello x
    where x.durum = 'bitti' and x.mod in ('dereceli', 'asenkron') and x.olusturma > now() - interval '7 days'
      and ((x.a = d.a and x.b = d.b) or (x.a = d.b and x.b = d.a)) and x.kazanan in ('a', 'b');
    if not v_aktarma then
      select kupa into ka from public.ogrenci_ilerleme where kullanici_id = d.a;
      select kupa into kb from public.ogrenci_ilerleme where kullanici_id = d.b;
      ea := 1 / (1 + power(10, (coalesce(kb, 0) - coalesce(ka, 0)) / 400.0));
      v_carpan := case when d.mod = 'asenkron' then 0.5 else 1 end;
      v_ka := round(v_carpan * p_kupa_k * ((case v_kazanan when 'a' then 1 when 'berabere' then 0.5 else 0 end) - ea));
      v_kb := -v_ka;
    end if;
  end if;

  update public.duello set durum = 'bitti', bitis = now(), kazanan = v_kazanan, hukmen = p_hukmen_kaybeden is not null,
         kupa_a = v_ka, kupa_b = v_kb, kupa_durduruldu = v_aktarma
  where id = p_id;

  -- XP/Altın: doğru cevap başına (kaybeden de kazanır)
  select coalesce(sum(case when t.a_dogru then 10 * round(coalesce(s.olculmus_zorluk, s.zorluk)) end), 0)::integer,
         coalesce(sum(case when t.b_dogru then 10 * round(coalesce(s.olculmus_zorluk, s.zorluk)) end), 0)::integer,
         (count(*) filter (where t.a_dogru) * 2)::integer, (count(*) filter (where t.b_dogru) * 2)::integer
  into v_xp_a, v_xp_b, v_al_a, v_al_b
  from public.duello_tur t join public.soru s on s.id = t.soru_id where t.duello_id = p_id;

  perform app.duello_oyuncu_odul(d.a, v_xp_a, v_al_a, v_ka, v_kazanan = 'a', d.mod);
  if d.b is not null then perform app.duello_oyuncu_odul(d.b, v_xp_b, v_al_b, v_kb, v_kazanan = 'b', d.mod); end if;
end $$;

create or replace function app.duello_oyuncu_odul(p_k uuid, p_xp integer, p_altin integer, p_kupa integer, p_kazandi boolean, p_mod text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_seri integer;
begin
  insert into public.ogrenci_ilerleme (kullanici_id, dershane_id)
  select id, dershane_id from public.kullanici where id = p_k
  on conflict (kullanici_id) do nothing;
  update public.ogrenci_ilerleme set
    kupa = greatest(0, kupa + p_kupa),
    duello_toplam = duello_toplam + 1,
    duello_galibiyet = duello_galibiyet + case when p_kazandi then 1 else 0 end,
    duello_seri = case when p_kazandi then duello_seri + 1 when p_mod = 'robot' then duello_seri else 0 end,
    en_uzun_duello_seri = greatest(en_uzun_duello_seri, case when p_kazandi then duello_seri + 1 else 0 end)
  where kullanici_id = p_k
  returning duello_seri into v_seri;
  -- 3 galibiyet serisinde bonus Altın (robot hariç)
  perform app.odul_ver(p_k, p_xp, p_altin + case when p_kazandi and p_mod <> 'robot' and v_seri > 0 and v_seri % 3 = 0 then 50 else 0 end);
end $$;

/** Tembel ilerletme: süreler, robot, kopma, sıradaki tur, bitiş. */
create or replace function app.duello_ilerlet(p_id uuid, p_kupa_k integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.duello;
  t public.duello_tur;
  v_simdi timestamptz;
  v_kopan text;
  i integer := 0;
begin
  loop
    i := i + 1;
    exit when i > 12;
    v_simdi := clock_timestamp();
    select * into d from public.duello where id = p_id for update;
    exit when d.durum <> 'oynaniyor' or d.mod = 'asenkron';
    select * into t from public.duello_tur where duello_id = p_id and sira = d.gecerli_tur for update;
    exit when t.acilis is null or v_simdi < t.acilis;

    if t.kapandi is null then
      -- Robot cevabı
      if d.mod = 'robot' and t.b_secilen is null and t.b_dogru is null and v_simdi >= t.acilis + make_interval(secs => t.robot_sure_ms / 1000.0)
         and t.acilis + make_interval(secs => t.robot_sure_ms / 1000.0) <= t.son_an then
        update public.duello_tur set b_secilen = t.robot_secilen, b_dogru = t.robot_dogru, b_sure_ms = t.robot_sure_ms
        where duello_id = p_id and sira = t.sira;
        if t.robot_dogru then
          update public.duello_tur set kazanan = 'b', kapandi = t.acilis + make_interval(secs => t.robot_sure_ms / 1000.0)
          where duello_id = p_id and sira = t.sira;
          update public.duello set skor_b = skor_b + 1, sure_b = sure_b + t.robot_sure_ms where id = p_id;
          continue;
        elsif t.a_dogru = false then
          update public.duello_tur set kapandi = v_simdi where duello_id = p_id and sira = t.sira;
          continue;
        end if;
        select * into t from public.duello_tur where duello_id = p_id and sira = d.gecerli_tur;
      end if;
      -- Kopma: 15 sn'den uzun süredir görülmeyen oyuncu turu kaybeder; 2. kopmada hükmen
      v_kopan := case
        when d.son_a < v_simdi - interval '15 seconds' and t.a_dogru is null then 'a'
        when d.mod <> 'robot' and d.son_b < v_simdi - interval '15 seconds' and t.b_dogru is null then 'b' end;
      if v_kopan is not null and v_simdi > t.acilis + interval '15 seconds' then
        if v_kopan = 'a' then update public.duello set kopma_a = kopma_a + 1 where id = p_id returning * into d;
        else update public.duello set kopma_b = kopma_b + 1 where id = p_id returning * into d; end if;
        if (v_kopan = 'a' and d.kopma_a >= 2) or (v_kopan = 'b' and d.kopma_b >= 2) then
          update public.duello_tur set kapandi = v_simdi where duello_id = p_id and sira = t.sira;
          perform app.duello_bitir(p_id, p_kupa_k, v_kopan);
          exit;
        end if;
        update public.duello_tur set kapandi = v_simdi, kazanan = case v_kopan when 'a' then 'b' else 'a' end
        where duello_id = p_id and sira = t.sira;
        if v_kopan = 'a' then update public.duello set skor_b = skor_b + 1 where id = p_id;
        else update public.duello set skor_a = skor_a + 1 where id = p_id; end if;
        continue;
      end if;
      -- Süre doldu
      if v_simdi >= t.son_an then
        update public.duello_tur set kapandi = t.son_an where duello_id = p_id and sira = t.sira;
        continue;
      end if;
      exit; -- tur açık ve sürüyor
    end if;

    -- Tur kapalı: bitti mi, yoksa sıradaki tur?
    if d.skor_a >= 3 or d.skor_b >= 3 or d.gecerli_tur >= d.tur_sayisi then
      perform app.duello_bitir(p_id, p_kupa_k);
      exit;
    end if;
    update public.duello set gecerli_tur = gecerli_tur + 1 where id = p_id;
    update public.duello_tur
    set acilis = t.kapandi + interval '8 seconds', son_an = t.kapandi + interval '8 seconds' + make_interval(secs => sure_sn)
    where duello_id = p_id and sira = t.sira + 1;
  end loop;
end $$;

/** Asenkron düelloda oyuncunun sıradaki sorusunu açar (kendi saatiyle). */
create or replace function app.asenkron_ac(p_id uuid, p_taraf text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare d public.duello; v_sira smallint;
begin
  select * into d from public.duello where id = p_id for update;
  if d.durum <> 'oynaniyor' then return; end if;
  if d.son_kullanma < now() then
    perform app.duello_bitir(p_id, 32);
    return;
  end if;
  if p_taraf = 'a' then
    -- Süresi dolan açık soruyu boş say
    update public.duello_tur set a_dogru = false, a_sure_ms = sure_sn * 1000
    where duello_id = p_id and a_acilis is not null and a_dogru is null and a_acilis + make_interval(secs => sure_sn) < clock_timestamp();
    select min(sira) into v_sira from public.duello_tur where duello_id = p_id and a_dogru is null;
    if v_sira is not null then
      update public.duello_tur set a_acilis = coalesce(a_acilis, clock_timestamp() + interval '3 seconds') where duello_id = p_id and sira = v_sira;
    end if;
  else
    update public.duello_tur set b_dogru = false, b_sure_ms = sure_sn * 1000
    where duello_id = p_id and b_acilis is not null and b_dogru is null and b_acilis + make_interval(secs => sure_sn) < clock_timestamp();
    select min(sira) into v_sira from public.duello_tur where duello_id = p_id and b_dogru is null;
    if v_sira is not null then
      update public.duello_tur set b_acilis = coalesce(b_acilis, clock_timestamp() + interval '3 seconds') where duello_id = p_id and sira = v_sira;
    end if;
  end if;
  -- İki taraf da bitirdiyse sonuç
  if d.b is not null and not exists (select 1 from public.duello_tur where duello_id = p_id and (a_dogru is null or b_dogru is null)) then
    update public.duello set
      skor_a = (select count(*) from public.duello_tur where duello_id = p_id and a_dogru),
      skor_b = (select count(*) from public.duello_tur where duello_id = p_id and b_dogru),
      sure_a = (select coalesce(sum(a_sure_ms), 0) from public.duello_tur where duello_id = p_id),
      sure_b = (select coalesce(sum(b_sure_ms), 0) from public.duello_tur where duello_id = p_id)
    where id = p_id;
    perform app.duello_bitir(p_id, 32);
  end if;
end $$;

/** İstemcinin gördüğü durum: soru metni yalnızca açılıştan sonra, doğru cevap yalnızca kapanan turda. */
create or replace function public.sistem_duello_durum(p_id uuid, p_kullanici uuid, p_kupa_k integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.duello;
  v_taraf text;
  v_simdi timestamptz;
  v_turlar jsonb;
begin
  select * into d from public.duello where id = p_id;
  if not found or (d.a <> p_kullanici and d.b is distinct from p_kullanici) then raise exception 'duello.bulunamadi'; end if;
  v_taraf := case when d.a = p_kullanici then 'a' else 'b' end;
  if v_taraf = 'a' then update public.duello set son_a = now() where id = p_id;
  else update public.duello set son_b = now() where id = p_id; end if;
  if d.mod = 'asenkron' then perform app.asenkron_ac(p_id, v_taraf);
  else perform app.duello_ilerlet(p_id, p_kupa_k); end if;
  select * into d from public.duello where id = p_id;
  v_simdi := clock_timestamp();

  select jsonb_agg(jsonb_build_object(
    'sira', t.sira,
    'sure_sn', t.sure_sn,
    'acilis', case when d.mod = 'asenkron' then (case v_taraf when 'a' then t.a_acilis else t.b_acilis end) else t.acilis end,
    'son_an', case when d.mod = 'asenkron'
                   then (case v_taraf when 'a' then t.a_acilis else t.b_acilis end) + make_interval(secs => t.sure_sn)
                   else t.son_an end,
    'kapandi', case when d.mod = 'asenkron' then (case v_taraf when 'a' then t.a_dogru is not null else t.b_dogru is not null end)
                    else t.kapandi is not null end,
    'kazanan', t.kazanan,
    'ben_secilen', case v_taraf when 'a' then t.a_secilen else t.b_secilen end,
    'ben_dogru', case v_taraf when 'a' then t.a_dogru else t.b_dogru end,
    'rakip_cevapladi', case v_taraf when 'a' then t.b_dogru is not null else t.a_dogru is not null end,
    'rakip_dogru', case when (d.mod <> 'asenkron' and t.kapandi is not null) or d.durum = 'bitti'
                        then (case v_taraf when 'a' then t.b_dogru else t.a_dogru end) end,
    -- Soru metni: yalnızca bu oyuncu için açılış anı geçtiyse
    'soru', case when coalesce(case when d.mod = 'asenkron' then (case v_taraf when 'a' then t.a_acilis else t.b_acilis end) else t.acilis end, 'infinity') <= v_simdi
                 then jsonb_build_object('id', s.id, 'govde_md', s.govde_md, 'siklar', s.siklar, 'zorluk', coalesce(s.olculmus_zorluk, s.zorluk),
                                         'kazanim', k.kod, 'kazanim_id', k.id) end,
    -- Doğru cevap ve çözüm: yalnızca tur kapandıysa (asenkronda: düello bittiyse)
    'dogru', case when (d.mod <> 'asenkron' and t.kapandi is not null) or d.durum = 'bitti' then s.dogru end,
    'cozum', case when (d.mod <> 'asenkron' and t.kapandi is not null) or d.durum = 'bitti'
                  then case when d.durum = 'bitti' then s.cozum_adimlari else s.cozum_adimlari -> 0 end end
  ) order by t.sira)
  into v_turlar
  from public.duello_tur t
  join public.soru s on s.id = t.soru_id
  join public.kazanim k on k.id = s.kazanim_id
  where t.duello_id = p_id;

  return jsonb_build_object(
    'id', d.id, 'mod', d.mod, 'durum', d.durum, 'taraf', v_taraf, 'davet_kodu', d.davet_kodu,
    'gecerli_tur', d.gecerli_tur, 'tur_sayisi', d.tur_sayisi,
    'skor_ben', case v_taraf when 'a' then d.skor_a else d.skor_b end,
    'skor_rakip', case v_taraf when 'a' then d.skor_b else d.skor_a end,
    'kazanan', case when d.kazanan is null then null when d.kazanan = 'berabere' then 'berabere' when d.kazanan = v_taraf then 'ben' else 'rakip' end,
    'kupa', case v_taraf when 'a' then d.kupa_a else d.kupa_b end,
    'kupa_durduruldu', d.kupa_durduruldu, 'hukmen', d.hukmen,
    'rakip', case
      when d.mod = 'robot' then jsonb_build_object('robot', true, 'takma_ad', 'Robot')
      when (case v_taraf when 'a' then d.b else d.a end) is null then null
      else (select jsonb_build_object('robot', false, 'takma_ad', ku.takma_ad, 'karakter', ka.tur, 'cerceve', ka.cerceve, 'kupa', i.kupa)
            from public.kullanici ku left join public.karakter ka on ka.kullanici_id = ku.id
            left join public.ogrenci_ilerleme i on i.kullanici_id = ku.id
            where ku.id = case v_taraf when 'a' then d.b else d.a end) end,
    'sekme_uyari', case v_taraf when 'a' then d.sekme_a else d.sekme_b end,
    'rakip_tepki', case when (case v_taraf when 'a' then d.tepki_b_zaman else d.tepki_a_zaman end) > v_simdi - interval '5 seconds'
                        then (case v_taraf when 'a' then d.tepki_b else d.tepki_a end) end,
    'rovans_kodu', (select r.davet_kodu from public.duello r where r.id = d.rovans_id and r.durum = 'davet'),
    'son_kullanma', d.son_kullanma,
    'sunucu_zamani', floor(extract(epoch from v_simdi) * 1000),
    'turlar', v_turlar
  );
end $$;

/** Cevap: adil zaman = sunucu alış anı − min(RTT/2, 250 ms). İlk doğru turu alır, yanlış kilitlenir. */
create or replace function public.sistem_duello_cevap(p_id uuid, p_kullanici uuid, p_sira smallint, p_secilen text, p_rtt_ms integer, p_kupa_k integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.duello;
  t public.duello_tur;
  v_taraf text;
  v_simdi timestamptz := clock_timestamp();
  v_adil timestamptz;
  v_acilis timestamptz;
  v_sure integer;
  v_dogru boolean;
  v_soru public.soru;
begin
  select * into d from public.duello where id = p_id;
  if not found or (d.a <> p_kullanici and d.b is distinct from p_kullanici) then raise exception 'duello.bulunamadi'; end if;
  v_taraf := case when d.a = p_kullanici then 'a' else 'b' end;
  if d.mod = 'asenkron' then perform app.asenkron_ac(p_id, v_taraf); else perform app.duello_ilerlet(p_id, p_kupa_k); end if;
  select * into d from public.duello where id = p_id for update;
  if d.durum <> 'oynaniyor' then raise exception 'duello.bitti'; end if;
  select * into t from public.duello_tur where duello_id = p_id and sira = p_sira for update;
  if not found then raise exception 'duello.turYok'; end if;
  v_acilis := case when d.mod = 'asenkron' then (case v_taraf when 'a' then t.a_acilis else t.b_acilis end) else t.acilis end;
  if d.mod <> 'asenkron' and (p_sira <> d.gecerli_tur or t.kapandi is not null) then raise exception 'duello.turKapandi'; end if;
  if v_acilis is null or v_simdi < v_acilis then raise exception 'duello.turAcilmadi'; end if;
  if (v_taraf = 'a' and t.a_dogru is not null) or (v_taraf = 'b' and t.b_dogru is not null) then raise exception 'duello.zatenCevapladin'; end if;

  v_adil := v_simdi - make_interval(secs => least(greatest(coalesce(p_rtt_ms, 0), 0) / 2, 250) / 1000.0);
  v_sure := greatest(0, floor(extract(epoch from (v_adil - v_acilis)) * 1000))::integer;
  if v_sure > t.sure_sn * 1000 then raise exception 'duello.sureDoldu'; end if;
  select * into v_soru from public.soru where id = t.soru_id;
  v_dogru := p_secilen is not null and p_secilen = v_soru.dogru;

  if v_taraf = 'a' then
    update public.duello_tur set a_secilen = p_secilen, a_dogru = v_dogru, a_sure_ms = v_sure where duello_id = p_id and sira = p_sira;
  else
    update public.duello_tur set b_secilen = p_secilen, b_dogru = v_dogru, b_sure_ms = v_sure where duello_id = p_id and sira = p_sira;
  end if;
  if d.mod = 'asenkron' then
    perform app.asenkron_ac(p_id, v_taraf);
  else
    if v_taraf = 'a' then update public.duello set sure_a = sure_a + v_sure where id = p_id;
    else update public.duello set sure_b = sure_b + v_sure where id = p_id; end if;
    select * into t from public.duello_tur where duello_id = p_id and sira = p_sira;
    if v_dogru then
      update public.duello_tur set kazanan = v_taraf, kapandi = v_simdi where duello_id = p_id and sira = p_sira;
      if v_taraf = 'a' then update public.duello set skor_a = skor_a + 1 where id = p_id;
      else update public.duello set skor_b = skor_b + 1 where id = p_id; end if;
    elsif t.a_dogru = false and (t.b_dogru = false or (d.mod = 'robot' and t.robot_dogru = false and t.b_dogru is not null)) then
      update public.duello_tur set kapandi = v_simdi where duello_id = p_id and sira = p_sira;
    elsif d.mod = 'robot' and v_taraf = 'a' and not v_dogru and t.b_dogru is null and t.robot_dogru = false then
      -- Robot da yanlış yapacaksa tur, robotun cevap anında boş kapanır (ilerletmede)
      null;
    end if;
    perform app.duello_ilerlet(p_id, p_kupa_k);
  end if;

  -- Şüpheli kalıp: zor soruda 3 sn altında doğru → inceleme listesi (otomatik ceza yok)
  if v_dogru and coalesce(v_soru.olculmus_zorluk, v_soru.zorluk) >= 7 and v_sure < 3000 then
    insert into public.duello_inceleme (dershane_id, kullanici_id, duello_id, neden)
    values (d.dershane_id, p_kullanici, p_id, format('Zorluk %s soruda %s ms''de doğru', coalesce(v_soru.olculmus_zorluk, v_soru.zorluk), v_sure));
  end if;
  return jsonb_build_object('dogru', v_dogru, 'sure_ms', v_sure);
end $$;

/** Uygulama arka plana alındı / sekme değişti: 1. uyarı, dereceli düelloda 2.'de o tur kaybedilir. */
create or replace function public.sistem_duello_sekme(p_id uuid, p_kullanici uuid, p_kupa_k integer)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare d public.duello; v_taraf text; v_sayi integer;
begin
  select * into d from public.duello where id = p_id for update;
  if not found or d.durum <> 'oynaniyor' or (d.a <> p_kullanici and d.b is distinct from p_kullanici) then return 0; end if;
  v_taraf := case when d.a = p_kullanici then 'a' else 'b' end;
  if v_taraf = 'a' then update public.duello set sekme_a = sekme_a + 1 where id = p_id returning sekme_a into v_sayi;
  else update public.duello set sekme_b = sekme_b + 1 where id = p_id returning sekme_b into v_sayi; end if;
  if d.mod = 'dereceli' and v_sayi >= 2 then
    if v_taraf = 'a' then
      update public.duello_tur set a_dogru = false where duello_id = p_id and sira = d.gecerli_tur and kapandi is null and a_dogru is null
        and acilis <= clock_timestamp();
    else
      update public.duello_tur set b_dogru = false where duello_id = p_id and sira = d.gecerli_tur and kapandi is null and b_dogru is null
        and acilis <= clock_timestamp();
    end if;
    update public.duello_tur set kapandi = clock_timestamp()
    where duello_id = p_id and sira = d.gecerli_tur and kapandi is null and a_dogru = false and b_dogru = false;
    perform app.duello_ilerlet(p_id, p_kupa_k);
  end if;
  return v_sayi;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Dereceli eşleştirme kuyruğu
-- ─────────────────────────────────────────────────────────────

/**
 * Kuyruğa girer/kalır ve eşleşmeyi dener. Aralık: 0-10 sn ±150 Kupa (aynı şube),
 * 10-20 sn ±300 (aynı şube), 20 sn sonra sınırsız ve şubeler arası. Aynı ders.
 * Eşleşirse rakibin kimliğini döner (düelloyu API kurar).
 */
create or replace function public.sistem_duello_eslestir(p_kullanici uuid, p_ders uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  ben public.duello_kuyruk;
  v_rakip uuid;
  v_bekleme numeric;
  v_fark integer;
begin
  insert into public.duello_kuyruk (kullanici_id, dershane_id, sube_id, ders_id, kupa)
  select k.id, k.dershane_id, k.sube_id, p_ders, coalesce(i.kupa, 0)
  from public.kullanici k left join public.ogrenci_ilerleme i on i.kullanici_id = k.id
  where k.id = p_kullanici
  on conflict (kullanici_id) do update set son_yoklama = now(),
    ders_id = excluded.ders_id, giris = case when public.duello_kuyruk.ders_id <> excluded.ders_id then now() else public.duello_kuyruk.giris end;
  -- Eski (yoklamayan) kayıtları temizle
  delete from public.duello_kuyruk where son_yoklama < now() - interval '20 seconds';
  select * into ben from public.duello_kuyruk where kullanici_id = p_kullanici for update;
  v_bekleme := extract(epoch from (now() - ben.giris));
  v_fark := case when v_bekleme < 10 then 150 when v_bekleme < 20 then 300 else 1000000 end;
  select q.kullanici_id into v_rakip
  from public.duello_kuyruk q
  where q.kullanici_id <> p_kullanici and q.dershane_id = ben.dershane_id and q.ders_id = ben.ders_id
    and abs(q.kupa - ben.kupa) <= v_fark
    and (v_bekleme >= 20 or q.sube_id is not distinct from ben.sube_id)
  order by abs(q.kupa - ben.kupa), q.giris
  limit 1
  for update skip locked;
  if v_rakip is not null then
    delete from public.duello_kuyruk where kullanici_id in (p_kullanici, v_rakip);
  end if;
  return v_rakip;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Canlı Soru Saati
-- ─────────────────────────────────────────────────────────────

/** İlk 10 doğru cevap bonus alır (sunucu zamanına göre). */
create or replace function public.sistem_canli_cevap(p_oturum uuid, p_kullanici uuid, p_sira smallint, p_secilen text, p_rtt_ms integer)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.canli_oturum;
  v_acilis timestamptz;
  v_simdi timestamptz := clock_timestamp();
  v_sure integer;
  v_soru public.soru;
  v_dogru boolean;
  v_derece integer;
  v_dershane uuid;
begin
  select * into o from public.canli_oturum where id = p_oturum;
  if not found or p_sira < 1 or p_sira > cardinality(o.sorular) then raise exception 'canli.yok'; end if;
  select dershane_id into v_dershane from public.kullanici where id = p_kullanici;
  if v_dershane <> o.dershane_id then raise exception 'canli.yok'; end if;
  v_acilis := o.baslangic + make_interval(secs => (p_sira - 1) * o.aralik_sn);
  if v_simdi < v_acilis or v_simdi > v_acilis + make_interval(secs => o.sure_sn + 1) then raise exception 'canli.sureDisi'; end if;
  v_sure := greatest(0, floor(extract(epoch from (v_simdi - v_acilis)) * 1000 - least(greatest(coalesce(p_rtt_ms, 0), 0) / 2, 250)))::integer;
  select * into v_soru from public.soru where id = o.sorular[p_sira];
  v_dogru := p_secilen is not null and p_secilen = v_soru.dogru;
  perform pg_advisory_xact_lock(hashtext(p_oturum::text || p_sira::text));
  if v_dogru then
    select count(*) + 1 into v_derece from public.canli_cevap where oturum_id = p_oturum and sira = p_sira and dogru;
  end if;
  insert into public.canli_cevap (oturum_id, kullanici_id, dershane_id, sira, secilen, dogru, sure_ms, derece)
  values (p_oturum, p_kullanici, o.dershane_id, p_sira, p_secilen, v_dogru, v_sure, v_derece);
  insert into public.ogrenci_ilerleme (kullanici_id, dershane_id) values (p_kullanici, o.dershane_id) on conflict do nothing;
  if v_dogru then
    perform app.odul_ver(p_kullanici, 10 * round(coalesce(v_soru.olculmus_zorluk, v_soru.zorluk))::integer + case when v_derece <= 10 then 20 else 0 end,
                         2 + case when v_derece <= 10 then 10 else 0 end);
  end if;
  insert into public.soru_gosterim (kullanici_id, soru_id, dershane_id, baglam, cevaplandi)
  values (p_kullanici, v_soru.id, o.dershane_id, 'canli', now()) on conflict do nothing;
  return jsonb_build_object('dogru', v_dogru, 'derece', v_derece, 'bonus', coalesce(v_derece <= 10, false));
exception when unique_violation then
  raise exception 'canli.zatenCevapladin';
end $$;

/** Canlı oturum durumu ve sonuçlar (şube sıralaması). Soru yalnızca açılış anından sonra; cevap kapandıktan sonra. */
create or replace function public.sistem_canli_durum(p_oturum uuid, p_kullanici uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.canli_oturum;
  v_simdi timestamptz := clock_timestamp();
begin
  select * into o from public.canli_oturum where id = p_oturum;
  if not found then raise exception 'canli.yok'; end if;
  return jsonb_build_object(
    'id', o.id, 'baslangic', o.baslangic, 'sure_sn', o.sure_sn, 'aralik_sn', o.aralik_sn,
    'sunucu_zamani', floor(extract(epoch from v_simdi) * 1000),
    'sorular', (
      select jsonb_agg(jsonb_build_object(
        'sira', i,
        'acilis', o.baslangic + make_interval(secs => (i - 1) * o.aralik_sn),
        'soru', case when v_simdi >= o.baslangic + make_interval(secs => (i - 1) * o.aralik_sn)
                     then jsonb_build_object('govde_md', s.govde_md, 'siklar', s.siklar) end,
        'dogru', case when v_simdi > o.baslangic + make_interval(secs => (i - 1) * o.aralik_sn + o.sure_sn) then s.dogru end,
        'ben', (select jsonb_build_object('secilen', c.secilen, 'dogru', c.dogru, 'derece', c.derece)
                from public.canli_cevap c where c.oturum_id = o.id and c.kullanici_id = p_kullanici and c.sira = i),
        'ilk10', case when v_simdi > o.baslangic + make_interval(secs => (i - 1) * o.aralik_sn + o.sure_sn) then (
          select jsonb_agg(jsonb_build_object('takma_ad', k.takma_ad, 'sure_ms', c.sure_ms) order by c.derece)
          from public.canli_cevap c join public.kullanici k on k.id = c.kullanici_id
          where c.oturum_id = o.id and c.sira = i and c.dogru and c.derece <= 10) end
      ) order by i)
      from generate_subscripts(o.sorular, 1) i join public.soru s on s.id = o.sorular[i]
    ),
    'subeler', (
      select jsonb_agg(x order by x ->> 'dogru' desc)
      from (
        select jsonb_build_object('sube', coalesce(sb.ad, '—'), 'dogru', count(*) filter (where c.dogru), 'katilimci', count(distinct c.kullanici_id)) as x
        from public.canli_cevap c join public.kullanici k on k.id = c.kullanici_id left join public.sube sb on sb.id = k.sube_id
        where c.oturum_id = o.id
        group by sb.ad
      ) y
    )
  );
end $$;

/** Önceden tanımlı tepki (en sık 2 sn'de bir). */
create or replace function public.sistem_duello_tepki(p_id uuid, p_kullanici uuid, p_kod text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare d public.duello;
begin
  if p_kod not in ('iyi_oyun', 'rovans', 'alkis', 'saskin', 'zor_soru', 'tebrikler', 'sans', 'hadi') then raise exception 'duello.tepkiGecersiz'; end if;
  select * into d from public.duello where id = p_id for update;
  if not found or (d.a <> p_kullanici and d.b is distinct from p_kullanici) then raise exception 'duello.bulunamadi'; end if;
  if d.a = p_kullanici then
    if d.tepki_a_zaman > clock_timestamp() - interval '2 seconds' then return; end if;
    update public.duello set tepki_a = p_kod, tepki_a_zaman = clock_timestamp() where id = p_id;
  else
    if d.tepki_b_zaman > clock_timestamp() - interval '2 seconds' then return; end if;
    update public.duello set tepki_b = p_kod, tepki_b_zaman = clock_timestamp() where id = p_id;
  end if;
end $$;

/** Bitmiş düelloya rövanş davetini bağlar (rakip durum ekranında katılır). */
create or replace function public.sistem_duello_rovans_bagla(p_eski uuid, p_yeni uuid)
returns void
language sql
security definer
set search_path = ''
as $$ update public.duello set rovans_id = p_yeni where id = p_eski and rovans_id is null $$;

/** Günün canlı oturumu: (dershane, sınav grubu, gün) başına bir kez, 5 orta zorlukta havuz sorusu. */
create or replace function public.sistem_canli_olustur(p_dershane uuid, p_grup text, p_gun date, p_baslangic timestamptz)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid; v_sorular uuid[];
begin
  select id into v_id from public.canli_oturum where dershane_id = p_dershane and sinav_grubu = p_grup and gun = p_gun;
  if found then return v_id; end if;
  select array_agg(id) into v_sorular from (
    select s.id from public.soru s join public.kazanim k on k.id = s.kazanim_id
    where s.kaynak = 'ai' and s.durum = 'dogrulandi' and s.zorluk_bandi between 2 and 3
      and ((p_grup = 'LGS' and k.sinav_turu = 'LGS') or (p_grup = 'YKS' and k.sinav_turu = 'TYT'))
    order by random() limit 5
  ) x;
  if coalesce(cardinality(v_sorular), 0) < 5 then raise exception 'canli.soruYok'; end if;
  insert into public.canli_oturum (dershane_id, sinav_grubu, gun, baslangic, sorular)
  values (p_dershane, p_grup, p_gun, p_baslangic, v_sorular)
  on conflict (dershane_id, sinav_grubu, gun) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.canli_oturum where dershane_id = p_dershane and sinav_grubu = p_grup and gun = p_gun;
  end if;
  return v_id;
end $$;

/** Sunucu için: özellik bayrağı açık mı (app şeması istemciye açık değil). */
create or replace function public.sistem_ozellik_acik(p_kod text, p_dershane uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select app.ozellik_acik_mi(p_kod, p_dershane) $$;

-- Yetkiler
do $$
declare f text;
begin
  foreach f in array array[
    'public.sistem_duello_sorulari(uuid, uuid, uuid, numeric, integer)',
    'public.sistem_duello_olustur(text, uuid, uuid, uuid, uuid, uuid[], integer[], jsonb, numeric, text)',
    'public.sistem_duello_katil(text, uuid)',
    'public.sistem_duello_durum(uuid, uuid, integer)',
    'public.sistem_duello_cevap(uuid, uuid, smallint, text, integer, integer)',
    'public.sistem_duello_sekme(uuid, uuid, integer)',
    'public.sistem_duello_eslestir(uuid, uuid)',
    'public.sistem_canli_cevap(uuid, uuid, smallint, text, integer)',
    'public.sistem_canli_durum(uuid, uuid)',
    'public.sistem_duello_tepki(uuid, uuid, text)',
    'public.sistem_duello_rovans_bagla(uuid, uuid)',
    'public.sistem_canli_olustur(uuid, text, date, timestamptz)',
    'public.sistem_ozellik_acik(text, uuid)'
  ] loop
    execute format('revoke execute on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
end $$;

-- Rozet metrikleri: düello
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
revoke execute on function public.sistem_oyun_metrikleri(uuid) from public, anon, authenticated;
grant execute on function public.sistem_oyun_metrikleri(uuid) to service_role;
