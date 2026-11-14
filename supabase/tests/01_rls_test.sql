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

\echo '▶ 11. AI modelleri: üretici ve doğrulayıcı kararlaştırılan modeller'
do $$ begin
  perform test.dogrula((select model_birincil from public.ai_gorev_ayari where gorev = 'soru_uretim' and durum = 'yayinda') = 'mimo-v2.6-flash', 'üretici modeli');
  perform test.dogrula(not exists (select 1 from public.ai_gorev_ayari where durum = 'yayinda' and 'claude-sonnet-4-6' in (model_birincil, coalesce(model_yedek, ''))), 'sonnet-4-6 yayında');
  perform test.dogrula((select model_birincil from public.ai_gorev_ayari where gorev = 'soru_dogrulama' and durum = 'yayinda') = 'gpt-6-luna', 'doğrulayıcı modeli');
  perform test.dogrula(not exists (select 1 from public.ai_gorev_ayari where durum = 'yayinda' and 'gemini-3.6-flash' in (model_birincil, coalesce(model_yedek, ''))), 'gemini yayında');
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

\echo '▶ 13. Paket ve sınıfa göre ders kapsamı (LGS / YKS, alan)'
do $$
declare n integer;
begin
  -- 8. sınıf öğrencisi (ogrenci01, 8-A) → yalnızca LGS
  perform test.dogrula(not exists (select 1 from public.sistem_ogrenci_dersleri(app.sabit_uuid('kullanici:ogrenci01@demo.kmyarena.demo')) where sinav_turu <> 'LGS'), 'LGS öğrencisi YKS dersi görüyor');
  perform test.dogrula((select count(*) from public.sistem_ogrenci_dersleri(app.sabit_uuid('kullanici:ogrenci01@demo.kmyarena.demo'))) = 6, 'LGS ders sayısı');
  -- 12-SAY öğrencisi (ogrenci11) → TYT + SAY AYT, sözel AYT yok
  perform test.dogrula(exists (select 1 from public.sistem_ogrenci_dersleri(app.sabit_uuid('kullanici:ogrenci11@demo.kmyarena.demo')) where kod = 'ayt_fizik'), 'SAY öğrencisi AYT fizik görmüyor');
  perform test.dogrula(not exists (select 1 from public.sistem_ogrenci_dersleri(app.sabit_uuid('kullanici:ogrenci11@demo.kmyarena.demo')) where kod in ('ayt_edebiyat', 'ydt_ingilizce') or sinav_turu = 'LGS'), 'SAY öğrencisi alan dışı ders görüyor');
  -- 12-EA öğrencisi (ogrenci31) → edebiyat var, fizik yok
  perform test.dogrula(exists (select 1 from public.sistem_ogrenci_dersleri(app.sabit_uuid('kullanici:ogrenci31@demo.kmyarena.demo')) where kod = 'ayt_edebiyat')
    and not exists (select 1 from public.sistem_ogrenci_dersleri(app.sabit_uuid('kullanici:ogrenci31@demo.kmyarena.demo')) where kod = 'ayt_fizik'), 'EA kapsamı yanlış');
  -- Paket YKS'yi kapsamıyorsa YKS öğrencisi hiçbir ders göremez
  update public.paket set sinav_gruplari = '{LGS}' where kod = 'pro';
  select count(*) into n from public.sistem_ogrenci_dersleri(app.sabit_uuid('kullanici:ogrenci11@demo.kmyarena.demo'));
  perform test.dogrula(n = 0, 'paket dışı grup açıldı');
  update public.paket set sinav_gruplari = '{LGS,YKS}' where kod = 'pro';
  -- Elle atanan grup sınıfı ezer
  update public.kullanici set sinav_grubu = 'YKS', yks_alani = 'DIL' where id = app.sabit_uuid('kullanici:ogrenci02@demo.kmyarena.demo');
  perform test.dogrula(exists (select 1 from public.sistem_ogrenci_dersleri(app.sabit_uuid('kullanici:ogrenci02@demo.kmyarena.demo')) where kod = 'ydt_ingilizce'), 'elle atama çalışmadı');
  update public.kullanici set sinav_grubu = null, yks_alani = null where id = app.sabit_uuid('kullanici:ogrenci02@demo.kmyarena.demo');
  perform test.dogrula((select count(*) from public.kazanim) >= 500, 'müfredat eksik');
end $$;

begin;
select test.oturum('ogrenci01@demo.kmyarena.demo');
set local role authenticated;
do $$ begin
  perform test.dogrula((select count(*) from public.derslerim()) = 6 and (select bool_and(sinav_grubu = 'LGS') from public.derslerim()), 'derslerim() yanlış');
  begin
    perform public.sistem_ogrenci_dersleri(auth.uid());
    raise exception 'TEST BAŞARISIZ: istemci sistem fonksiyonunu çağırdı';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.kullanici set sinav_grubu = 'YKS' where id = auth.uid();
    raise exception 'TEST BAŞARISIZ: öğrenci kendi sınav grubunu değiştirdi';
  exception when insufficient_privilege then null;
  end;
end $$;
rollback;

\echo '▶ 14. Oyun katmanı: seri, ödül/lig, görev, rozet, mağaza, lig kapanışı'
do $$
declare
  o uuid := app.sabit_uuid('kullanici:ogrenci04@demo.kmyarena.demo');
  o2 uuid := app.sabit_uuid('kullanici:ogrenci06@demo.kmyarena.demo');
  r jsonb; g uuid; n integer; v_hafta date := app.hafta_basi(app.bugun());
