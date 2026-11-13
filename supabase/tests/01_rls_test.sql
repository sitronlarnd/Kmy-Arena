-- ─────────────────────────────────────────────────────────────
-- RLS, yetki ve davet akışı testleri. scripts/db-test.sh çalıştırır.
-- Her test kendi işleminde (transaction) çalışır ve geri alınır.
-- Hata durumunda psql ON_ERROR_STOP ile durur ve test başarısız olur.
-- ─────────────────────────────────────────────────────────────

create schema if not exists test;
grant usage on schema test to anon, authenticated;

create or replace function test.oturum(p_eposta text)
returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', app.sabit_uuid('kullanici:' || p_eposta), 'role', 'authenticated')::text, true)
$$;

create or replace function test.dogrula(p_kosul boolean, p_mesaj text)
returns void language plpgsql as $$
begin
  if p_kosul is distinct from true then raise exception 'TEST BAŞARISIZ: %', p_mesaj; end if;
end $$;
grant execute on function test.dogrula(boolean, text) to anon, authenticated;

/** Verilen dershanenin satırlarından kaç tanesi görünüyor (dershane_id sütunu olan tüm tablolar). */
create or replace function test.gorunen_yabanci_satir(p_dershane uuid)
returns table (tablo text, adet bigint)
language plpgsql security invoker as $$
declare t record;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join pg_class pc on pc.relname = c.table_name
    join pg_namespace n on n.oid = pc.relnamespace and n.nspname = 'public'
    where c.table_schema = 'public' and c.column_name = 'dershane_id' and pc.relkind in ('r', 'p', 'v')
      and not pc.relispartition
  loop
    tablo := t.table_name;
    execute format('select count(*) from public.%I where dershane_id = $1', t.table_name) into adet using p_dershane;
    return next;
  end loop;
end $$;
grant execute on function test.gorunen_yabanci_satir(uuid) to anon, authenticated;

\echo '▶ 1. Tenant izolasyonu: A dershanesinin her rolü B dershanesinin HİÇBİR satırını okuyamaz'
do $$
declare
  hesap text;
  r record;
begin
  foreach hesap in array array[
    'kurucu@demo.kmyarena.demo', 'mudur.kadikoy@demo.kmyarena.demo', 'rehber@demo.kmyarena.demo',
    'sekreter@demo.kmyarena.demo', 'ogretmen.mat@demo.kmyarena.demo', 'ogrenci01@demo.kmyarena.demo',
    'veli01@demo.kmyarena.demo']
  loop
    perform test.oturum(hesap);
    set local role authenticated;
    for r in select * from test.gorunen_yabanci_satir(app.sabit_uuid('dershane:rakip')) loop
      perform test.dogrula(r.adet = 0, format('%s, rakip dershanenin %s tablosundan %s satır gördü', hesap, r.tablo, r.adet));
    end loop;
    reset role;
  end loop;
  -- Ters yön
  perform test.oturum('kurucu@rakip.kmyarena.demo');
  set local role authenticated;
  for r in select * from test.gorunen_yabanci_satir(app.sabit_uuid('dershane:demo')) loop
    perform test.dogrula(r.adet = 0, format('rakip kurucu, demo dershanenin %s tablosundan %s satır gördü', r.tablo, r.adet));
  end loop;
  reset role;
end $$;

