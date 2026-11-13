-- ─────────────────────────────────────────────────────────────
-- 0003 · Rol-yetki matrisi (RBAC)
-- Yetki kodları ve varsayılan matris packages/shared/src/rbac.ts ile
-- birebir aynıdır (test/havuz-bayrak-rbac.test.ts denetler). Kurucu,
-- dershane içi rollerin yetkilerini kendi dershanesi için ezebilir:
-- (dershane_id, rol) için en az bir kayıt varsa o set geçerlidir.
-- ─────────────────────────────────────────────────────────────

create table public.rol (
  kod text primary key,
  ad text not null,
  kapsam text not null check (kapsam in ('merkez', 'dershane', 'sube'))
);

create table public.yetki (
  kod text primary key,
  aciklama text not null
);

create table public.rol_yetki (
  id uuid primary key default gen_random_uuid(),
  dershane_id uuid references public.dershane (id) on delete cascade, -- null = varsayılan matris
  rol_kod text not null references public.rol (kod) on delete cascade,
  yetki_kod text not null references public.yetki (kod) on delete cascade,
  olusturma timestamptz not null default now(),
  unique nulls not distinct (dershane_id, rol_kod, yetki_kod)
);

create table public.kullanici_rol (
  id uuid primary key default gen_random_uuid(),
  kullanici_id uuid not null references public.kullanici (id) on delete cascade,
  rol_kod text not null references public.rol (kod),
  dershane_id uuid references public.dershane (id) on delete cascade, -- merkez rollerinde null
  sube_id uuid references public.sube (id) on delete cascade,          -- null = tüm dershane
  olusturma timestamptz not null default now(),
  unique nulls not distinct (kullanici_id, rol_kod, dershane_id, sube_id)
);
create index kullanici_rol_kullanici on public.kullanici_rol (kullanici_id);

-- @yetkiler-basla
insert into public.yetki (kod, aciklama) values
  ('merkez.dershane_yonet', 'Dershane, paket ve lisans yönetimi'),
  ('merkez.ozellik_bayragi', 'Özellik bayraklarını açma/kapama'),
  ('merkez.ai_yonet', 'AI Merkezi: model ve görev ayarları'),
  ('merkez.prompt_yonet', 'Prompt stüdyosu ve A/B testleri'),
  ('merkez.mufredat_yonet', 'Müfredat ağacı düzenleme'),
  ('merkez.ekonomi_yonet', 'Oyun ekonomisi ve içerik tanımları'),
  ('merkez.moderasyon', 'Merkez moderasyon'),
  ('merkez.satis', 'Teklif, pilot ve satış hunisi'),
  ('merkez.finans', 'Fatura, ödeme ve bayi komisyonları'),
  ('merkez.destek', 'Destek talepleri ve salt okunur dershane görünümü'),
  ('merkez.denetim_oku', 'Denetim kayıtlarını görme'),
  ('merkez.sistem', 'Sistem, sürüm ve bakım ayarları'),
  ('bayi.kendi_dershaneleri', 'Bayinin kendi getirdiği dershaneler'),
  ('dershane.ayar', 'Dershane ayarları ve marka'),
  ('dershane.lisans', 'Lisans ve faturalar'),
  ('dershane.rol_ata', 'Ekip rolleri atama'),
  ('sube.yonet', 'Şube yönetimi'),
  ('sinif.yonet', 'Sınıf/grup yönetimi'),
  ('ogrenci.ekle', 'Öğrenci ekleme, sınıf değiştirme'),
  ('ogrenci.kimlik_oku', 'Öğrenci kimlik/iletişim bilgisi'),
  ('ogrenci.akademik_oku', 'Öğrenci akademik verisi'),
  ('ogretmen.yonet', 'Öğretmen atama ve yetkileri'),
  ('ogretmen.takip', 'Öğretmen kullanım raporları'),
  ('veli.davet', 'Veli davetleri'),
  ('odev.yonet', 'Ödev ve etkinlik oluşturma'),
  ('soru.yukle', 'Soru ve çözüm yükleme'),
  ('soru.ai_uret', 'AI ile soru ürettirme'),
  ('moderasyon.yap', 'Topluluk ve klan moderasyonu'),
  ('rapor.oku', 'Dershane raporları'),
  ('rehberlik.oku', 'Rehberlik notları ve risk uyarıları'),
  ('rehberlik.yaz', 'Rehberlik notu yazma'),
  ('deneme.ice_aktar', 'Deneme sonucu içe aktarma'),
  ('odul.yonet', 'Ödül ve turnuva yönetimi'),
  ('destek.talep', 'Merkeze destek talebi açma'),
  ('soru.coz', 'Soru çözme'),
  ('duello.oyna', 'Düello'),
  ('klan.katil', 'Klan'),
  ('topluluk.yaz', 'Topluluk soru-cevap'),
  ('veli.rapor_oku', 'Kendi çocuğunun raporu');
-- @yetkiler-bitir

