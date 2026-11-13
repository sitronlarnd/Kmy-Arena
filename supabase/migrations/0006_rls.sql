-- ─────────────────────────────────────────────────────────────
-- 0006 · Satır bazlı güvenlik (RLS)
--
-- İlkeler
--  • Tenant ayrımı veritabanında: kullanıcı yalnızca kendi dershanesinin
--    satırlarını görür.
--  • Puan, beceri, cevap, XP, havuz istatistikleri İSTEMCİDEN YAZILAMAZ;
--    yalnızca sunucu (service role / SECURITY DEFINER fonksiyonlar) yazar.
--  • Öğrenciler soru tablosunu okuyamaz (cevap anahtarı).
--  • Merkez Panel işlemleri sunucuda service role ile, yetki kontrolü ve
--    denetim kaydıyla yapılır; RLS'te merkez için genel istisna yoktur.
-- ─────────────────────────────────────────────────────────────

-- Supabase varsayılan olarak tablolara anon/authenticated için tüm
-- ayrıcalıkları verir; koruma RLS'tedir. Tümünde RLS'i aç.
do $$
declare t record;
begin
  for t in
    select c.oid::regclass as tablo
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
  loop
    execute format('alter table %s enable row level security', t.tablo);
  end loop;
end $$;

-- Yeni cevap bölümleri de RLS'li doğsun (bölümlere doğrudan erişim kapalı)
create or replace function app.cevap_bolumu_olustur(p_ay date)
returns text
language plpgsql
set search_path = ''
as $$
declare
  bas date := date_trunc('month', p_ay)::date;
  ad text := format('cevap_%s', to_char(bas, 'YYYY_MM'));
begin
  if to_regclass('public.' || ad) is null then
    execute format(
      'create table public.%I partition of public.cevap for values from (%L) to (%L)',
      ad, bas, (bas + interval '1 month')::date
    );
    execute format('alter table public.%I enable row level security', ad);
  end if;
  return ad;
end;
$$;

-- ── Yardımcılar ──

create or replace function app.ogretmeni_mi(p_ogrenci uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.sinif_uyelik t
    join public.sinif_uyelik s on s.sinif_id = t.sinif_id
    where t.kullanici_id = auth.uid() and t.rol = 'ogretmen'
      and s.kullanici_id = p_ogrenci and s.rol = 'ogrenci'
  )
$$;

create or replace function app.velisi_mi(p_ogrenci uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.veli_bag v
    where v.veli_id = auth.uid() and v.ogrenci_id = p_ogrenci and v.onay_tarihi is not null
  )
$$;

create or replace function app.sinifin_ogretmeni_mi(p_sinif uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.sinif_uyelik t
    where t.sinif_id = p_sinif and t.kullanici_id = auth.uid() and t.rol = 'ogretmen'
  )
$$;