\echo '▶ 2. Öğrenci: soru tablosunu (cevap anahtarı) okuyamaz, başkasının kimliğini/becerisini göremez'
begin;
select test.oturum('ogrenci01@demo.kmyarena.demo');
set local role authenticated;
do $$
begin
  perform test.dogrula((select count(*) from public.soru) = 0, 'öğrenci soru tablosunu okudu');
  perform test.dogrula((select count(*) from public.kullanici) = 1, 'öğrenci başka kullanıcıların kimliğini gördü');
  perform test.dogrula((select count(*) from public.beceri where kullanici_id <> auth.uid()) = 0, 'öğrenci başkasının becerisini gördü');
  perform test.dogrula((select count(*) from public.beceri) = 1, 'öğrenci kendi becerisini göremedi');
  perform test.dogrula((select count(*) from public.ai_gorev_ayari) = 0, 'öğrenci AI ayarlarını gördü');
  perform test.dogrula((select count(*) from public.profil_ozet(array[app.sabit_uuid('kullanici:ogrenci02@demo.kmyarena.demo')])) = 1,
                       'profil_ozet takma adı döndürmedi');
  perform test.dogrula((select count(*) from public.profil_ozet(array[app.sabit_uuid('kullanici:ogrenci1@rakip.kmyarena.demo')])) = 0,
                       'profil_ozet başka dershanenin öğrencisini döndürdü');
end $$;
rollback;

\echo '▶ 3. Puan/XP/beceri/cevap/havuz istemciden yazılamaz'
begin;
select test.oturum('ogrenci01@demo.kmyarena.demo');
set local role authenticated;
do $$
begin
  begin
    update public.beceri set theta = 3000 where kullanici_id = auth.uid();
    raise exception 'TEST BAŞARISIZ: öğrenci beceri puanını değiştirdi';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.cevap (dershane_id, kullanici_id, soru_id, kazanim_id, baglam, secilen, dogru_mu, sure_ms, xp)
    values (app.dershane_id(), auth.uid(), app.sabit_uuid('soru:demo1'), app.sabit_uuid('kazanim:M.8.1.2.1'), 'antrenman', 'B', true, 1000, 9999);
    raise exception 'TEST BAŞARISIZ: öğrenci cevap/XP yazdı';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.soru_gosterim (kullanici_id, soru_id, dershane_id, baglam)
    values (auth.uid(), app.sabit_uuid('soru:demo3'), app.dershane_id(), 'antrenman');
    raise exception 'TEST BAŞARISIZ: öğrenci gösterim kaydı yazdı';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.kullanici set dershane_id = app.sabit_uuid('dershane:rakip') where id = auth.uid();
    raise exception 'TEST BAŞARISIZ: öğrenci kendi dershanesini değiştirdi';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.kullanici set veli_onayi = true where id = auth.uid();
    raise exception 'TEST BAŞARISIZ: öğrenci veli onayını kendisi verdi';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.dershane set lisans_durumu = 'aktif', ogrenci_limiti = 99999;
    raise exception 'TEST BAŞARISIZ: lisans alanı istemciden değişti';
  exception when insufficient_privilege then null;
  end;
  -- İzin verilen tek alan: takma ad
  update public.kullanici set takma_ad = 'yeniTakma' where id = auth.uid();
  perform test.dogrula((select takma_ad::text from public.kullanici where id = auth.uid()) = 'yeniTakma', 'takma ad güncellenemedi');
end $$;
rollback;

\echo '▶ 4. Rol kapsamları: kurucu, şube müdürü, sekreter, öğretmen, rehber, veli'
begin;
select test.oturum('kurucu@demo.kmyarena.demo');
set local role authenticated;
do $$ begin
  perform test.dogrula((select count(*) from public.kullanici where tur = 'ogrenci') = 40, 'kurucu 40 öğrenciyi görmeli');
  perform test.dogrula((select count(*) from public.kullanici where tur = 'personel') = 8, 'kurucu tüm personeli (8) görmeli');
  perform test.dogrula((select count(*) from public.beceri) = 1, 'kurucu akademik veriyi görmeli');
end $$;
rollback;