begin
  insert into public.ogrenci_ilerleme (kullanici_id, dershane_id, gunluk_hedef, altin)
  values (o, app.sabit_uuid('dershane:demo'), 3, 500), (o2, app.sabit_uuid('dershane:demo'), 3, 0);

  -- Seri: hedefe ulaşınca başlar, ertesi gün artar, boşlukta dondurucu harcanır, yetmezse sıfırlanır
  perform app.seri_isle(o); perform app.seri_isle(o); r := app.seri_isle(o);
  perform test.dogrula(r ->> 'seri_durum' = 'basladi' and (r ->> 'seri_gun')::int = 1, 'seri başlamadı: ' || r::text);
  r := app.seri_isle(o);
  perform test.dogrula(r ->> 'seri_durum' is null and (r ->> 'gunluk_soru')::int = 4, 'aynı gün ikinci kez işlendi');
  update public.ogrenci_ilerleme set seri_son_gun = app.bugun() - 1, gunluk_gun = app.bugun() - 1 where kullanici_id = o;
  perform app.seri_isle(o); perform app.seri_isle(o); r := app.seri_isle(o);
  perform test.dogrula(r ->> 'seri_durum' = 'artti' and (r ->> 'seri_gun')::int = 2, 'seri artmadı');
  update public.ogrenci_ilerleme set seri_son_gun = app.bugun() - 3, gunluk_gun = app.bugun() - 3, seri_dondurucu = 2 where kullanici_id = o;
  perform app.seri_isle(o); perform app.seri_isle(o); r := app.seri_isle(o);
  perform test.dogrula(r ->> 'seri_durum' = 'donduruldu' and (r ->> 'seri_gun')::int = 3
    and (select seri_dondurucu from public.ogrenci_ilerleme where kullanici_id = o) = 0, 'dondurucu çalışmadı');
  update public.ogrenci_ilerleme set seri_son_gun = app.bugun() - 3, gunluk_gun = app.bugun() - 3 where kullanici_id = o;
  perform app.seri_isle(o); perform app.seri_isle(o); r := app.seri_isle(o);
  perform test.dogrula(r ->> 'seri_durum' = 'sifirlandi' and (r ->> 'seri_gun')::int = 1
    and (select onceki_seri from public.ogrenci_ilerleme where kullanici_id = o) = 3, 'seri sıfırlanmadı');

  -- Seriyi geri kazan görevi kırılan seriyi geri verir
  insert into public.kullanici_gorev (dershane_id, kullanici_id, gorev_kod, tur, donem, baslik, hedef, odul_xp, odul_altin)
  values (app.sabit_uuid('dershane:demo'), o, 'seri_geri_kazan', 'gunluk', app.bugun(), 'x', 6, 30, 30) returning id into g;
  r := public.sistem_gorev_ilerlet(o, jsonb_build_array(jsonb_build_object('id', g, 'ilerleme', 6)));
  perform test.dogrula(jsonb_array_length(r) = 1 and (select seri_gun from public.ogrenci_ilerleme where kullanici_id = o) = 4, 'seri geri kazanılmadı');
  perform test.dogrula((select altin from public.ogrenci_ilerleme where kullanici_id = o) = 530, 'görev ödülü verilmedi');
  r := public.sistem_gorev_ilerlet(o, jsonb_build_array(jsonb_build_object('id', g, 'ilerleme', 6)));
  perform test.dogrula(jsonb_array_length(r) = 0, 'görev ödülü iki kez verildi');

  -- Ödül → lig grubuna otomatik katılım ve haftalık XP
  perform app.odul_ver(o, 40, 0);
  perform app.odul_ver(o2, 10, 0);
  perform test.dogrula((select xp from public.lig_uyelik where kullanici_id = o and hafta = v_hafta) = 70, 'lig XP');
  perform test.dogrula((select grup_id from public.lig_uyelik where kullanici_id = o) = (select grup_id from public.lig_uyelik where kullanici_id = o2), 'aynı kademe aynı gruba düşmedi');

  -- Rozet: bir kez verilir, Altın ödülü eklenir
  r := public.sistem_rozet_ver(o, '[{"kod":"ilk_soru","altin":20},{"kod":"seri_3","altin":30}]');
  perform test.dogrula(jsonb_array_length(r) = 2 and (select altin from public.ogrenci_ilerleme where kullanici_id = o) = 580, 'rozet ödülü');
  r := public.sistem_rozet_ver(o, '[{"kod":"ilk_soru","altin":20}]');
  perform test.dogrula(jsonb_array_length(r) = 0, 'rozet iki kez verildi');

  -- Mağaza
  perform test.dogrula(public.sistem_satin_al(o, 'cerceve_altin', 300, false, 2::smallint) = 280, 'satın alma');
  begin perform public.sistem_satin_al(o, 'cerceve_altin', 10, false, 2::smallint); raise exception 'TEST BAŞARISIZ: aynı eşya iki kez';
  exception when others then perform test.dogrula(sqlerrm = 'magaza.zatenVar', sqlerrm); end;
  begin perform public.sistem_satin_al(o2, 'cerceve_mor', 100, false, 2::smallint); raise exception 'TEST BAŞARISIZ: Altın yetmeden alındı';
  exception when others then perform test.dogrula(sqlerrm = 'magaza.yetersizAltin', sqlerrm); end;
  perform public.sistem_satin_al(o, 'seri_dondurucu', 100, true, 2::smallint);
  perform public.sistem_satin_al(o, 'seri_dondurucu', 100, true, 2::smallint);
  begin perform public.sistem_satin_al(o, 'seri_dondurucu', 10, true, 2::smallint); raise exception 'TEST BAŞARISIZ: 3. dondurucu';
  exception when others then perform test.dogrula(sqlerrm = 'magaza.dondurucuDolu', sqlerrm); end;
  perform test.dogrula((select altin from public.ogrenci_ilerleme where kullanici_id = o) = 80, 'Altın düşmedi');

  -- Metrikler
  r := public.sistem_oyun_metrikleri(o);
  perform test.dogrula((r ->> 'envanter')::int = 1 and (r ->> 'ders_sayisi')::int = 6, 'metrikler: ' || r::text);

  -- Lig kapanışı: küçük grupta birinci yükselir, kimse düşmez
  r := public.sistem_lig_kapat(v_hafta);
  -- (grupta önceki testlerin öğrencileri de var; < 10 kişi → yalnızca en yüksek XP yükselir, düşen yok)
  perform test.dogrula((select count(*) from public.lig_uyelik u where u.grup_id = (select grup_id from public.lig_uyelik where kullanici_id = o) and u.sonuc = 'yukseldi') = 1
    and (select i.lig_adim from public.lig_uyelik u join public.ogrenci_ilerleme i on i.kullanici_id = u.kullanici_id
         where u.grup_id = (select grup_id from public.lig_uyelik where kullanici_id = o) and u.sira = 1) = 2
    and (select sonuc from public.lig_uyelik where kullanici_id = o2) = 'kaldi'
    and not exists (select 1 from public.lig_uyelik where sonuc = 'dustu'), 'lig kapanışı yanlış');
  select sum(lig_adim) into n from public.ogrenci_ilerleme;
  r := public.sistem_lig_kapat(v_hafta);
  perform test.dogrula((r ->> 'grup')::int = 0 and (select sum(lig_adim) from public.ogrenci_ilerleme) = n, 'lig iki kez kapandı');
  update public.lig_uyelik set sonuc = null, sira = null where hafta = v_hafta;
  update public.lig_grubu set kapandi = null where hafta = v_hafta;
end $$;

begin;
select test.oturum('ogrenci04@demo.kmyarena.demo');
set local role authenticated;
do $$ begin
  perform test.dogrula((select count(*) from public.lig_grubum()) >= 2 and (select bool_or(ben) from public.lig_grubum()), 'lig_grubum');
  perform test.dogrula((select count(*) from public.siralama('dershane', 'hafta')) >= 2, 'dershane sıralaması');
  perform test.dogrula(not exists (select 1 from public.siralama('dershane', 'tum') where takma_ad is null), 'sıralamada takma ad yok');
  begin perform 1 from public.siralama('dershaneler', 'hafta'); raise exception 'TEST BAŞARISIZ: kapalı dershaneler arası sıralama';
  exception when others then perform test.dogrula(sqlerrm = 'siralama.kapali', sqlerrm); end;
  begin insert into public.envanter (kullanici_id, esya_kod, dershane_id) values (auth.uid(), 'x', app.dershane_id()); raise exception 'TEST BAŞARISIZ: istemci envantere yazdı';
  exception when insufficient_privilege then null; end;
  begin insert into public.kullanici_rozet (kullanici_id, rozet_kod, dershane_id) values (auth.uid(), 'x', app.dershane_id()); raise exception 'TEST BAŞARISIZ: istemci rozet yazdı';
  exception when insufficient_privilege then null; end;
  begin update public.kullanici_gorev set ilerleme = 999 where kullanici_id = auth.uid(); raise exception 'TEST BAŞARISIZ: istemci görev ilerletti';
  exception when insufficient_privilege then null; end;
  begin perform public.sistem_satin_al(auth.uid(), 'x', 0, false, 2::smallint); raise exception 'TEST BAŞARISIZ: istemci satın alma fonksiyonu';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

\echo '▶ 15. Düello: tur kuralları, adil zaman, robot, süre, sekme, eşleştirme, Kupa; Canlı Soru Saati'
do $$
declare
  a uuid := app.sabit_uuid('kullanici:ogrenci13@demo.kmyarena.demo');
  b uuid := app.sabit_uuid('kullanici:ogrenci14@demo.kmyarena.demo');
  kz uuid := app.sabit_uuid('kazanim:M.8.1.3.2');
  ders uuid := app.sabit_uuid('ders:lgs_matematik');
  sorular uuid[]; d uuid; r jsonb; n integer; o uuid;