insert into public.rol (kod, ad, kapsam) values
  ('merkez_sahip', 'Sahip', 'merkez'),
  ('merkez_icerik', 'İçerik editörü', 'merkez'),
  ('merkez_destek', 'Destek', 'merkez'),
  ('merkez_satis', 'Satış', 'merkez'),
  ('bayi', 'Bayi', 'merkez'),
  ('kurucu', 'Dershane kurucusu', 'dershane'),
  ('sube_muduru', 'Şube müdürü', 'sube'),
  ('rehber_ogretmen', 'Rehber öğretmen', 'dershane'),
  ('ogretmen', 'Öğretmen', 'dershane'),
  ('sekreter', 'Sekreter / kayıt görevlisi', 'sube'),
  ('ogrenci', 'Öğrenci', 'dershane'),
  ('veli', 'Veli', 'dershane');

-- @matris-basla
insert into public.rol_yetki (rol_kod, yetki_kod)
select r.kod, unnest(r.yetkiler) from (values
  ('merkez_sahip', array['merkez.dershane_yonet', 'merkez.ozellik_bayragi', 'merkez.ai_yonet', 'merkez.prompt_yonet', 'merkez.mufredat_yonet', 'merkez.ekonomi_yonet', 'merkez.moderasyon', 'merkez.satis', 'merkez.finans', 'merkez.destek', 'merkez.denetim_oku', 'merkez.sistem']::text[]),
  ('merkez_icerik', array['merkez.mufredat_yonet', 'merkez.prompt_yonet', 'merkez.ekonomi_yonet']::text[]),
  ('merkez_destek', array['merkez.destek']::text[]),
  ('merkez_satis', array['merkez.satis']::text[]),
  ('bayi', array['bayi.kendi_dershaneleri']::text[]),
  ('kurucu', array['dershane.ayar', 'dershane.lisans', 'dershane.rol_ata', 'sube.yonet', 'sinif.yonet', 'ogrenci.ekle', 'ogrenci.kimlik_oku', 'ogrenci.akademik_oku', 'ogretmen.yonet', 'ogretmen.takip', 'veli.davet', 'odev.yonet', 'moderasyon.yap', 'rapor.oku', 'rehberlik.oku', 'deneme.ice_aktar', 'odul.yonet', 'destek.talep']::text[]),
  ('sube_muduru', array['sinif.yonet', 'ogrenci.ekle', 'ogrenci.kimlik_oku', 'ogrenci.akademik_oku', 'ogretmen.takip', 'veli.davet', 'odev.yonet', 'moderasyon.yap', 'rapor.oku', 'deneme.ice_aktar', 'odul.yonet']::text[]),
  ('rehber_ogretmen', array['ogrenci.kimlik_oku', 'ogrenci.akademik_oku', 'rehberlik.oku', 'rehberlik.yaz', 'rapor.oku']::text[]),
  ('ogretmen', array['odev.yonet', 'soru.yukle', 'soru.ai_uret', 'moderasyon.yap']::text[]),
  ('sekreter', array['ogrenci.ekle', 'ogrenci.kimlik_oku', 'veli.davet']::text[]),
  ('ogrenci', array['soru.coz', 'duello.oyna', 'klan.katil', 'topluluk.yaz']::text[]),
  ('veli', array['veli.rapor_oku']::text[])
) as r (kod, yetkiler);
-- @matris-bitir

-- ── RLS yardımcıları (SECURITY DEFINER: RLS özyinelemesini önler) ──

create or replace function app.dershane_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select k.dershane_id from public.kullanici k where k.id = auth.uid() $$;

create or replace function app.sube_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$ select k.sube_id from public.kullanici k where k.id = auth.uid() $$;

/**
 * Oturumdaki kullanıcının, verilen dershane (ve şube) kapsamında yetkisi var mı?
 * p_dershane null → merkez yetkisi aranır.
 * Şube kapsamlı rol (sube_id dolu) yalnızca kendi şubesindeki kaynakta geçerlidir.
 */
create or replace function app.yetkisi_var(p_yetki text, p_dershane uuid default null, p_sube uuid default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.kullanici_rol kr
    where kr.kullanici_id = auth.uid()
      and kr.dershane_id is not distinct from p_dershane
      and (kr.sube_id is null or kr.sube_id = p_sube)
      and (
        exists (
          select 1 from public.rol_yetki ry
          where ry.dershane_id = kr.dershane_id and ry.rol_kod = kr.rol_kod and ry.yetki_kod = p_yetki
        )
        or (
          not exists (
            select 1 from public.rol_yetki ry
            where ry.dershane_id = kr.dershane_id and ry.rol_kod = kr.rol_kod
          )
          and exists (
            select 1 from public.rol_yetki ry
            where ry.dershane_id is null and ry.rol_kod = kr.rol_kod and ry.yetki_kod = p_yetki
          )
        )
      )
  )
$$;

/** İstemcinin menü/ekran göstermek için kendi yetkilerini öğrenmesi. */
create or replace function public.yetkilerim()
returns table (yetki_kod text, dershane_id uuid, sube_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct y.kod, kr.dershane_id, kr.sube_id
  from public.kullanici_rol kr
  cross join public.yetki y
  where kr.kullanici_id = auth.uid()
    and (
      exists (select 1 from public.rol_yetki ry where ry.dershane_id = kr.dershane_id and ry.rol_kod = kr.rol_kod and ry.yetki_kod = y.kod)
      or (not exists (select 1 from public.rol_yetki ry where ry.dershane_id = kr.dershane_id and ry.rol_kod = kr.rol_kod)
          and exists (select 1 from public.rol_yetki ry where ry.dershane_id is null and ry.rol_kod = kr.rol_kod and ry.yetki_kod = y.kod))
    )
$$;