begin;
select test.oturum('mudur.kadikoy@demo.kmyarena.demo');
set local role authenticated;
do $$ begin
  perform test.dogrula((select count(*) from public.kullanici where tur = 'ogrenci') = 20, 'şube müdürü yalnızca kendi şubesinin 20 öğrencisini görmeli');
  perform test.dogrula((select count(*) from public.kullanici where tur = 'ogrenci' and sube_id = app.sabit_uuid('sube:uskudar')) = 0,
                       'Kadıköy müdürü Üsküdar öğrencisini gördü');
  -- Başka şubeye davet kodu üretemez
  begin
    perform public.davet_kodu_olustur(app.sabit_uuid('sube:uskudar'), null);
    raise exception 'TEST BAŞARISIZ: şube müdürü başka şubeye davet kodu üretti';
  exception when insufficient_privilege then null;
  end;
  perform test.dogrula(length(public.davet_kodu_olustur(app.sabit_uuid('sube:kadikoy'), app.sabit_uuid('sinif:8A'))) = 8,
                       'şube müdürü kendi şubesine kod üretemedi');
end $$;
rollback;

begin;
select test.oturum('sekreter@demo.kmyarena.demo');
set local role authenticated;
do $$ begin
  perform test.dogrula((select count(*) from public.kullanici where tur = 'ogrenci') = 20, 'sekreter kendi şubesindeki öğrencilerin kimliğini görmeli');
  perform test.dogrula((select count(*) from public.beceri) = 0, 'sekreter akademik veri gördü');
  perform test.dogrula((select count(*) from public.cevap) = 0, 'sekreter cevap verisi gördü');
  perform test.dogrula(not exists (select 1 from public.yetkilerim() where yetki_kod = 'ogrenci.akademik_oku'), 'sekreterde akademik yetki var');
end $$;
rollback;

begin;
select test.oturum('ogretmen.mat@demo.kmyarena.demo');
set local role authenticated;
do $$ begin
  perform test.dogrula((select count(*) from public.kullanici where tur = 'ogrenci') = 20, 'matematik öğretmeni yalnızca 8-A ve 12-SAY (20) öğrencisini görmeli');
  perform test.dogrula((select count(*) from public.beceri) = 1, 'öğretmen sınıfındaki öğrencinin becerisini görmeli');
end $$;
rollback;

begin;
select test.oturum('ogretmen.tr@demo.kmyarena.demo');
set local role authenticated;
do $$ begin
  perform test.dogrula((select count(*) from public.kullanici where tur = 'ogrenci' and sube_id = app.sabit_uuid('sube:kadikoy')) = 0,
                       'Üsküdar öğretmeni atanmadığı Kadıköy öğrencisini gördü');
  perform test.dogrula((select count(*) from public.beceri) = 0, 'öğretmen atanmadığı sınıfın becerisini gördü');
end $$;
rollback;

begin;
select test.oturum('rehber@demo.kmyarena.demo');
set local role authenticated;
do $$ begin
  perform test.dogrula((select count(*) from public.kullanici where tur = 'ogrenci') = 40, 'rehber 40 öğrenciyi görmeli');
  perform test.dogrula((select count(*) from public.beceri) = 1, 'rehber akademik veriyi görmeli');
end $$;
rollback;

begin;
select test.oturum('veli01@demo.kmyarena.demo');
set local role authenticated;
do $$ begin
  perform test.dogrula((select count(*) from public.kullanici where tur = 'ogrenci') = 1, 'veli yalnızca kendi çocuğunu görmeli');
  perform test.dogrula((select count(*) from public.beceri) = 1, 'veli çocuğunun becerisini görmeli');
end $$;
rollback;

\echo '▶ 5. Anonim erişim: hiçbir kullanıcı verisi yok, yalnızca uygulama sürüm ayarı'
begin;
set local role anon;
do $$ begin
  perform test.dogrula((select count(*) from public.kullanici) = 0, 'anonim kullanıcı tablosunu okudu');
  perform test.dogrula((select count(*) from public.dershane) = 0, 'anonim dershane tablosunu okudu');
  perform test.dogrula((select count(*) from public.teklif) = 0, 'anonim teklifleri okudu');
  perform test.dogrula((select count(*) from public.uygulama_ayari) = 1, 'anonim uygulama ayarını okuyamadı');
end $$;
rollback;

