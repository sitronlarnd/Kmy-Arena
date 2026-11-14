-- ─────────────────────────────────────────────────────────────
-- 0025 · Öğretmen araçları
--  • Soru arşivi: öğretmenin kendi soruları (elle, fotoğraftan AI okuma, AI ile
--    ürettirip onaylama), paylaşım (kendim / dershane), çözüm (video/görsel/metin).
--    Arşiv soruları öğrencinin günlük akışına girmez; yalnız ödev, turnuva ve
--    canlı sınıf yarışmasında kullanılır.
--  • Hocanın konu anlatımı: kazanıma bağlı video/metin; aynı kazanımdaki AI
--    sorularının çözümünde öğrenciye kart olarak gösterilir.
--  • Arşivden sabit sorulu ödev (odev.soru_ids).
--  • Sınıf turnuvası: düello eleme ağacı (8/16/32), maçlar 24 saatlik düello.
--  • Canlı sınıf yarışması: projeksiyon ekranı + öğrenciler PIN ile katılır.
-- ─────────────────────────────────────────────────────────────

-- ── Soru arşivi ──
alter table public.soru
  add column paylasim text not null default 'kendim' check (paylasim in ('kendim', 'dershane')),
  add column ogretmen_cozum jsonb; -- {tur: video|gorsel|metin|baglanti, yol?, url?, metin?}

drop policy if exists soru_ogretmen_oku on public.soru;
create policy soru_ogretmen_oku on public.soru for select to authenticated
  using (kaynak = 'ogretmen' and dershane_id = app.dershane_id()
         and (ogretmen_id = auth.uid() or (paylasim = 'dershane' and (app.yetkisi_var('soru.yukle', dershane_id) or app.yetkisi_var('odev.yonet', dershane_id, app.sube_id())))));
create policy soru_ogretmen_ekle on public.soru for insert to authenticated
  with check (kaynak = 'ogretmen' and dershane_id = app.dershane_id() and ogretmen_id = auth.uid() and app.yetkisi_var('soru.yukle', dershane_id)
              and durum in ('uretildi', 'dogrulandi'));
create policy soru_ogretmen_guncelle on public.soru for update to authenticated
  using (kaynak = 'ogretmen' and ogretmen_id = auth.uid())
  with check (kaynak = 'ogretmen' and ogretmen_id = auth.uid() and dershane_id = app.dershane_id() and durum in ('uretildi', 'dogrulandi', 'emekli'));
-- İstemciden yazma 0006'da kapatılmıştı; öğretmen soruları için yalnız içerik sütunları açılır (RLS ek olarak denetler).
grant insert (kaynak, dershane_id, ogretmen_id, kazanim_id, sinav_turu, soru_tipi, zorluk, tahmini_sure_sn, govde_md, gorsel, siklar, dogru,
              cozum_adimlari, celdirici_notlari, ipuclari, paylasim, ogretmen_cozum, durum, uretici_model, dogrulayici_model) on public.soru to authenticated;
grant update (kazanim_id, sinav_turu, soru_tipi, zorluk, tahmini_sure_sn, govde_md, gorsel, siklar, dogru, cozum_adimlari, ipuclari, paylasim, ogretmen_cozum, durum)
  on public.soru to authenticated;
grant delete on public.soru to authenticated;
create policy soru_ogretmen_sil on public.soru for delete to authenticated
  using (kaynak = 'ogretmen' and ogretmen_id = auth.uid() and cevap_sayisi = 0);

create table public.konu_anlatimi (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  ogretmen_id uuid references public.kullanici (id) on delete set null,
  kazanim_id uuid not null references public.kazanim (id),
  baslik text not null check (char_length(baslik) between 2 and 120),
  tur text not null check (tur in ('video', 'metin', 'baglanti')),
  yol text,       -- depolama yolu (video)
  url text check (url is null or url ~ '^https://'),
  metin text check (metin is null or char_length(metin) <= 4000),
  izlenme integer not null default 0,
  olusturma timestamptz not null default now()
);
create index konu_anlatimi_kazanim on public.konu_anlatimi (dershane_id, kazanim_id);
alter table public.konu_anlatimi enable row level security;
grant select, insert, update, delete on public.konu_anlatimi to authenticated;
create policy konu_anlatimi_oku on public.konu_anlatimi for select to authenticated using (dershane_id = app.dershane_id());
create policy konu_anlatimi_yaz on public.konu_anlatimi for all to authenticated
  using (ogretmen_id = auth.uid())
  with check (ogretmen_id = auth.uid() and dershane_id = app.dershane_id() and app.yetkisi_var('soru.yukle', dershane_id));