begin
  for n in 1..20 loop
    insert into public.soru (id, kaynak, kazanim_id, sinav_turu, soru_tipi, zorluk, govde_md, siklar, dogru, durum, cozum_adimlari)
    values (app.sabit_uuid('soru:duello' || n), 'ai', kz, 'LGS', 'islem', 4, 'D' || n, '{"A":"1","B":"2","C":"3","D":"4"}', 'C', 'dogrulandi', '["adım"]');
  end loop;
  insert into public.ogrenci_ilerleme (kullanici_id, dershane_id) values (a, app.sabit_uuid('dershane:demo')), (b, app.sabit_uuid('dershane:demo'))
  on conflict do nothing;

  -- Soru seçimi: ikisinin de görmediği 5 soru
  sorular := public.sistem_duello_sorulari(a, b, ders, 4, 5);
  perform test.dogrula(cardinality(sorular) = 5, 'düello soruları seçilemedi');
  d := public.sistem_duello_olustur('dereceli', app.sabit_uuid('dershane:demo'), ders, a, b, sorular, array[30,30,30,30,30]);
  perform test.dogrula((select count(*) from public.soru_gosterim where kullanici_id in (a, b) and soru_id = any (sorular)) = 10, 'düello soruları gösterim olarak işaretlenmedi');

  -- Geri sayım bitmeden soru metni ve cevap anahtarı gitmez
  r := public.sistem_duello_durum(d, a, 32);
  perform test.dogrula(r -> 'turlar' -> 0 -> 'soru' = 'null'::jsonb and r -> 'turlar' -> 0 -> 'dogru' = 'null'::jsonb, 'geri sayımda soru sızdı');
  begin perform public.sistem_duello_cevap(d, a, 1::smallint, 'C', 0, 32); raise exception 'TEST BAŞARISIZ: açılmamış tura cevap';
  exception when others then perform test.dogrula(sqlerrm = 'duello.turAcilmadi', sqlerrm); end;

  -- Tur 1: A yanlış → kilitlenir; B doğru → turu alır
  update public.duello_tur set acilis = clock_timestamp() - interval '2 seconds', son_an = clock_timestamp() + interval '28 seconds' where duello_id = d and sira = 1;
  r := public.sistem_duello_durum(d, a, 32);
  perform test.dogrula(r -> 'turlar' -> 0 -> 'soru' ->> 'govde_md' is not null and r -> 'turlar' -> 0 -> 'dogru' = 'null'::jsonb, 'açık turda anahtar sızdı');
  r := public.sistem_duello_cevap(d, a, 1::smallint, 'A', 120, 32);
  perform test.dogrula(not (r ->> 'dogru')::boolean, 'yanlış cevap doğru sayıldı');
  begin perform public.sistem_duello_cevap(d, a, 1::smallint, 'C', 0, 32); raise exception 'TEST BAŞARISIZ: kilitli oyuncu cevapladı';
  exception when others then perform test.dogrula(sqlerrm = 'duello.zatenCevapladin', sqlerrm); end;
  r := public.sistem_duello_cevap(d, b, 1::smallint, 'C', 600, 32);
  -- Adil zaman: RTT/2 en fazla 250 ms düşülür
  perform test.dogrula((r ->> 'sure_ms')::int between 1700 and 2300, 'adil zaman düzeltmesi: ' || r::text);
  r := public.sistem_duello_durum(d, a, 32);
  perform test.dogrula(r -> 'turlar' -> 0 ->> 'kazanan' = 'b' and r -> 'turlar' -> 0 ->> 'dogru' = 'C' and (r ->> 'skor_rakip')::int = 1, 'tur 1 sonucu');
  perform test.dogrula((r ->> 'gecerli_tur')::int = 2 and r -> 'turlar' -> 1 -> 'soru' = 'null'::jsonb, '8 sn ara olmadan tur açıldı');

  -- B iki tur daha alır → 3 puan, düello biter, Kupa Elo ile aktarılır
  for n in 2..3 loop
    update public.duello_tur set acilis = clock_timestamp() - interval '1 second', son_an = clock_timestamp() + interval '29 seconds' where duello_id = d and sira = n;
    perform public.sistem_duello_cevap(d, b, n::smallint, 'C', 0, 32);
  end loop;
  r := public.sistem_duello_durum(d, b, 32);
  perform test.dogrula(r ->> 'durum' = 'bitti' and r ->> 'kazanan' = 'ben' and (r ->> 'kupa')::int = 16, 'düello bitişi / Kupa: ' || (r - 'turlar')::text);
  perform test.dogrula((select kupa from public.ogrenci_ilerleme where kullanici_id = b) = 16 and (select kupa from public.ogrenci_ilerleme where kullanici_id = a) = 0, 'Kupa sıfırın altına indi ya da yazılmadı');
  perform test.dogrula((select duello_galibiyet from public.ogrenci_ilerleme where kullanici_id = b) = 1, 'galibiyet sayılmadı');
  perform test.dogrula(jsonb_typeof(r -> 'turlar' -> 0 -> 'cozum') = 'array', 'düello özetinde tam çözüm (dizi) yok');

  -- Süre dolarsa tur boş geçer (ikisi de cevap vermedi)
  sorular := public.sistem_duello_sorulari(a, b, ders, 4, 5);
  d := public.sistem_duello_olustur('arkadas', app.sabit_uuid('dershane:demo'), ders, a, null, sorular, array[20,20,20,20,20], null, null, 'ABCDEF');
  perform test.dogrula((select durum from public.duello where id = d) = 'davet', 'davet oluşmadı');
  perform public.sistem_duello_katil('abcdef', b);
  update public.duello_tur set acilis = clock_timestamp() - interval '25 seconds', son_an = clock_timestamp() - interval '5 seconds' where duello_id = d and sira = 1;
  r := public.sistem_duello_durum(d, a, 32);
  perform test.dogrula((r -> 'turlar' -> 0 ->> 'kapandi')::boolean and r -> 'turlar' -> 0 ->> 'kazanan' is null, 'süre dolan tur kapanmadı');

  -- Sekme: dereceli düelloda 2. ihlalde o tur kaybedilir
  sorular := public.sistem_duello_sorulari(a, b, ders, 4, 3);
  d := public.sistem_duello_olustur('dereceli', app.sabit_uuid('dershane:demo'), ders, a, b, sorular, array[30,30,30]);
  update public.duello_tur set acilis = clock_timestamp() - interval '1 second' where duello_id = d and sira = 1;
  perform test.dogrula(public.sistem_duello_sekme(d, a, 32) = 1, 'ilk sekme uyarısı');
  perform public.sistem_duello_sekme(d, a, 32);
  perform test.dogrula((select a_dogru from public.duello_tur where duello_id = d and sira = 1) = false, 'ikinci sekme ihlali turu kaybettirmedi');

  -- Robot: açıkça robot; robot doğru cevap zamanında turu alır
  d := public.sistem_duello_olustur('robot', app.sabit_uuid('dershane:demo'), ders, a, null, array[app.sabit_uuid('soru:duello20'), app.sabit_uuid('soru:duello19'), app.sabit_uuid('soru:duello18')],
    array[30,30,30], '[{"sure_ms":1000,"dogru":true,"secilen":"C"},{"sure_ms":1000,"dogru":false,"secilen":"A"},{"sure_ms":1000,"dogru":true,"secilen":"C"}]', 1000);
  update public.duello_tur set acilis = clock_timestamp() - interval '3 seconds', son_an = clock_timestamp() + interval '27 seconds' where duello_id = d and sira = 1;
  r := public.sistem_duello_durum(d, a, 32);
  perform test.dogrula(r -> 'rakip' ->> 'takma_ad' = 'Robot' and r -> 'turlar' -> 0 ->> 'kazanan' = 'b', 'robot turu: ' || (r -> 'turlar' -> 0)::text);

  -- Eşleştirme: aynı ders, yakın Kupa
  delete from public.duello_kuyruk;
  perform test.dogrula(public.sistem_duello_eslestir(a, ders) is null, 'boş kuyrukta eşleşti');
  perform test.dogrula(public.sistem_duello_eslestir(b, ders) = a, 'eşleşme olmadı');
  perform test.dogrula(not exists (select 1 from public.duello_kuyruk), 'eşleşenler kuyruktan çıkmadı');

  -- Canlı Soru Saati: ilk doğru bonus alır, ikinci cevap reddedilir
  insert into public.canli_oturum (dershane_id, sinav_grubu, gun, baslangic, sorular)
  values (app.sabit_uuid('dershane:demo'), 'LGS', app.bugun(), clock_timestamp() - interval '2 seconds',
          array[app.sabit_uuid('soru:duello1'), app.sabit_uuid('soru:duello2'), app.sabit_uuid('soru:duello3'), app.sabit_uuid('soru:duello4'), app.sabit_uuid('soru:duello5')])
  returning id into o;
  r := public.sistem_canli_cevap(o, a, 1::smallint, 'C', 100);
  perform test.dogrula((r ->> 'derece')::int = 1 and (r ->> 'bonus')::boolean, 'canlı ilk doğru');
  r := public.sistem_canli_cevap(o, b, 1::smallint, 'C', 100);
  perform test.dogrula((r ->> 'derece')::int = 2, 'canlı ikinci doğru');
  begin perform public.sistem_canli_cevap(o, a, 1::smallint, 'C', 0); raise exception 'TEST BAŞARISIZ: canlı soruya iki cevap';
  exception when others then perform test.dogrula(sqlerrm = 'canli.zatenCevapladin', sqlerrm); end;
  begin perform public.sistem_canli_cevap(o, a, 2::smallint, 'C', 0); raise exception 'TEST BAŞARISIZ: açılmamış canlı soru';
  exception when others then perform test.dogrula(sqlerrm = 'canli.sureDisi', sqlerrm); end;
  r := public.sistem_canli_durum(o, a);
  perform test.dogrula(r -> 'sorular' -> 0 -> 'soru' is not null and r -> 'sorular' -> 0 -> 'dogru' = 'null'::jsonb and r -> 'sorular' -> 1 -> 'soru' = 'null'::jsonb, 'canlı durumda sızıntı');