\echo '▶ 6. Yetki yükseltme engelleri'
begin;
select test.oturum('kurucu@demo.kmyarena.demo');
set local role authenticated;
do $$ begin
  begin
    insert into public.rol_yetki (dershane_id, rol_kod, yetki_kod) values (app.dershane_id(), 'ogretmen', 'merkez.ai_yonet');
    raise exception 'TEST BAŞARISIZ: kurucu merkez yetkisi dağıttı';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.kullanici_rol (kullanici_id, rol_kod, dershane_id) values (auth.uid(), 'merkez_sahip', app.dershane_id());
    raise exception 'TEST BAŞARISIZ: kurucu kendine merkez rolü verdi';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.kullanici_rol (kullanici_id, rol_kod, dershane_id)
    values (app.sabit_uuid('kullanici:ogrenci1@rakip.kmyarena.demo'), 'ogretmen', app.dershane_id());
    raise exception 'TEST BAŞARISIZ: kurucu başka dershanenin kullanıcısına rol verdi';
  exception when insufficient_privilege then null;
  end;
  -- Meşru ince ayar: öğretmenden AI ile soru üretme yetkisini kaldırmak
  insert into public.rol_yetki (dershane_id, rol_kod, yetki_kod)
  select app.dershane_id(), 'ogretmen', y from unnest(array['odev.yonet', 'soru.yukle', 'moderasyon.yap']) y;
end $$;
-- ince ayar etkili mi?
select test.oturum('ogretmen.mat@demo.kmyarena.demo');
do $$ begin
  perform test.dogrula(not app.yetkisi_var('soru.ai_uret', app.dershane_id()), 'dershane ince ayarı uygulanmadı');
  perform test.dogrula(app.yetkisi_var('soru.yukle', app.dershane_id()), 'ince ayar diğer yetkileri sildi');
end $$;
rollback;

\echo '▶ 7. Davet koduyla katılım'
begin;
insert into auth.users (id, email) values (app.sabit_uuid('kullanici:yeni@test'), 'yeni@test');
select test.oturum('yeni@test');
set local role authenticated;
do $$
declare v jsonb;
begin
  begin
    perform public.davet_kodu_kullan('YANLISKD', 'Yeni', 'Öğrenci', 'yeniogr', 2012);
    raise exception 'TEST BAŞARISIZ: geçersiz kod kabul edildi';
  exception when raise_exception then
    perform test.dogrula(sqlerrm = 'giris.kodGecersiz', 'beklenen hata kodGecersiz, gelen: ' || sqlerrm);
  end;
  v := public.davet_kodu_kullan(' dema8akd ', 'Yeni', 'Öğrenci', 'yeniogr', 2012);
  perform test.dogrula(v ->> 'rol' = 'ogrenci', 'rol dönmedi');
  perform test.dogrula(app.dershane_id() = app.sabit_uuid('dershane:demo'), 'dershaneye bağlanmadı');
  perform test.dogrula((select veli_onayi from public.kullanici where id = auth.uid()) = false, '14 yaşındaki öğrencide veli onayı otomatik verildi');
  perform test.dogrula(exists (select 1 from public.sinif_uyelik where kullanici_id = auth.uid() and sinif_id = app.sabit_uuid('sinif:8A')), 'sınıfa eklenmedi');
  perform test.dogrula(app.yetkisi_var('soru.coz', app.dershane_id()), 'öğrenci yetkisi verilmedi');
  begin
    perform public.davet_kodu_kullan('DEMA8AKD', 'Yeni', 'Öğrenci', 'baska', 2012);
    raise exception 'TEST BAŞARISIZ: aynı hesap iki kez kayıt oldu';
  exception when raise_exception then
    perform test.dogrula(sqlerrm = 'giris.zatenKayitli', 'beklenen zatenKayitli, gelen: ' || sqlerrm);
  end;
end $$;
rollback;