/** Öğrencinin kimlik bilgisini (ad, soyad) görebilir mi? */
create or replace function app.ogrenci_kimlik_okuyabilir(p_ogrenci uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_ogrenci = auth.uid()
      or app.velisi_mi(p_ogrenci)
      or app.ogretmeni_mi(p_ogrenci)
      or exists (
        select 1 from public.kullanici k
        where k.id = p_ogrenci
          and app.yetkisi_var('ogrenci.kimlik_oku', k.dershane_id, k.sube_id)
      )
$$;

/** Öğrencinin akademik verisini (beceri, cevap, hata defteri…) görebilir mi? */
create or replace function app.ogrenci_akademik_okuyabilir(p_ogrenci uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_ogrenci = auth.uid()
      or app.velisi_mi(p_ogrenci)
      or app.ogretmeni_mi(p_ogrenci)
      or exists (
        select 1 from public.kullanici k
        where k.id = p_ogrenci
          and app.yetkisi_var('ogrenci.akademik_oku', k.dershane_id, k.sube_id)
      )
$$;

-- ── Tenant çekirdeği ──

create policy paket_oku on public.paket for select to authenticated
  using (id = (select d.paket_id from public.dershane d where d.id = app.dershane_id()));

create policy dershane_oku on public.dershane for select to authenticated
  using (id = app.dershane_id());
create policy dershane_marka_guncelle on public.dershane for update to authenticated
  using (app.yetkisi_var('dershane.ayar', id))
  with check (app.yetkisi_var('dershane.ayar', id));
-- Lisans, limit, paket gibi alanlar yalnızca Merkezden değişir.
revoke update on public.dershane from anon, authenticated;
grant update (logo_url, ana_renk, uygulama_ici_ad) on public.dershane to authenticated;

create policy sube_oku on public.sube for select to authenticated
  using (dershane_id = app.dershane_id());
create policy sube_yaz on public.sube for all to authenticated
  using (app.yetkisi_var('sube.yonet', dershane_id))
  with check (app.yetkisi_var('sube.yonet', dershane_id));

create policy sinif_oku on public.sinif for select to authenticated
  using (dershane_id = app.dershane_id());
create policy sinif_yaz on public.sinif for all to authenticated
  using (app.yetkisi_var('sinif.yonet', dershane_id, sube_id))
  with check (app.yetkisi_var('sinif.yonet', dershane_id, sube_id));

-- Kullanıcı: öğrenciler birbirinin kimliğini GÖREMEZ (yalnızca takma ad,
-- public.profil_ozet() üzerinden). Personel kayıtlarını yöneticiler görür.
create policy kullanici_oku on public.kullanici for select to authenticated
  using (
    id = auth.uid()
    or (tur = 'ogrenci' and app.ogrenci_kimlik_okuyabilir(id))
    or (tur = 'veli' and dershane_id = app.dershane_id() and app.yetkisi_var('veli.davet', dershane_id, sube_id))
    or (tur = 'personel' and dershane_id = app.dershane_id()
        and (app.yetkisi_var('ogretmen.yonet', dershane_id) or app.yetkisi_var('ogretmen.takip', dershane_id, sube_id)))
  );
create policy kullanici_kendini_guncelle on public.kullanici for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
-- Kullanıcı kendi kaydında yalnızca takma adını değiştirebilir.
revoke insert, update, delete on public.kullanici from anon, authenticated;
grant update (takma_ad) on public.kullanici to authenticated;

/** Diğer öğrencilere görünen tek bilgi: takma ad (dershane içi). */
create or replace function public.profil_ozet(p_kullanicilar uuid[])
returns table (id uuid, takma_ad text)
language sql stable security definer set search_path = ''
as $$
  select k.id, k.takma_ad::text
  from public.kullanici k
  where k.id = any (p_kullanicilar) and k.dershane_id = app.dershane_id() and k.tur = 'ogrenci'
$$;

create policy sinif_uyelik_oku on public.sinif_uyelik for select to authenticated
  using (
    kullanici_id = auth.uid()
    or (dershane_id = app.dershane_id() and app.ogrenci_kimlik_okuyabilir(kullanici_id))
    or app.sinifin_ogretmeni_mi(sinif_id)
  );
create policy sinif_uyelik_yaz on public.sinif_uyelik for all to authenticated
  using (app.yetkisi_var('ogrenci.ekle', dershane_id, (select s.sube_id from public.sinif s where s.id = sinif_id)))
  with check (app.yetkisi_var('ogrenci.ekle', dershane_id, (select s.sube_id from public.sinif s where s.id = sinif_id)));

create policy veli_bag_oku on public.veli_bag for select to authenticated
  using (veli_id = auth.uid() or ogrenci_id = auth.uid() or app.yetkisi_var('veli.davet', dershane_id));

create policy davet_kodu_yonet on public.davet_kodu for all to authenticated
  using (app.yetkisi_var('ogrenci.ekle', dershane_id, sube_id) or app.yetkisi_var('veli.davet', dershane_id, sube_id))
  with check (app.yetkisi_var('ogrenci.ekle', dershane_id, sube_id) or app.yetkisi_var('veli.davet', dershane_id, sube_id));

-- ── RBAC ──
create policy rol_oku on public.rol for select to authenticated using (true);
create policy yetki_oku on public.yetki for select to authenticated using (true);
create policy rol_yetki_oku on public.rol_yetki for select to authenticated
  using (dershane_id is null or dershane_id = app.dershane_id());
-- Kurucu yalnızca kendi dershanesinin, dershane kapsamlı rollerinin
-- yetkilerini ince ayarlar; merkez yetkisi veremez.
create policy rol_yetki_yaz on public.rol_yetki for all to authenticated
  using (dershane_id is not null and app.yetkisi_var('dershane.rol_ata', dershane_id))
  with check (
    dershane_id is not null
    and app.yetkisi_var('dershane.rol_ata', dershane_id)
    and yetki_kod not like 'merkez.%' and yetki_kod not like 'bayi.%'
    and (select r.kapsam from public.rol r where r.kod = rol_kod) <> 'merkez'
  );

create policy kullanici_rol_oku on public.kullanici_rol for select to authenticated
  using (kullanici_id = auth.uid() or (dershane_id is not null and app.yetkisi_var('dershane.rol_ata', dershane_id)));
create policy kullanici_rol_yaz on public.kullanici_rol for all to authenticated
  using (dershane_id is not null and app.yetkisi_var('dershane.rol_ata', dershane_id))
  with check (
    dershane_id is not null
    and app.yetkisi_var('dershane.rol_ata', dershane_id)
    and (select r.kapsam from public.rol r where r.kod = rol_kod) <> 'merkez'
    and exists (select 1 from public.kullanici k where k.id = kullanici_id and k.dershane_id = kullanici_rol.dershane_id)
  );

-- ── Ayarlar ──
create policy ozellik_bayragi_oku on public.ozellik_bayragi for select to authenticated
  using (dershane_id is null or dershane_id = app.dershane_id());
create policy oyun_ayari_oku on public.oyun_ayari_surumu for select to authenticated
  using (durum = 'yayinda');
create policy uygulama_ayari_oku on public.uygulama_ayari for select to anon, authenticated
  using (true);
-- ai_gorev_ayari, prompt_surumu: politika yok → yalnızca sunucu.

-- ── Müfredat (herkese açık, salt okunur) ──
create policy ders_oku on public.ders for select to authenticated using (true);
create policy unite_oku on public.unite for select to authenticated using (true);
create policy kazanim_oku on public.kazanim for select to authenticated using (true);

-- ── Akademik veri: yalnızca okuma; yazma sunucuda ──
create policy beceri_oku on public.beceri for select to authenticated
  using (dershane_id = app.dershane_id() and app.ogrenci_akademik_okuyabilir(kullanici_id));
create policy cevap_oku on public.cevap for select to authenticated
  using (dershane_id = app.dershane_id() and app.ogrenci_akademik_okuyabilir(kullanici_id));
create policy soru_gosterim_oku on public.soru_gosterim for select to authenticated
  using (kullanici_id = auth.uid());

-- Soru: öğrenci HİÇ okuyamaz. Öğretmen/yönetici yalnızca kendi
-- dershanesinin öğretmen sorularını okur. AI havuzu yalnızca sunucuda.
create policy soru_ogretmen_oku on public.soru for select to authenticated
  using (kaynak = 'ogretmen' and dershane_id = app.dershane_id()
         and (app.yetkisi_var('soru.yukle', dershane_id) or app.yetkisi_var('odev.yonet', dershane_id, app.sube_id())));

-- ── Kayıtlar ──
create policy denetim_log_oku on public.denetim_log for select to authenticated
  using (dershane_id is not null and app.yetkisi_var('dershane.ayar', dershane_id));
-- ai_cagri_log, teklif: politika yok → yalnızca sunucu.

-- Yazma: puan/beceri/cevap/havuz/log tablolarına istemciden yazma yetkisi
-- tümden kaldırılır (RLS'e ek ikinci savunma hattı).
revoke insert, update, delete on
  public.beceri, public.cevap, public.cevap_varsayilan, public.soru, public.soru_gosterim,
  public.ai_cagri_log, public.denetim_log, public.teklif, public.ai_gorev_ayari,
  public.prompt_surumu, public.oyun_ayari_surumu, public.uygulama_ayari, public.ozellik_bayragi,
  public.paket, public.ders, public.unite, public.kazanim, public.rol, public.yetki, public.veli_bag
from anon, authenticated;