end $$;

begin;
select test.oturum('ogrenci13@demo.kmyarena.demo');
set local role authenticated;
do $$ begin
  begin perform public.sistem_duello_cevap(gen_random_uuid(), auth.uid(), 1::smallint, 'A', 0, 32); raise exception 'TEST BAŞARISIZ: istemci düello fonksiyonu';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.duello_tur; raise exception 'TEST BAŞARISIZ: istemci düello turlarını okudu';
  exception when insufficient_privilege then null; end;
  begin update public.ogrenci_ilerleme set kupa = 9999 where kullanici_id = auth.uid(); raise exception 'TEST BAŞARISIZ: istemci Kupa yazdı';
  exception when insufficient_privilege then null; end;
  perform test.dogrula((select count(*) from public.duello) >= 1, 'oyuncu kendi düellolarını göremiyor');
end $$;
rollback;

\echo '▶ 16. Klan: kurma koşulları, katılım, roller, katkı, görev, boss, savaş, sohbet, şikâyet'
begin;
do $$
declare
  u uuid[] := array(select app.sabit_uuid(format('kullanici:ogrenci%s@demo.kmyarena.demo', i)) from generate_series(15, 20) i);
  dm uuid := app.sabit_uuid('dershane:demo');
  kz uuid := app.sabit_uuid('kazanim:M.8.1.3.2');
  k uuid; k2 uuid; r jsonb; n integer; b public.boss; sv uuid; m bigint;