begin;
update public.dershane set ogrenci_limiti = 2 where id = app.sabit_uuid('dershane:rakip');
insert into auth.users (id, email) values (app.sabit_uuid('kullanici:limit@test'), 'limit@test');
select test.oturum('limit@test');
set local role authenticated;
do $$ begin
  perform public.davet_kodu_kullan('RAKP8RKD', 'Limit', 'Test', 'limittest', 2012);
  raise exception 'TEST BAŞARISIZ: öğrenci limiti aşıldı';
exception when raise_exception then
  perform test.dogrula(sqlerrm = 'giris.lisansDolu', 'beklenen lisansDolu, gelen: ' || sqlerrm);
end $$;
rollback;

begin;
insert into auth.users (id, email) values (app.sabit_uuid('kullanici:bireysel@test'), 'bireysel@test');
select test.oturum('bireysel@test');
set local role authenticated;
do $$ begin
  perform public.bireysel_kayit('Bağımsız', 'Öğrenci', 'bagimsiz', 2006);
  perform test.dogrula(app.dershane_id() = app.sabit_uuid('dershane:bireysel'), 'açık kayıt bireysel tenanta düşmedi');
  perform test.dogrula((select veli_onayi from public.kullanici where id = auth.uid()), '18+ öğrencide veli onayı gerekmemeli');
end $$;
rollback;

\echo '▶ 8. Özellik bayrakları ve FNV kova eşliği'
do $$ begin
  perform test.dogrula(app.ozellik_acik_mi('duello', app.sabit_uuid('dershane:demo')), 'demo dershanede düello açık olmalı');
  perform test.dogrula(not app.ozellik_acik_mi('duello', app.sabit_uuid('dershane:rakip')), 'dershane bayrağı genel bayrağı ezmeli');
  perform test.dogrula(not app.ozellik_acik_mi('fotograftan_coz', app.sabit_uuid('dershane:rakip')), 'Temel paket fotoğraftan çözü kapatmalı');
  perform test.dogrula(app.ozellik_acik_mi('dershaneler_arasi_lig', app.sabit_uuid('dershane:demo')) = false, 'genel kapalı bayrak açık geldi');
  -- packages/shared kova() ile aynı sonuç (TS: 53, 47, 95)
  perform test.dogrula(app.kova('topluluk:d-5') = 53, 'FNV kova TS ile uyuşmuyor (1)');
  perform test.dogrula(app.kova('duello:8f9a1c3e-0000-4000-8000-000000000001') = 47, 'FNV kova TS ile uyuşmuyor (2)');
  perform test.dogrula(app.kova('x') = 95, 'FNV kova TS ile uyuşmuyor (3)');
end $$;
begin;
select test.oturum('ogrenci01@demo.kmyarena.demo');
set local role authenticated;
do $$ begin
  perform test.dogrula((select count(*) from public.ozellik_bayragi where dershane_id is not null) = 0, 'başka dershanenin bayrağı göründü');
  perform test.dogrula((select acik from public.ozelliklerim() where kod = 'duello'), 'ozelliklerim() düelloyu kapalı döndürdü');
end $$;
rollback;

\echo '▶ 9. Soru havuzu: aynı öğrenciye aynı soru iki kez gösterilemez'
do $$ begin
  begin
    insert into public.soru_gosterim (kullanici_id, soru_id, dershane_id, baglam)
    values (app.sabit_uuid('kullanici:ogrenci01@demo.kmyarena.demo'), app.sabit_uuid('soru:demo2'), app.sabit_uuid('dershane:demo'), 'duello');
    raise exception 'TEST BAŞARISIZ: aynı soru aynı öğrenciye ikinci kez kaydedildi';
  exception when unique_violation then null;
  end;
  perform test.dogrula((select zorluk_bandi from public.soru where id = app.sabit_uuid('soru:demo3')) = 4, 'zorluk bandı yanlış');
end $$;