-- Öğrenciye: kazanımdaki en yeni konu anlatımı (servis)
create or replace function public.sistem_konu_anlatimi(p_kullanici uuid, p_kazanim uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'baslik', a.baslik, 'tur', a.tur, 'yol', a.yol, 'url', a.url, 'metin', a.metin,
                            'ogretmen', coalesce(o.ad || ' ' || left(o.soyad, 1) || '.', 'Öğretmen'))
  from public.konu_anlatimi a join public.kullanici k on k.id = p_kullanici and k.dershane_id = a.dershane_id
  left join public.kullanici o on o.id = a.ogretmen_id
  where a.kazanim_id = p_kazanim
  order by a.olusturma desc limit 1
$$;

-- ── Arşivden sabit sorulu ödev ──
alter table public.odev add column soru_ids uuid[];
alter table public.odev drop constraint if exists odev_soru_sayisi_check;
alter table public.odev add constraint odev_soru_sayisi_check check (soru_sayisi between 1 and 50);

create or replace function public.panel_odev_arsivden(
  p_baslik text, p_sorular uuid[], p_siniflar uuid[], p_ogrenciler uuid[], p_son_tarih timestamptz
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_d uuid := app.dershane_id(); v_id uuid; v_s uuid; v_n integer; v_kz uuid[];
begin
  if v_d is null or not app.yetkisi_var('odev.yonet', v_d, app.sube_id()) then raise exception 'panel.yetkisiz'; end if;
  if p_son_tarih <= now() then raise exception 'panel.tarihGecersiz'; end if;
  if coalesce(cardinality(p_sorular), 0) not between 1 and 50 then raise exception 'panel.soruSec'; end if;
  if (select count(*) from public.soru s where s.id = any (p_sorular) and s.kaynak = 'ogretmen' and s.dershane_id = v_d and s.durum = 'dogrulandi'
        and (s.ogretmen_id = auth.uid() or s.paylasim = 'dershane')) <> cardinality(p_sorular) then
    raise exception 'panel.soruSec';
  end if;
  foreach v_s in array coalesce(p_siniflar, '{}') loop
    if not app.sinif_okuyabilir(v_s) then raise exception 'panel.yetkisiz'; end if;
  end loop;
  if exists (select 1 from unnest(coalesce(p_ogrenciler, '{}')) o where not app.ogrenci_akademik_okuyabilir(o)) then raise exception 'panel.yetkisiz'; end if;
  select array_agg(distinct kazanim_id) into v_kz from public.soru where id = any (p_sorular);
  insert into public.odev (dershane_id, olusturan_id, baslik, kazanim_ids, soru_sayisi, zorluk_modu, son_tarih, soru_ids)
  values (v_d, auth.uid(), p_baslik, v_kz, cardinality(p_sorular), 'sabit', p_son_tarih, p_sorular)
  returning id into v_id;
  insert into public.odev_atama (odev_id, kullanici_id, dershane_id)
  select distinct v_id, x.id, v_d from (
    select u.kullanici_id as id from public.sinif_uyelik u where u.sinif_id = any (coalesce(p_siniflar, '{}')) and u.rol = 'ogrenci'
    union select unnest(coalesce(p_ogrenciler, '{}'))
  ) x join public.kullanici k on k.id = x.id and k.dershane_id = v_d and k.tur = 'ogrenci'
  on conflict do nothing;
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'panel.ogrenciYok'; end if;
  return v_id;
end $$;
grant execute on function public.panel_odev_arsivden(text, uuid[], uuid[], uuid[], timestamptz) to authenticated;

/** Sabit sorulu ödevde sıradaki soru: gösterim kaydı açılır, soru satırı döner (servis). */
create or replace function public.sistem_odev_soru_ver(p_kullanici uuid, p_odev uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare o public.odev; v_soru public.soru; v_d uuid;
begin
  select * into o from public.odev where id = p_odev;
  if o.soru_ids is null or not exists (select 1 from public.odev_atama where odev_id = p_odev and kullanici_id = p_kullanici) then return null; end if;
  select dershane_id into v_d from public.kullanici where id = p_kullanici;
  select s.* into v_soru from unnest(o.soru_ids) with ordinality u(id, n) join public.soru s on s.id = u.id
  where not exists (select 1 from public.cevap c where c.kullanici_id = p_kullanici and c.soru_id = s.id and c.baglam = 'odev' and c.olusturma >= o.olusturma)
  order by u.n limit 1;
  if v_soru.id is null then return jsonb_build_object('soru', null); end if;
  insert into public.soru_gosterim (kullanici_id, soru_id, dershane_id, baglam)
  values (p_kullanici, v_soru.id, v_d, 'odev') on conflict do nothing;
  update public.soru set gosterim_sayisi = gosterim_sayisi + 1, son_gosterim = now() where id = v_soru.id;
  return jsonb_build_object('soru', to_jsonb(v_soru));
end $$;

-- ── Sınıf turnuvası ──
create table public.turnuva (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  sinif_id uuid references public.sinif (id) on delete set null,
  olusturan_id uuid references public.kullanici (id) on delete set null,
  ad text not null check (char_length(ad) between 2 and 80),
  ders_id uuid not null references public.ders (id),
  boyut smallint not null check (boyut in (4, 8, 16, 32)),
  durum text not null default 'surdu' check (durum in ('surdu', 'bitti', 'iptal')),
  tur smallint not null default 1,
  kazanan_id uuid references public.kullanici (id) on delete set null,
  odul text,
  olusturma timestamptz not null default now(),
  bitis timestamptz
);
create table public.turnuva_mac (
  id uuid primary key default gen_random_uuid(),
  turnuva_id uuid not null references public.turnuva (id) on delete cascade,
  dershane_id uuid not null references public.dershane (id) on delete cascade,
  tur smallint not null,
  sira smallint not null,
  a uuid references public.kullanici (id) on delete set null,
  b uuid references public.kullanici (id) on delete set null,
  duello_id uuid references public.duello (id) on delete set null,
  kazanan uuid references public.kullanici (id) on delete set null,
  durum text not null default 'bekliyor' check (durum in ('bekliyor', 'hazir', 'oynaniyor', 'bitti')),
  unique (turnuva_id, tur, sira)
);
create index turnuva_mac_duello on public.turnuva_mac (duello_id);
alter table public.turnuva enable row level security;
alter table public.turnuva_mac enable row level security;
grant select on public.turnuva, public.turnuva_mac to authenticated;
create policy turnuva_oku on public.turnuva for select to authenticated using (dershane_id = app.dershane_id());
create policy turnuva_mac_oku on public.turnuva_mac for select to authenticated using (dershane_id = app.dershane_id());

/** Turnuva kur: katılımcılar seviyeye göre tohumlanır (1-8, 4-5…), eksik yerler bay geçer. */
create or replace function public.panel_turnuva_olustur(p_ad text, p_sinif uuid, p_ders uuid, p_boyut integer, p_ogrenciler uuid[] default null, p_odul text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_d uuid := app.dershane_id(); v_id uuid; v_l uuid[]; v_n integer; v_b integer; i integer; v_tohum integer[];
begin
  if v_d is null or not app.sinif_okuyabilir(p_sinif) or not app.yetkisi_var('odev.yonet', v_d, app.sube_id()) then raise exception 'panel.yetkisiz'; end if;
  if p_boyut not in (4, 8, 16, 32) then raise exception 'panel.turnuvaBoyut'; end if;
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
grant execute on function public.panel_turnuva_olustur(text, uuid, uuid, integer, uuid[], text) to authenticated;

/** Turu biten turnuvayı bir sonraki tura taşır; final bittiyse kazananı ödüllendirir. */
create or replace function app.turnuva_ilerlet(p_turnuva uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.turnuva; v_kalan integer; v_mac integer; i integer; m1 public.turnuva_mac; m2 public.turnuva_mac;
begin
  select * into t from public.turnuva where id = p_turnuva for update;
  if t.durum <> 'surdu' then return; end if;
  select count(*) into v_kalan from public.turnuva_mac where turnuva_id = t.id and tur = t.tur and durum <> 'bitti';
  if v_kalan > 0 then return; end if;
  select count(*) into v_mac from public.turnuva_mac where turnuva_id = t.id and tur = t.tur;
  if v_mac = 1 then
    select * into m1 from public.turnuva_mac where turnuva_id = t.id and tur = t.tur;
    update public.turnuva set durum = 'bitti', kazanan_id = m1.kazanan, bitis = now() where id = t.id;
    if m1.kazanan is not null then
      perform app.odul_ver(m1.kazanan, 150, 100);
      perform app.bildirim_ekle(m1.kazanan, 'turnuva', 'Turnuva şampiyonu!', t.ad || ' turnuvasını kazandın! +150 XP, +100 Altın', jsonb_build_object('yol', '/turnuva/' || t.id));
    end if;
    return;
  end if;
  for i in 1..(v_mac / 2) loop
    select * into m1 from public.turnuva_mac where turnuva_id = t.id and tur = t.tur and sira = 2 * i - 1;
    select * into m2 from public.turnuva_mac where turnuva_id = t.id and tur = t.tur and sira = 2 * i;
    insert into public.turnuva_mac (turnuva_id, dershane_id, tur, sira, a, b, durum)
    values (t.id, t.dershane_id, t.tur + 1, i, m1.kazanan, m2.kazanan, 'hazir')
    on conflict (turnuva_id, tur, sira) do nothing;
  end loop;
  update public.turnuva_mac set kazanan = coalesce(a, b), durum = 'bitti' where turnuva_id = t.id and tur = t.tur + 1 and (a is null or b is null);
  update public.turnuva set tur = tur + 1 where id = t.id;
  perform app.turnuva_ilerlet(t.id); -- ardışık baylar
end $$;

/** Düello bitince bağlı turnuva maçını sonuçlandır. */
create or replace function app.tg_turnuva_duello() returns trigger
language plpgsql security definer set search_path = '' as $$
declare m public.turnuva_mac;
begin
  if new.durum in ('bitti', 'iptal') and old.durum is distinct from new.durum then
    select * into m from public.turnuva_mac where duello_id = new.id and durum <> 'bitti';
    if found then
      update public.turnuva_mac set durum = 'bitti',
        kazanan = case
          when new.kazanan = 'a' then new.a when new.kazanan = 'b' then new.b
          when new.sure_a <= new.sure_b then new.a else new.b end
      where id = m.id;
      perform app.turnuva_ilerlet(m.turnuva_id);
    end if;
  end if;
  return new;
end $$;
create trigger turnuva_duello after update of durum on public.duello for each row execute function app.tg_turnuva_duello();

/** API: düellosu açılmamış hazır maçlar. */
create or replace function public.sistem_turnuva_hazir_maclar()
returns table (mac_id uuid, dershane_id uuid, ders_id uuid, a uuid, b uuid, turnuva text)
language sql security definer set search_path = '' as $$
  select m.id, m.dershane_id, t.ders_id, m.a, m.b, t.ad
  from public.turnuva_mac m join public.turnuva t on t.id = m.turnuva_id and t.durum = 'surdu'
  where m.durum = 'hazir' and m.a is not null and m.b is not null and m.duello_id is null
  limit 50
$$;
create or replace function public.sistem_turnuva_mac_bagla(p_mac uuid, p_duello uuid, p_a uuid, p_b uuid, p_ad text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.turnuva_mac set duello_id = p_duello, durum = 'oynaniyor' where id = p_mac and duello_id is null;
  perform app.bildirim_ekle(p_a, 'turnuva', 'Turnuva maçın hazır', p_ad || ': 24 saat içinde düellonu oyna!', jsonb_build_object('yol', '/duello/' || p_duello));
  perform app.bildirim_ekle(p_b, 'turnuva', 'Turnuva maçın hazır', p_ad || ': 24 saat içinde düellonu oyna!', jsonb_build_object('yol', '/duello/' || p_duello));
end $$;
/** Süresi dolan turnuva düelloları: oynayan geçer; ikisi de oynamadıysa üst tohum geçer. */
create or replace function public.sistem_turnuva_sure_doldu() returns integer
language plpgsql security definer set search_path = '' as $$
declare r record; n integer := 0; v_a integer; v_b integer;
begin
  for r in select m.id, m.turnuva_id, m.a, m.b, d.id as did from public.turnuva_mac m join public.duello d on d.id = m.duello_id
           where m.durum = 'oynaniyor' and d.durum = 'oynaniyor' and d.son_kullanma < now() loop
    select count(*) filter (where a_dogru is not null), count(*) filter (where b_dogru is not null) into v_a, v_b from public.duello_tur where duello_id = r.did;
    update public.turnuva_mac set durum = 'bitti', kazanan = case when v_b > v_a then r.b else r.a end where id = r.id;
    perform app.turnuva_ilerlet(r.turnuva_id);
    n := n + 1;
  end loop;
  return n;
end $$;

/** Öğrenci: dershanemin süren / son turnuvaları ve ağaçları. */
create or replace function public.turnuvalarim() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id, 'ad', t.ad, 'durum', t.durum, 'tur', t.tur, 'boyut', t.boyut, 'odul', t.odul,
    'ders', (select ad from public.ders where id = t.ders_id),
    'kazanan', app.gorunen_ad(t.kazanan_id),
    'benim', exists (select 1 from public.turnuva_mac m where m.turnuva_id = t.id and auth.uid() in (m.a, m.b)),
    'macim', (select jsonb_build_object('duello_id', m.duello_id, 'durum', m.durum, 'tur', m.tur)
              from public.turnuva_mac m where m.turnuva_id = t.id and auth.uid() in (m.a, m.b) and m.durum <> 'bitti' order by m.tur desc limit 1),
    'maclar', (select jsonb_agg(jsonb_build_object('tur', m.tur, 'sira', m.sira, 'a', app.gorunen_ad(m.a), 'b', app.gorunen_ad(m.b),
                                                   'kazanan', case when m.kazanan = m.a then 'a' when m.kazanan = m.b then 'b' end, 'durum', m.durum,
                                                   'ben', case when m.a = auth.uid() then 'a' when m.b = auth.uid() then 'b' end) order by m.tur, m.sira)
               from public.turnuva_mac m where m.turnuva_id = t.id)
  ) order by t.olusturma desc), '[]')
  from public.turnuva t
  where t.dershane_id = app.dershane_id() and (t.durum = 'surdu' or t.bitis > now() - interval '7 days')
    and (t.sinif_id is null or exists (select 1 from public.sinif_uyelik u where u.sinif_id = t.sinif_id and u.kullanici_id = auth.uid())
         or exists (select 1 from public.turnuva_mac m where m.turnuva_id = t.id and auth.uid() in (m.a, m.b)))
$$;
grant execute on function public.turnuvalarim() to authenticated;

-- gorunen_ad öğrenciye de açık olmalı (takma ad); app şeması istemciye kapalı olduğundan security definer içinde kullanılıyor.

-- ── Canlı sınıf yarışması ──
alter table public.canli_oturum
  add column sinif_id uuid references public.sinif (id) on delete cascade,
  add column pin text check (pin is null or pin ~ '^[0-9]{6}$'),
  add column olusturan_id uuid references public.kullanici (id) on delete set null,
  add column ad text;
alter table public.canli_oturum drop constraint if exists canli_oturum_dershane_id_sinav_grubu_gun_key;
create unique index canli_oturum_gunluk on public.canli_oturum (dershane_id, sinav_grubu, gun) where sinif_id is null;
create unique index canli_oturum_pin on public.canli_oturum (dershane_id, pin) where pin is not null;

create or replace function public.sistem_canli_olustur(p_dershane uuid, p_grup text, p_gun date, p_baslangic timestamptz)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_sorular uuid[];
begin
  select id into v_id from public.canli_oturum where dershane_id = p_dershane and sinav_grubu = p_grup and gun = p_gun and sinif_id is null;
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
  on conflict (dershane_id, sinav_grubu, gun) where sinif_id is null do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.canli_oturum where dershane_id = p_dershane and sinav_grubu = p_grup and gun = p_gun and sinif_id is null;
  end if;
  return v_id;
end $$;

/** Öğretmen: sınıfı için 10 dakikalık canlı yarışma (1 dk sonra başlar). Sorular arşivden ya da AI havuzundan. */
create or replace function public.panel_canli_baslat(p_sinif uuid, p_ders uuid, p_adet integer default 10, p_sure integer default 40, p_sorular uuid[] default null, p_ad text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_d uuid := app.dershane_id(); v_sinav text; v_grup text; v_sorular uuid[]; v_pin text; v_id uuid; v_bas timestamptz := now() + interval '60 seconds';
begin
  if v_d is null or not app.sinif_okuyabilir(p_sinif) or not app.yetkisi_var('odev.yonet', v_d, app.sube_id()) then raise exception 'panel.yetkisiz'; end if;
  select sinav_turu into v_sinav from public.sinif where id = p_sinif and dershane_id = v_d;
  v_grup := case when v_sinav = 'LGS' then 'LGS' else 'YKS' end;
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
grant execute on function public.panel_canli_baslat(uuid, uuid, integer, integer, uuid[], text) to authenticated;

/** Projeksiyon ekranı: aktif soru, cevap sayısı, dağılım (kapanınca) ve sıralama. */
create or replace function public.panel_canli_ekran(p_oturum uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare o public.canli_oturum; v_simdi timestamptz := clock_timestamp(); v_sira integer; v_acilis timestamptz; v_kapandi boolean;
begin
  select * into o from public.canli_oturum where id = p_oturum and dershane_id = app.dershane_id();
  if not found or o.sinif_id is null or not app.sinif_okuyabilir(o.sinif_id) then raise exception 'panel.yetkisiz'; end if;
  v_sira := least(cardinality(o.sorular), greatest(0, floor(extract(epoch from (v_simdi - o.baslangic)) / o.aralik_sn)::int + 1));
  v_acilis := o.baslangic + make_interval(secs => (greatest(v_sira, 1) - 1) * o.aralik_sn);
  v_kapandi := v_simdi > v_acilis + make_interval(secs => o.sure_sn);
  return jsonb_build_object(
    'ad', o.ad, 'pin', o.pin, 'baslangic', o.baslangic, 'sure_sn', o.sure_sn, 'aralik_sn', o.aralik_sn,
    'soru_sayisi', cardinality(o.sorular), 'sira', v_sira, 'acilis', v_acilis, 'kapandi', v_kapandi,
    'bitti', v_simdi > o.baslangic + make_interval(secs => (cardinality(o.sorular) - 1) * o.aralik_sn + o.sure_sn),
    'sunucu_zamani', floor(extract(epoch from v_simdi) * 1000),
    'katilimci', (select count(distinct kullanici_id) from public.canli_cevap where oturum_id = o.id),
    'soru', case when v_sira >= 1 then (select jsonb_build_object('govde_md', s.govde_md, 'siklar', s.siklar, 'dogru', case when v_kapandi then s.dogru end)
                                       from public.soru s where s.id = o.sorular[v_sira]) end,
    'cevap_sayisi', (select count(*) from public.canli_cevap where oturum_id = o.id and sira = v_sira),
    'dagilim', case when v_kapandi then (select jsonb_object_agg(coalesce(secilen, '-'), n) from (
                 select secilen, count(*) n from public.canli_cevap where oturum_id = o.id and sira = v_sira group by secilen) x) end,
    'siralama', (select coalesce(jsonb_agg(x order by (x ->> 'puan')::int desc, (x ->> 'sure')::int), '[]') from (
                   select jsonb_build_object('ad', app.gorunen_ad(c.kullanici_id), 'puan', sum(case when c.dogru then 100 + greatest(0, 50 - coalesce(c.derece, 50) * 5) else 0 end),
                                             'dogru', count(*) filter (where c.dogru), 'sure', sum(c.sure_ms)) x
                   from public.canli_cevap c where c.oturum_id = o.id
                     and c.sira <= case when v_kapandi then v_sira else v_sira - 1 end
                   group by c.kullanici_id order by 1 desc limit 10) y)
  );
end $$;
grant execute on function public.panel_canli_ekran(uuid) to authenticated;

/** Öğrenci PIN ile katılır (servis): kendi dershanesinde, bitmemiş oturum. */
create or replace function public.sistem_canli_pin(p_kullanici uuid, p_pin text)
returns uuid language sql stable security definer set search_path = '' as $$
  select o.id from public.canli_oturum o join public.kullanici k on k.id = p_kullanici and k.dershane_id = o.dershane_id
  where o.pin = p_pin and now() < o.baslangic + make_interval(secs => cardinality(o.sorular) * o.aralik_sn + 900)
  order by o.baslangic desc limit 1
$$;

-- Bildirim türü: turnuva
alter table public.bildirim_kuyruk drop constraint if exists bildirim_kuyruk_tur_check;
alter table public.bildirim_kuyruk add constraint bildirim_kuyruk_tur_check
  check (tur in ('duello_davet', 'odev', 'topluluk_cevap', 'topluluk_kabul', 'seri', 'klan_savas', 'duyuru', 'turnuva'));

revoke all on function public.sistem_konu_anlatimi(uuid, uuid), public.sistem_odev_soru_ver(uuid, uuid), public.sistem_turnuva_hazir_maclar(),
  public.sistem_turnuva_mac_bagla(uuid, uuid, uuid, uuid, text), public.sistem_turnuva_sure_doldu(), public.sistem_canli_pin(uuid, text) from public, anon, authenticated;
grant execute on function public.sistem_konu_anlatimi(uuid, uuid), public.sistem_odev_soru_ver(uuid, uuid), public.sistem_turnuva_hazir_maclar(),
  public.sistem_turnuva_mac_bagla(uuid, uuid, uuid, uuid, text), public.sistem_turnuva_sure_doldu(), public.sistem_canli_pin(uuid, text) to service_role;

/** Sunucu için: kullanıcının kendi dershanesinde (herhangi bir şubede) yetkisi var mı? */
create or replace function public.sistem_yetkisi_var(p_kullanici uuid, p_yetki text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.kullanici_rol kr join public.kullanici k on k.id = kr.kullanici_id and k.dershane_id = kr.dershane_id
    where kr.kullanici_id = p_kullanici and k.silinme_talebi is null
      and (exists (select 1 from public.rol_yetki ry where ry.dershane_id = kr.dershane_id and ry.rol_kod = kr.rol_kod and ry.yetki_kod = p_yetki)
           or (not exists (select 1 from public.rol_yetki ry where ry.dershane_id = kr.dershane_id and ry.rol_kod = kr.rol_kod)
               and exists (select 1 from public.rol_yetki ry where ry.dershane_id is null and ry.rol_kod = kr.rol_kod and ry.yetki_kod = p_yetki))))
$$;
revoke all on function public.sistem_yetkisi_var(uuid, text) from public, anon, authenticated;
grant execute on function public.sistem_yetkisi_var(uuid, text) to service_role;

create or replace function public.panel_turnuva_iptal(p_turnuva uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare t public.turnuva;
begin
  select * into t from public.turnuva where id = p_turnuva and dershane_id = app.dershane_id();
  if not found or not (t.olusturan_id = auth.uid() or app.yetkisi_var('odul.yonet', t.dershane_id)) then raise exception 'panel.yetkisiz'; end if;
  update public.turnuva set durum = 'iptal', bitis = now() where id = p_turnuva and durum = 'surdu';
end $$;
grant execute on function public.panel_turnuva_iptal(uuid) to authenticated;