begin
  insert into public.ogrenci_ilerleme (kullanici_id, dershane_id) select x, dm from unnest(u) x on conflict do nothing;
  -- Koşullar: seviye 5 ve 7 günde 50 soru
  begin perform public.sistem_klan_kur(u[1], 'Testçiler', 'Uçarız', '{}', 'acik', false, 5, 50); raise exception 'TEST BAŞARISIZ: seviye koşulu';
  exception when others then perform test.dogrula(sqlerrm = 'klan.seviyeYetersiz', sqlerrm); end;
  update public.ogrenci_ilerleme set seviye = 6 where kullanici_id = u[1];
  begin perform public.sistem_klan_kur(u[1], 'Testçiler', 'Uçarız', '{}', 'acik', false, 5, 50); raise exception 'TEST BAŞARISIZ: soru koşulu';
  exception when others then perform test.dogrula(sqlerrm = 'klan.soruYetersiz', sqlerrm); end;
  k := public.sistem_klan_kur(u[1], 'Testçiler', 'Uçarız', '{}', 'acik', false, 5, 0);
  perform test.dogrula((select rol from public.klan_uyelik where kullanici_id = u[1]) = 'lider', 'kurucu lider olmadı');
  perform test.dogrula((select count(*) from public.klan_gorev where klan_id = k) = 2 and exists (select 1 from public.boss where klan_id = k), 'haftalık görev/boss hazırlanmadı');
  begin perform public.sistem_klan_kur(u[2], 'TESTÇİLER', null, '{}', 'acik', false, 0, 0); raise exception 'TEST BAŞARISIZ: aynı ad';
  exception when others then perform test.dogrula(sqlerrm = 'klan.adKullaniliyor', sqlerrm); end;

  -- Katılım: açık → doğrudan; başvurulu → onay; kapasite
  perform test.dogrula(public.sistem_klan_katil(u[2], k, 30) = 'katildi', 'açık klana katılınamadı');
  begin perform public.sistem_klan_katil(u[2], k, 30); raise exception 'TEST BAŞARISIZ: iki kez üye';
  exception when others then perform test.dogrula(sqlerrm = 'klan.zatenUye', sqlerrm); end;
  update public.klan set katilim_turu = 'basvurulu' where id = k;
  perform test.dogrula(public.sistem_klan_katil(u[3], k, 30) = 'basvuruldu', 'başvuru oluşmadı');
  begin perform public.sistem_klan_basvuru_yanit(u[2], (select id from public.klan_basvuru where kullanici_id = u[3] and durum = 'bekliyor'), true, 30);
    raise exception 'TEST BAŞARISIZ: üye başvuru onayladı';
  exception when others then perform test.dogrula(sqlerrm = 'klan.yetkisiz', sqlerrm); end;
  perform public.sistem_klan_basvuru_yanit(u[1], (select id from public.klan_basvuru where kullanici_id = u[3] and durum = 'bekliyor'), true, 30);
  update public.klan set katilim_turu = 'davet' where id = k;
  begin perform public.sistem_klan_katil(u[4], k, 30); raise exception 'TEST BAŞARISIZ: davetsiz katılım';
  exception when others then perform test.dogrula(sqlerrm = 'klan.davetGerekli', sqlerrm); end;
  perform public.sistem_klan_davet(u[1], u[4]);
  perform test.dogrula(public.sistem_klan_katil(u[4], k, 30) = 'katildi', 'davetle katılınamadı');
  begin perform public.sistem_klan_davet(u[1], u[5]); perform public.sistem_klan_katil(u[5], k, 4); raise exception 'TEST BAŞARISIZ: kapasite';
  exception when others then perform test.dogrula(sqlerrm = 'klan.dolu', sqlerrm); end;

  -- Roller: yardımcı en fazla 3; yardımcı yardımcıyı çıkaramaz
  perform public.sistem_klan_yonet(u[1], u[2], 'yardimci_yap');
  perform public.sistem_klan_yonet(u[1], u[3], 'yardimci_yap');
  begin perform public.sistem_klan_yonet(u[2], u[3], 'cikar'); raise exception 'TEST BAŞARISIZ: yardımcı yardımcıyı çıkardı';
  exception when others then perform test.dogrula(sqlerrm = 'klan.yetkisiz', sqlerrm); end;
  perform public.sistem_klan_yonet(u[1], u[2], 'lider_devret');
  perform test.dogrula((select lider_id from public.klan where id = k) = u[2] and (select rol from public.klan_uyelik where kullanici_id = u[1]) = 'yardimci', 'liderlik devri');
  -- 14 gün pasif lider → en aktif yardımcı
  update public.klan_uyelik set son_katki = now() - interval '20 days', katilma = now() - interval '30 days' where kullanici_id = u[2];
  update public.kullanici set son_giris = now() - interval '20 days' where id = u[2];
  update public.klan_uyelik set son_katki = now() where kullanici_id = u[3];
  perform test.dogrula(app.klan_lider_sec(k) = u[3], 'pasif lider devredilmedi');

  -- Katkı: seviye, görev, boss (yalnız boss kazanımından doğru), klan dışı → null
  update public.boss set kazanim_id = kz, can = 20, kalan_can = 20 where klan_id = k;
  update public.ogrenci_ilerleme set ozellik_puanlari = '{"zeka": 40}' where kullanici_id = u[4];
  r := public.sistem_klan_katki(jsonb_build_object('kullanici_id', u[4], 'dogru', true, 'zorluk', 4, 'beklenen', 0.6, 'kazanim_id', kz, 'ozellik', 'zeka'));
  -- özellik seviyesi(40) = 1 + floor(sqrt(4)) = 3 → hasar 12
  perform test.dogrula((r -> 'boss' ->> 'hasar')::int = 12 and (r -> 'boss' ->> 'kalan_can')::int = 8, 'boss hasarı: ' || r::text);
  r := public.sistem_klan_katki(jsonb_build_object('kullanici_id', u[4], 'dogru', false, 'zorluk', 4, 'beklenen', 0.6, 'kazanim_id', kz, 'ozellik', 'zeka'));
  perform test.dogrula(r -> 'boss' = 'null'::jsonb, 'yanlış cevap boss''a vurdu');
  n := (select altin from public.ogrenci_ilerleme where kullanici_id = u[4]);
  r := public.sistem_klan_katki(jsonb_build_object('kullanici_id', u[4], 'dogru', true, 'zorluk', 4, 'beklenen', 0.6, 'kazanim_id', kz, 'ozellik', 'zeka'));
  perform test.dogrula((r -> 'boss' ->> 'yenildi')::boolean, 'boss yenilmedi');
  perform test.dogrula((select altin from public.ogrenci_ilerleme where kullanici_id = u[4]) = n + 60, 'boss sandığı verilmedi');
  perform test.dogrula((select boss_hasar_toplam from public.ogrenci_ilerleme where kullanici_id = u[4]) = 24, 'boss hasarı ilerlemeye yazılmadı');
  perform test.dogrula((select katki_toplam from public.klan where id = k) = 3, 'klan katkısı');
  perform test.dogrula(public.sistem_klan_katki(jsonb_build_object('kullanici_id', u[6], 'dogru', true)) is null, 'klansız katkı');
  update public.klan_gorev set hedef = 4 where klan_id = k and kod = 'toplam_soru';
  n := (select altin from public.ogrenci_ilerleme where kullanici_id = u[1]);
  r := public.sistem_klan_katki(jsonb_build_object('kullanici_id', u[3], 'dogru', true, 'zorluk', 2, 'kazanim_id', kz, 'ozellik', 'zeka'));
  perform test.dogrula(r -> 'tamamlanan_gorevler' ? 'toplam_soru' and (select altin from public.ogrenci_ilerleme where kullanici_id = u[1]) = n + 100, 'klan görevi ödülü: ' || r::text);

  -- Savaş: ikinci klan, eşleştir (hemen), 30 hak, etki 10 × (1 + (1 − E)), katılım çarpanı, kapanış
  update public.ogrenci_ilerleme set seviye = 6 where kullanici_id = u[5];
  k2 := public.sistem_klan_kur(u[5], 'Aslanlar', null, '{}', 'acik', false, 5, 0);
  perform public.sistem_klan_katil(u[6], k2, 30);
  delete from public.klan_savasi where dershane_id = dm;
  perform test.dogrula(public.sistem_klan_savas_esle(app.hafta_basi(app.bugun()), 2, true, dm) >= 1, 'savaş eşleşmedi');
  sv := (select id from public.klan_savasi where klan_a in (k, k2) and klan_b in (k, k2));
  perform test.dogrula(sv is not null, 'iki klan birbiriyle eşleşmedi');
  r := public.sistem_klan_katki(jsonb_build_object('kullanici_id', u[5], 'dogru', true, 'zorluk', 3, 'beklenen', 0.5, 'kazanim_id', kz, 'ozellik', 'zeka'));
  -- strateji seviyesi 1 → ×1,01 · 10 × 1,5 = 15,15
  perform test.dogrula((r -> 'savas' ->> 'etki')::numeric = 15.15 and (r -> 'savas' ->> 'hak_kalan')::int = 29, 'savaş etkisi: ' || r::text);
  update public.klan_savas_katki set kullanilan_hak = 30 where savas_id = sv and kullanici_id = u[5];
  r := public.sistem_klan_katki(jsonb_build_object('kullanici_id', u[5], 'dogru', true, 'zorluk', 3, 'beklenen', 0.5, 'kazanim_id', kz, 'ozellik', 'zeka'));
  perform test.dogrula((r -> 'savas' ->> 'etki')::numeric = 0 and (r -> 'savas' ->> 'hak_kalan')::int = 0, 'hak sınırı aşıldı');
  perform public.sistem_klan_katki(jsonb_build_object('kullanici_id', u[6], 'dogru', true, 'zorluk', 3, 'beklenen', 0.9, 'kazanim_id', kz, 'ozellik', 'bilgelik'));
  r := public.sistem_klan_durum(u[5]);
  perform test.dogrula((r -> 'savas' ->> 'aktif')::boolean and (r -> 'savas' -> 'bolgeler' -> 'mat' ->> 'ben')::numeric = 15.15, 'savaş durumu: ' || (r -> 'savas')::text);
  n := (select kupa from public.ogrenci_ilerleme where kullanici_id = u[5]);
  perform test.dogrula(public.sistem_klan_savas_kapat(30, true) >= 1, 'savaş kapanmadı');
  perform test.dogrula((select kazanan from public.klan_savasi where id = sv) = k2 and (select carpan_b from public.klan_savasi where id = sv) = 1.3, 'savaş sonucu / katılım çarpanı');
  perform test.dogrula((select kupa from public.klan where id = k2) = 30 and (select kupa from public.ogrenci_ilerleme where kullanici_id = u[5]) = n + 10, 'savaş Kupası');

  -- Sohbet: üye olmayan yazamaz, soru paylaşımı yalnız görülen soru, hız sınırı; şikâyet (3 → gizle)
  begin perform public.sistem_klan_mesaj(app.sabit_uuid('kullanici:ogrenci30@demo.kmyarena.demo'), 'hazir', 'selam', null, null); raise exception 'TEST BAŞARISIZ: üye olmayan yazdı';
  exception when others then perform test.dogrula(sqlerrm = 'klan.uyeDegil', sqlerrm); end;
  begin perform public.sistem_klan_mesaj(u[1], 'serbest', null, 'merhaba', null); raise exception 'TEST BAŞARISIZ: serbest kapalıyken yazıldı';
  exception when others then perform test.dogrula(sqlerrm = 'klan.serbestKapali', sqlerrm); end;
  begin perform public.sistem_klan_mesaj(u[1], 'soru', null, null, app.sabit_uuid('soru:duello1')); raise exception 'TEST BAŞARISIZ: görülmemiş soru paylaşıldı';
  exception when others then perform test.dogrula(sqlerrm in ('klan.mesajGecersiz'), sqlerrm); end;
  m := public.sistem_klan_mesaj(u[1], 'hazir', 'selam', null, null);
  begin perform public.sistem_klan_mesaj(u[1], 'hazir', 'hadi', null, null); raise exception 'TEST BAŞARISIZ: hız sınırı';
  exception when others then perform test.dogrula(sqlerrm = 'klan.cokHizli', sqlerrm); end;
  perform test.dogrula(jsonb_array_length(public.sistem_klan_mesajlar(u[2], 0)) >= 1, 'mesajlar okunamadı');
  perform test.dogrula(jsonb_array_length(public.sistem_klan_mesajlar(u[5], 0)) = 0 or not exists (
    select 1 from jsonb_array_elements(public.sistem_klan_mesajlar(u[5], 0)) e where (e ->> 'id')::bigint = m), 'başka klanın mesajı göründü');
  perform public.sistem_sikayet(u[2], 'klan_mesaj', m::text, 'zorbalik', null);
  perform public.sistem_sikayet(u[3], 'klan_mesaj', m::text, 'kufur', null);
  perform test.dogrula((select oncelikli from public.sikayet where sikayet_eden = u[2] and hedef_id = m::text), 'zorbalık öncelikli değil');
  perform public.sistem_sikayet(u[4], 'klan_mesaj', m::text, 'kufur', null);
  perform test.dogrula((select gizli from public.klan_mesaj where id = m), '3 şikâyette mesaj gizlenmedi');
  begin perform public.sistem_sikayet(u[1], 'klan_mesaj', m::text, 'kufur', null); raise exception 'TEST BAŞARISIZ: kendi mesajını şikâyet';
  exception when others then perform test.dogrula(sqlerrm = 'sikayet.gecersiz', sqlerrm); end;

  -- Ayrılma: lider ayrılırsa devir; son üye ayrılırsa klan silinir
  perform public.sistem_klan_ayril(u[6]);
  perform public.sistem_klan_ayril(u[5]);
  perform test.dogrula(not exists (select 1 from public.klan where id = k2), 'boş klan silinmedi');
  r := public.sistem_klan_durum(u[5]);
  perform test.dogrula(not (r ->> 'uye')::boolean and jsonb_array_length(r -> 'klanlar') >= 1, 'klansız durum');
  r := public.sistem_oyun_metrikleri(u[4]);
  perform test.dogrula((r ->> 'klan_uyesi')::int = 1 and (r ->> 'boss_hasar_max')::int = 24, 'klan rozet metrikleri');