\echo '▶ 10. Cevap tablosu bölümlenmiş, bölümler RLS li'
do $$ begin
  perform test.dogrula((select count(*) from pg_inherits where inhparent = 'public.cevap'::regclass) >= 6, 'cevap bölümleri eksik');
  perform test.dogrula(not exists (
    select 1 from pg_class c join pg_inherits i on i.inhrelid = c.oid
    where i.inhparent = 'public.cevap'::regclass and not c.relrowsecurity), 'RLS kapalı cevap bölümü var');
  perform test.dogrula(to_regclass('public.' || app.cevap_bolumu_olustur((now() + interval '6 months')::date)) is not null, 'yeni bölüm oluşturulamadı');
end $$;

begin;
select test.oturum('kurucu@demo.kmyarena.demo');
set local role authenticated;
do $$ begin
  begin
    perform public.sistem_cevap_bolumu_olustur();
    raise exception 'TEST BAŞARISIZ: sistem fonksiyonu istemciden çağrıldı';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

\echo '▶ 11. AI modelleri kararlaştırılan Claude modelleri'
do $$ begin
  perform test.dogrula((select model_birincil from public.ai_gorev_ayari where gorev = 'soru_uretim' and durum = 'yayinda') = 'claude-sonnet-4-6', 'üretici modeli');
  perform test.dogrula((select model_birincil from public.ai_gorev_ayari where gorev = 'soru_dogrulama' and durum = 'yayinda') = 'claude-sonnet-5-5', 'doğrulayıcı modeli');
  perform test.dogrula(not exists (select 1 from public.ai_gorev_ayari where model_birincil not like 'claude-%' or model_yedek not like 'claude-%'), 'Claude dışı model var');
end $$;

\echo '▶ 12. Soru döngüsü: seçim, cevap işleme, yarış kontrolü, hata defteri, tespit'
do $$
declare
  o uuid := app.sabit_uuid('kullanici:ogrenci02@demo.kmyarena.demo');
  kz uuid := app.sabit_uuid('kazanim:M.8.1.2.1');
  r jsonb; r2 jsonb; s1 uuid; s2 uuid; t uuid; hd uuid;
  n integer;
