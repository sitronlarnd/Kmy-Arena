-- ─────────────────────────────────────────────────────────────
-- 0001 · Temel: uzantılar, yardımcı şema ve fonksiyonlar
-- ─────────────────────────────────────────────────────────────

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

-- Uygulama yardımcı fonksiyonları (RLS yardımcıları vb.) bu şemada durur.
create schema if not exists app;
grant usage on schema app to anon, authenticated, service_role;

-- guncelleme alanını otomatik yeniler
create or replace function app.guncelleme_damgasi()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.guncelleme := now();
  return new;
end;
$$;

-- Bir tabloya standart guncelleme tetikleyicisini ekler
create or replace function app.guncelleme_tetikleyicisi_ekle(tablo regclass)
returns void
language plpgsql
set search_path = ''
as $$
begin
  execute format(
    'create trigger guncelleme_damgasi before update on %s for each row execute function app.guncelleme_damgasi()',
    tablo
  );
end;
$$;

-- Tohum verisi için kararlı UUID (aynı metin → aynı UUID)
create or replace function app.sabit_uuid(metin text)
returns uuid
language sql
immutable
set search_path = ''
as $$ select md5(metin)::uuid $$;

-- FNV-1a 32 bit; packages/shared/src/ozellik-bayraklari.ts → kova() ile aynı
-- (ASCII girdiler için birebir; bayrak kodları ve UUID'ler ASCII'dir).
create or replace function app.kova(anahtar text)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  h bigint := 2166136261;
  b integer;
begin
  for i in 1..length(anahtar) loop
    b := ascii(substr(anahtar, i, 1));
    h := (h # b) & 4294967295;
    h := (h * 16777619) & 4294967295;
  end loop;
  return (h % 100)::integer;
end;
$$;