end $$;

-- İstemci: klan tablolarına yazamaz, klan fonksiyonlarını çağıramaz
select test.oturum('ogrenci15@demo.kmyarena.demo');
set local role authenticated;
do $$ begin
  begin perform public.sistem_klan_katki(jsonb_build_object('kullanici_id', auth.uid(), 'dogru', true)); raise exception 'TEST BAŞARISIZ: istemci klan katkısı';
  exception when insufficient_privilege then null; end;
  begin insert into public.klan (dershane_id, ad) values (app.dershane_id(), 'Hile'); raise exception 'TEST BAŞARISIZ: istemci klan kurdu';
  exception when insufficient_privilege then null; end;
  begin update public.klan set kupa = 999; raise exception 'TEST BAŞARISIZ: istemci klan Kupası yazdı';
  exception when insufficient_privilege then null; end;
end $$;
rollback;

\echo '▶ 17. Topluluk ve asistan: görünürlük, kabul puanı, günlük sınır, döngü, şikâyet, asistan oturumu'
begin;
do $$
declare
  o3 uuid := app.sabit_uuid('kullanici:ogrenci03@demo.kmyarena.demo');
  o4 uuid := app.sabit_uuid('kullanici:ogrenci04@demo.kmyarena.demo');
  o5 uuid := app.sabit_uuid('kullanici:ogrenci05@demo.kmyarena.demo');
  o21 uuid := app.sabit_uuid('kullanici:ogrenci21@demo.kmyarena.demo');
  ogr uuid := app.sabit_uuid('kullanici:ogretmen.mat@demo.kmyarena.demo');
  mat uuid := app.sabit_uuid('ders:lgs_matematik');
  q uuid; c4 uuid; c5 uuid; r jsonb; x integer;