begin
  -- Seviye eğrisi TS ile aynı (seviyeIcinXp: 2→100, 3→303)
  perform test.dogrula(app.xpden_seviye(0) = 1 and app.xpden_seviye(99) = 1 and app.xpden_seviye(100) = 2
    and app.xpden_seviye(302) = 2 and app.xpden_seviye(303) = 3, 'seviye eğrisi TS ile uyuşmuyor');

  r := public.sistem_soru_sec(o, kz, 3, 'antrenman');
  s1 := (r -> 'soru' ->> 'id')::uuid;
  perform test.dogrula(s1 is not null, 'soru seçilemedi');
  perform test.dogrula((r -> 'soru' ->> 'zorluk')::numeric = 3, 'hedefe en yakın soru seçilmedi');
  r2 := public.sistem_soru_sec(o, kz, 3, 'antrenman');
  s2 := (r2 -> 'soru' ->> 'id')::uuid;
  perform test.dogrula(s2 is distinct from s1, 'aynı soru aynı öğrenciye ikinci kez seçildi');

  -- Yarış: θ değişmişse reddedilir
  begin
    perform public.sistem_cevap_isle(jsonb_build_object('kullanici_id', o, 'soru_id', s1, 'dogru_mu', true,
      'secilen', 'A', 'sure_ms', 30000, 'theta_once', 1234, 'theta_sonra', 1250, 'beklenen', 0.5,
      'xp', 10, 'altin', 2, 'ustalik', 'kesfedilmedi', 'ozellik', 'zeka'));
    raise exception 'TEST BAŞARISIZ: yarış kontrolü çalışmadı';
  exception when others then
    perform test.dogrula(sqlerrm = 'beceri.yarisma', 'beklenmeyen hata: ' || sqlerrm);
  end;

  r := public.sistem_cevap_isle(jsonb_build_object('kullanici_id', o, 'soru_id', s1, 'dogru_mu', true,
    'secilen', 'A', 'sure_ms', 30000, 'theta_once', 1000, 'theta_sonra', 1012.5, 'beklenen', 0.69,
    'xp', 150, 'altin', 2, 'ustalik', 'kesfedilmedi', 'ozellik', 'zeka'));
  perform test.dogrula((r ->> 'xp_toplam')::int = 150 and (r ->> 'seviye')::int = 2 and (r ->> 'seviye_atladi')::boolean, 'ilerleme yanlış: ' || r::text);
  perform test.dogrula((select theta from public.beceri where kullanici_id = o and kazanim_id = kz) = 1012.5, 'beceri yazılmadı');
  perform test.dogrula((select (ozellik_puanlari ->> 'zeka')::int from public.ogrenci_ilerleme where kullanici_id = o) = 1, 'özellik puanı');
  begin
    perform public.sistem_cevap_isle(jsonb_build_object('kullanici_id', o, 'soru_id', s1, 'dogru_mu', true,
      'secilen', 'A', 'sure_ms', 1, 'theta_once', 1012.5, 'theta_sonra', 1020, 'beklenen', 0.5,
      'xp', 999, 'altin', 99, 'ustalik', 'kesfedilmedi'));
    raise exception 'TEST BAŞARISIZ: aynı soru iki kez cevaplandı';
  exception when others then
    perform test.dogrula(sqlerrm = 'soru.zatenCevaplandi', 'beklenmeyen hata: ' || sqlerrm);
  end;

  -- Yanlış → hata defteri; tekrar doğru → aşama ilerler
  r := public.sistem_cevap_isle(jsonb_build_object('kullanici_id', o, 'soru_id', s2, 'dogru_mu', false,
    'secilen', 'B', 'sure_ms', 40000, 'theta_once', 1012.5, 'theta_sonra', 990, 'beklenen', 0.6,
    'xp', 0, 'altin', 0, 'ustalik', 'kesfedilmedi', 'tekrar_araliklari_gun', '[1,3,7,21]'::jsonb));
  perform test.dogrula(r ->> 'hata_defteri' = 'eklendi', 'yanlış cevap deftere düşmedi');
  select id into hd from public.hata_defteri where kullanici_id = o and soru_id = s2;
  perform test.dogrula((select sonraki_tekrar from public.hata_defteri where id = hd) > now() + interval '23 hours', 'ilk tekrar 1 gün sonra olmalı');
  perform test.dogrula((select son10 from public.beceri where kullanici_id = o and kazanim_id = kz) = '{1,0}'::smallint[], 'son10 yanlış');

  insert into public.soru (id, kaynak, kazanim_id, sinav_turu, soru_tipi, zorluk, govde_md, siklar, dogru, durum)
  values (app.sabit_uuid('soru:test-tekrar'), 'ai', kz, 'LGS', 'islem', 4, 'x', '{"A":"1","B":"2","C":"3","D":"4"}', 'C', 'dogrulandi');
  r := public.sistem_soru_sec(o, kz, 4, 'tekrar', hd);
  perform test.dogrula((r -> 'soru' ->> 'id')::uuid = app.sabit_uuid('soru:test-tekrar'), 'tekrar sorusu seçilmedi');
  r := public.sistem_cevap_isle(jsonb_build_object('kullanici_id', o, 'soru_id', app.sabit_uuid('soru:test-tekrar'), 'dogru_mu', true,
    'secilen', 'C', 'sure_ms', 20000, 'theta_once', 990, 'theta_sonra', 1000, 'beklenen', 0.6,
    'xp', 10, 'altin', 2, 'ustalik', 'kesfedilmedi', 'tekrar_araliklari_gun', '[1,3,7,21]'::jsonb));
  perform test.dogrula(r ->> 'hata_defteri' = 'ilerledi', 'tekrar aşaması ilerlemedi');
  perform test.dogrula((select asama from public.hata_defteri where id = hd) = 1
    and (select sonraki_tekrar from public.hata_defteri where id = hd) > now() + interval '71 hours', 'ikinci tekrar 3 gün sonra olmalı');

  -- Tespit: hedef soru sayısına ulaşınca biter, dersin çözülmemiş kazanımları tespit θ'sını alır
  insert into public.tespit_oturumu (dershane_id, kullanici_id, ders_id, hedef_soru)
  values (app.sabit_uuid('dershane:demo'), app.sabit_uuid('kullanici:ogrenci03@demo.kmyarena.demo'), app.sabit_uuid('ders:lgs_matematik'), 4)
  returning id into t;
  for n in 1..4 loop
    insert into public.soru (id, kaynak, kazanim_id, sinav_turu, soru_tipi, zorluk, govde_md, siklar, dogru, durum)
    values (app.sabit_uuid('soru:test-tespit' || n), 'ai', kz, 'LGS', 'islem', 5, 'x', '{"A":"1","B":"2","C":"3","D":"4"}', 'A', 'dogrulandi');
    r := public.sistem_soru_sec(app.sabit_uuid('kullanici:ogrenci03@demo.kmyarena.demo'), kz, 5, 'tespit', null, t);
    r := public.sistem_cevap_isle(jsonb_build_object('kullanici_id', app.sabit_uuid('kullanici:ogrenci03@demo.kmyarena.demo'),
      'soru_id', (r -> 'soru' ->> 'id')::uuid, 'dogru_mu', true, 'secilen', 'A', 'sure_ms', 30000,
      'theta_once', coalesce((select theta from public.beceri where kullanici_id = app.sabit_uuid('kullanici:ogrenci03@demo.kmyarena.demo') and kazanim_id = kz), 1000),
      'theta_sonra', 1000 + n * 20, 'beklenen', 0.5, 'xp', 10, 'altin', 2, 'ustalik', 'kesfedilmedi', 'tespit_theta', 1000 + n * 60));
  end loop;
  perform test.dogrula((r ->> 'tespit_bitti')::boolean, 'tespit bitmedi');
  perform test.dogrula((select theta from public.beceri b join public.kazanim k on k.id = b.kazanim_id
    where b.kullanici_id = app.sabit_uuid('kullanici:ogrenci03@demo.kmyarena.demo') and k.kod = 'M.8.1.1.1') = 1240, 'tespit θ kazanımlara yayılmadı');
  perform test.dogrula((select theta from public.beceri where kullanici_id = app.sabit_uuid('kullanici:ogrenci03@demo.kmyarena.demo') and kazanim_id = kz) = 1080,
    'çözülmüş kazanımın θ değeri tespitle ezildi');