begin
  insert into public.ogrenci_ilerleme (kullanici_id, dershane_id) select u, app.sabit_uuid('dershane:demo') from unnest(array[o3, o4, o5, o21]) u on conflict do nothing;
  q := public.sistem_topluluk_sor(o3, mat, null, 'Bu denklemde x kaçtır? 2x + 3 = 11', null, null, 'sinif', 5);
  perform test.dogrula(jsonb_array_length(public.sistem_topluluk_akis(o4, 'hepsi', null, null)) >= 1, 'sınıf arkadaşı göremedi');
  perform test.dogrula(not exists (select 1 from jsonb_array_elements(public.sistem_topluluk_akis(o21, 'hepsi', null, null)) e where (e ->> 'id')::uuid = q), 'başka sınıf gördü');
  begin perform public.sistem_topluluk_detay(o21, q); raise exception 'TEST BAŞARISIZ: görünmeyen detay';
  exception when others then perform test.dogrula(sqlerrm = 'topluluk.bulunamadi', sqlerrm); end;
  begin perform public.sistem_topluluk_cevapla(o3, q, 'B', 'Kendi soruma cevap yazıyorum', null); raise exception 'TEST BAŞARISIZ: kendi sorusu';
  exception when others then perform test.dogrula(sqlerrm = 'topluluk.kendiSorun', sqlerrm); end;
  begin perform public.sistem_topluluk_sor(o3, app.sabit_uuid('ders:tyt_fizik'), null, 'Paketimde olmayan ders sorusu', null, null, 'dershane', 5); raise exception 'TEST BAŞARISIZ: paket dışı ders';
  exception when others then perform test.dogrula(sqlerrm = 'topluluk.dersGecersiz', sqlerrm); end;
  c4 := public.sistem_topluluk_cevapla(o4, q, 'C', '2x = 8 olduğundan x = 4 bulunur.', null);
  c5 := public.sistem_topluluk_cevapla(o5, q, 'C', 'Her iki taraftan 3 çıkar, 2 ye böl: x = 4', null);
  begin perform public.sistem_topluluk_cevapla(o4, q, 'C', 'İkinci kez cevap yazıyorum', null); raise exception 'TEST BAŞARISIZ: iki cevap';
  exception when others then perform test.dogrula(sqlerrm = 'topluluk.zatenCevapladin', sqlerrm); end;
  begin perform public.sistem_topluluk_kabul(o4, c5, 'soran', false, 50, 20, 20, 300, 10); raise exception 'TEST BAŞARISIZ: başkası kabul etti';
  exception when others then perform test.dogrula(sqlerrm = 'topluluk.yetkisiz', sqlerrm); end;
  x := (select altin from public.ogrenci_ilerleme where kullanici_id = o4);
  r := public.sistem_topluluk_kabul(o3, c4, 'soran', false, 50, 20, 20, 300, 10);
  perform test.dogrula((r ->> 'xp')::int = 50 and (r ->> 'altin')::int = 20 and (select altin from public.ogrenci_ilerleme where kullanici_id = o4) = x + 20, 'ilk kabul puanı: ' || r::text);
  perform test.dogrula((select topluluk_kabul from public.ogrenci_ilerleme where kullanici_id = o4) = 1, 'kabul sayacı');
  -- Soru çözüldü → yeni cevap yok; öğretmen ikinci cevabı onaylayabilir (20 XP, Altın yok) ve örnek çözüm işaretler
  r := public.sistem_topluluk_kabul(ogr, c5, 'ogretmen', true, 50, 20, 20, 300, 10);
  perform test.dogrula((r ->> 'xp')::int = 20 and (r ->> 'altin')::int = 0 and (select ornek_cozum from public.topluluk_cevap where id = c5), 'sonraki kabul / örnek: ' || r::text);
  begin perform public.sistem_topluluk_kabul(o4, c4, 'ogretmen', true, 50, 20, 20, 300, 10); raise exception 'TEST BAŞARISIZ: öğrenci öğretmen gibi';
  exception when others then perform test.dogrula(sqlerrm = 'topluluk.yetkisiz', sqlerrm); end;
  -- Günlük XP sınırı
  q := public.sistem_topluluk_sor(o3, mat, null, 'İkinci soru: 3x = 12 ise x?', null, null, 'dershane', 5);
  c4 := public.sistem_topluluk_cevapla(o4, q, 'A', '12 yi 3 e bölersek x = 4 olur.', null);
  r := public.sistem_topluluk_kabul(o3, c4, 'soran', false, 50, 20, 20, 60, 10);
  perform test.dogrula((r ->> 'xp')::int = 10, 'günlük sınır uygulanmadı: ' || r::text);
  -- Günlük soru sınırı
  begin perform public.sistem_topluluk_sor(o3, mat, null, 'Üçüncü soru deneme', null, null, 'dershane', 2); raise exception 'TEST BAŞARISIZ: günlük soru sınırı';
  exception when others then perform test.dogrula(sqlerrm = 'topluluk.gunlukSinir', sqlerrm); end;
  -- AI bekleyenler (eski soru) ve yazma
  update public.topluluk_soru set olusturma = now() - interval '3 hours' where id = q;
  update public.topluluk_soru set durum = 'acik' where id = q;
  perform test.dogrula(exists (select 1 from jsonb_array_elements(public.sistem_topluluk_ai_bekleyenler(15, 120, 10)) e where (e ->> 'id')::uuid = q and e ->> 'tur' = 'cozum'), 'AI bekleyen bulunamadı');
  perform public.sistem_topluluk_ai_yaz(q, 'cozum', 'Tam çözüm');
  perform test.dogrula((select ogretmen_bekliyor from public.topluluk_soru where id = q), 'öğretmen bekleyenlerine düşmedi');
  -- Şikâyet: 3 şikâyette soru gizlenir
  perform public.sistem_sikayet(o4, 'topluluk_soru', q::text, 'spam', null);
  perform public.sistem_sikayet(o5, 'topluluk_soru', q::text, 'spam', null);
  perform public.sistem_sikayet(app.sabit_uuid('kullanici:ogrenci06@demo.kmyarena.demo'), 'topluluk_soru', q::text, 'spam', null);
  perform test.dogrula((select durum from public.topluluk_soru where id = q) = 'gizli', 'şikâyetle gizlenmedi');
  -- Asistan: yalnız cevaplanmış antrenman sorusu
  begin perform public.sistem_asistan_soru_oturumu(o21, app.sabit_uuid('soru:duello1')); raise exception 'TEST BAŞARISIZ: cevapsız soruya asistan';
  exception when others then perform test.dogrula(sqlerrm = 'asistan.soruUygunDegil', sqlerrm); end;
  perform test.dogrula((public.sistem_asistan_kullanim(o3) ->> 'mesaj')::int = 0, 'asistan kullanım sayacı');
  perform public.sistem_rehberlik_bildir(o3, 'asistan', 'Destek gerektiren ifade');
  perform public.sistem_rehberlik_bildir(o3, 'asistan', 'Tekrar');
  perform test.dogrula((select count(*) from public.rehberlik_bildirim where kullanici_id = o3) = 1, 'rehberlik bildirimi tekilleşmedi');
end $$;

-- Rehberlik bildirimini öğrenci göremez, rehber/kurucu görür
select test.oturum('ogrenci03@demo.kmyarena.demo');
set local role authenticated;
do $$ begin
  perform test.dogrula((select count(*) from public.rehberlik_bildirim) = 0, 'öğrenci rehberlik bildirimi gördü');
  perform test.dogrula((select count(*) from public.topluluk_soru) = 0, 'öğrenci topluluk tablosunu doğrudan okudu');
end $$;
reset role;
select test.oturum('kurucu@demo.kmyarena.demo');
set local role authenticated;
do $$ begin
  perform test.dogrula((select count(*) from public.rehberlik_bildirim) = 1, 'kurucu rehberlik bildirimini göremedi');
end $$;
rollback;

\echo '▶ 18. Paneller: sınıf analizi, ödev, bekleyenler, kurucu özeti, rehberlik, veli — yetki sınırları'
begin;
set local role authenticated;
do $$
declare
  r jsonb; sinif1 uuid; sinif3 uuid; od uuid; o1 uuid := app.sabit_uuid('kullanici:ogrenci01@demo.kmyarena.demo');