end $$;

begin;
select test.oturum('ogrenci02@demo.kmyarena.demo');
set local role authenticated;
do $$ begin
  begin
    perform public.sistem_soru_sec(auth.uid(), app.sabit_uuid('kazanim:M.8.1.2.1'), 3, 'antrenman');
    raise exception 'TEST BAŞARISIZ: istemci soru seçim fonksiyonunu çağırdı';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.sistem_cevap_isle('{}'::jsonb);
    raise exception 'TEST BAŞARISIZ: istemci cevap işleme fonksiyonunu çağırdı';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.ogrenci_ilerleme set xp = 999999 where kullanici_id = auth.uid();
    raise exception 'TEST BAŞARISIZ: istemci XP yazdı';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.soru_gosterim set ipucu_sayisi = 0 where kullanici_id = auth.uid();
    raise exception 'TEST BAŞARISIZ: istemci ipucu sayacını sıfırladı';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.uretim_kilidi;
    raise exception 'TEST BAŞARISIZ: istemci üretim kilidini okudu';
  exception when insufficient_privilege then null;
  end;
  perform test.dogrula((select count(*) from public.ogrenci_ilerleme) = 1, 'öğrenci başkasının ilerlemesini görüyor');
  perform test.dogrula((select count(*) from public.hata_defterim()) = 1, 'hata defterim yanlış');
end $$;
rollback;

\echo '✔ Tüm veritabanı testleri geçti'