begin
  -- Öğretmen: kendi sınıfları
  perform test.oturum('ogretmen.mat@demo.kmyarena.demo');
  r := public.panel_siniflarim();
  perform test.dogrula(jsonb_array_length(r) = 2, 'öğretmen sınıf sayısı: ' || jsonb_array_length(r));
  select (e ->> 'id')::uuid into sinif1 from jsonb_array_elements(r) e where e ->> 'sinav_turu' = 'LGS' limit 1;
  r := public.panel_sinif_analiz(sinif1);
  perform test.dogrula(jsonb_array_length(r -> 'ogrenciler') >= 5, 'sınıf öğrencileri');
  -- Öğretmen kendi öğrencisinin adını görür
  perform test.dogrula(exists (select 1 from jsonb_array_elements(r -> 'ogrenciler') e where e ->> 'ad' like '% %' and e ->> 'ad' <> e ->> 'takma_ad'), 'öğretmen öğrenci adını göremedi');
  select s.id into sinif3 from public.sinif s where s.id not in (select (e ->> 'id')::uuid from jsonb_array_elements(public.panel_siniflarim()) e) limit 1;
  begin perform public.panel_sinif_analiz(sinif3); raise exception 'TEST BAŞARISIZ: başka sınıf analizi';
  exception when others then perform test.dogrula(sqlerrm = 'panel.yetkisiz', sqlerrm); end;
  -- Ödev
  od := public.panel_odev_olustur('Kesirler tekrar', array[app.sabit_uuid('kazanim:M.8.1.3.2')], array[sinif1], '{}', 5, 'uyarlamali', null, now() + interval '2 days');
  perform test.dogrula((select (e ->> 'atanan')::int from jsonb_array_elements(public.panel_odevler()) e where (e ->> 'id')::uuid = od) >= 5, 'ödev ataması');
  begin perform public.panel_odev_olustur('X', array[app.sabit_uuid('kazanim:M.8.1.3.2')], array[sinif3], '{}', 5, 'uyarlamali', null, now() + interval '2 days');
    raise exception 'TEST BAŞARISIZ: başka sınıfa ödev';
  exception when others then perform test.dogrula(sqlerrm = 'panel.yetkisiz', sqlerrm); end;
  perform test.dogrula(jsonb_array_length(public.panel_odevler()) >= 1, 'ödev listesi');
  perform test.dogrula(public.panel_bekleyenler() ? 'sikayetler', 'bekleyenler');
  begin perform public.panel_dershane_ozet(); raise exception 'TEST BAŞARISIZ: öğretmen kurucu özeti';
  exception when others then perform test.dogrula(sqlerrm = 'panel.yetkisiz', sqlerrm); end;
  begin perform public.panel_rehberlik(); raise exception 'TEST BAŞARISIZ: öğretmen rehberlik';
  exception when others then perform test.dogrula(sqlerrm = 'panel.yetkisiz', sqlerrm); end;
  r := public.panel_ogrenci_detay(o1);
  perform test.dogrula(r -> 'rehberlik' = 'null'::jsonb and jsonb_array_length(r -> 'gunluk') = 28, 'öğrenci detayı (rehberliksiz)');

  -- Öğrenci: ödevini görür, panel fonksiyonlarına erişemez
  perform test.oturum('ogrenci01@demo.kmyarena.demo');
  perform test.dogrula(exists (select 1 from jsonb_array_elements(public.odevlerim()) e where (e ->> 'id')::uuid = od), 'öğrenci ödevini görmedi');
  begin perform public.panel_bekleyenler(); raise exception 'TEST BAŞARISIZ: öğrenci bekleyenler';
  exception when others then perform test.dogrula(sqlerrm = 'panel.yetkisiz', sqlerrm); end;
  begin perform public.panel_ogrenci_detay(app.sabit_uuid('kullanici:ogrenci02@demo.kmyarena.demo')); raise exception 'TEST BAŞARISIZ: öğrenci başkasının detayı';
  exception when others then perform test.dogrula(sqlerrm = 'panel.yetkisiz', sqlerrm); end;
  perform test.dogrula(jsonb_array_length(public.panel_siniflarim()) = 0, 'öğrenci sınıf analizi listesi');

  -- Kurucu: özet, öğrenciler, rehberlik, ayar
  perform test.oturum('kurucu@demo.kmyarena.demo');
  r := public.panel_dershane_ozet();
  perform test.dogrula((r ->> 'ogrenci')::int >= 40 and jsonb_array_length(r -> 'trend') = 8, 'kurucu özeti');
  perform test.dogrula(jsonb_array_length(public.panel_ogrenciler()) >= 40, 'öğrenci listesi');
  perform test.dogrula(public.panel_rehberlik() ? 'riskliler', 'rehberlik');
  perform public.panel_rehberlik_not(o1, 'gorusme', 'Haftaya görüşme', now() + interval '3 days');
  perform test.dogrula(jsonb_array_length(public.panel_ogrenci_detay(o1) -> 'rehberlik') = 1, 'rehberlik notu');
  r := public.panel_ayar_guncelle('{"canli_saat": "20:15", "gunluk_hedef": 500, "klan_sohbeti_serbest": true}');
  perform test.dogrula(r ->> 'canli_saat' = '20:15' and not (r ? 'gunluk_hedef'), 'ayar doğrulama: ' || r::text);
  perform test.dogrula(app.ozellik_acik_mi('klan_sohbeti_serbest', app.sabit_uuid('dershane:demo')), 'dershane bayrağı');
  perform public.panel_duyuru('Deneme sınavı', 'Cumartesi 10:00', null, null);
  perform test.oturum('ogrenci01@demo.kmyarena.demo');
  perform test.dogrula(jsonb_array_length(public.duyurularim()) >= 1, 'öğrenci duyuruyu görmedi');
  perform test.dogrula(jsonb_array_length(public.veli_ozet()) = 0, 'öğrenci veli özeti');
  -- Rakip dershane kurucusu demo verisini göremez
  perform test.oturum('kurucu@rakip.kmyarena.demo');
  perform test.dogrula(not exists (select 1 from jsonb_array_elements(public.panel_ogrenciler()) e where (e ->> 'id')::uuid = o1), 'rakip kurucu demo öğrencisini gördü');
end $$;
reset role;
-- Ödev işleme (service)
do $$
declare od uuid := (select id from public.odev order by olusturma desc limit 1); o1 uuid := app.sabit_uuid('kullanici:ogrenci01@demo.kmyarena.demo'); r jsonb; i int;
begin
  perform test.dogrula((public.sistem_odev_sonraki(o1, od) ->> 'kalan')::int = 5, 'ödev kalan');
  for i in 1..5 loop r := public.sistem_odev_isle(o1, od, i % 2 = 0); end loop;
  perform test.dogrula((r ->> 'bitti')::boolean, 'ödev bitmedi: ' || r::text);
end $$;

-- 19 · Bildirimler (service)
do $$
declare o1 uuid := app.sabit_uuid('kullanici:ogrenci01@demo.kmyarena.demo'); n int; r record;
begin
  perform test.dogrula(exists (select 1 from public.bildirim_kuyruk where kullanici_id = o1 and tur = 'odev'), 'ödev bildirimi kuyruğa düşmedi');
  perform public.sistem_bildirim_cihaz(o1, 'ExponentPushToken[test-1]', 'ios');
  perform public.sistem_bildirim_cihaz(o1, 'ExponentPushToken[test-1]', 'ios'); -- tekrar: güncelleme
  perform test.dogrula((select count(*) from public.bildirim_cihaz where kullanici_id = o1) = 1, 'cihaz kaydı');
  begin perform public.sistem_bildirim_cihaz(o1, 'sahte', 'ios'); raise exception 'TEST BAŞARISIZ: geçersiz jeton';
  exception when check_violation then null; end;
  -- Sessiz saat her saati kapsayacak şekilde ayarlanınca hiçbir şey gönderilmez
  perform public.sistem_bildirim_tercih(o1, true, 0::smallint, 0::smallint, null);
  update public.kullanici set sessiz_baslangic = 0, sessiz_bitis = 23 where id = o1;
  perform test.dogrula(not exists (select 1 from public.sistem_bildirim_bekleyenler() b where b.kullanici_id = o1)
    or extract(hour from now() at time zone 'Europe/Istanbul') = 23, 'sessiz saatte bildirim');
  update public.kullanici set sessiz_baslangic = 22, sessiz_bitis = 8 where id = o1;
  update public.bildirim_kuyruk set olusturma = now() where kullanici_id = o1;
  -- Kapatılan kullanıcıya yeni bildirim yazılmaz
  perform public.sistem_bildirim_tercih(o1, false, null, null, null);
  select count(*) into n from public.bildirim_kuyruk where kullanici_id = o1;
  perform app.bildirim_ekle(o1, 'duyuru', 'x', 'y');
  perform test.dogrula((select count(*) from public.bildirim_kuyruk where kullanici_id = o1) = n, 'kapalı bildirime yazıldı');
  -- Veli haftalık: veli01'in çocuğu ogrenci01
  select * into r from public.sistem_veli_haftalik() v where v.eposta = 'veli01@demo.kmyarena.demo';
  perform test.dogrula(r.veli_id is not null and jsonb_array_length(r.cocuklar) = 1, 'veli haftalık özeti');
  perform test.dogrula(public.sistem_seri_hatirlat() >= 0, 'seri hatırlatma');
end $$;
rollback;

\echo '✔ Tüm veritabanı testleri geçti'



