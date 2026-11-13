#!/usr/bin/env bash
# Migration'ları (ve istenirse seed'i) canlı/demo Supabase veritabanına uygular.
#
#   SUPABASE_DB_URL=... bash scripts/db-yukle.sh [--seed]
#
# • Uygulanan migration'lar `public.kmy_migration` tablosunda tutulur; her
#   dosya yalnızca bir kez çalışır. Yeni migration eklenince tekrar çalıştırmak
#   yeterli.
# • Her migration tek işlem (transaction) içinde çalışır; hata olursa o dosya
#   geri alınır ve betik durur.
# • Müfredat (01_mufredat.sql) her çalıştırmada yüklenir/günceller.
# • --seed: demo verisi (02_demo.sql). DEMO hesapları içerir, gerçek
#   dershane verisinin olduğu veritabanında --seed kullanma.
set -euo pipefail

KOK="$(cd "$(dirname "$0")/.." && pwd)"
: "${SUPABASE_DB_URL:?SUPABASE_DB_URL tanımlı değil}"

SEED=0
TEK_SEED=""
[[ "${1:-}" == "--seed" ]] && SEED=1
# --seed-dosya 03_klan_demo.sql: yalnızca o seed dosyasını (tekrar çalıştırılabilir olanlar) yükler
[[ "${1:-}" == "--seed-dosya" ]] && TEK_SEED="${2:?dosya adı gerekli}"

PSQL=(psql "$SUPABASE_DB_URL" -X -q -v ON_ERROR_STOP=1 --no-psqlrc)

"${PSQL[@]}" -c "create table if not exists public.kmy_migration (
  ad text primary key,
  uygulandi timestamptz not null default now()
);
alter table public.kmy_migration enable row level security;
revoke all on public.kmy_migration from anon, authenticated;" >/dev/null

for f in "$KOK"/supabase/migrations/*.sql; do
  ad="$(basename "$f")"
  var="$("${PSQL[@]}" -tA -c "select 1 from public.kmy_migration where ad = '$ad'")"
  if [[ "$var" == "1" ]]; then
    echo "• Atlandı (zaten uygulanmış): $ad"
    continue
  fi
  echo "• Migration: $ad"
  "${PSQL[@]}" -1 -f "$f" -c "insert into public.kmy_migration (ad) values ('$ad')" >/dev/null
done

# Müfredat her zaman yüklenir (demo verisi değildir; tekrar çalıştırılabilir).
echo "• Müfredat: 01_mufredat.sql"
"${PSQL[@]}" -1 -f "$KOK/supabase/seed/01_mufredat.sql" >/dev/null

if [[ "$SEED" == "1" ]]; then
  for f in "$KOK"/supabase/seed/*.sql; do
    [[ "$(basename "$f")" == "01_mufredat.sql" ]] && continue
    echo "• Seed: $(basename "$f")"
    "${PSQL[@]}" -1 -f "$f" >/dev/null
  done
fi

if [[ -n "$TEK_SEED" ]]; then
  [[ "$TEK_SEED" =~ ^[0-9a-z_]+\.sql$ && -f "$KOK/supabase/seed/$TEK_SEED" ]] || { echo "Seed dosyası yok: $TEK_SEED"; exit 1; }
  echo "• Seed (tek): $TEK_SEED"
  "${PSQL[@]}" -1 -f "$KOK/supabase/seed/$TEK_SEED" >/dev/null
fi

echo "✔ Veritabanı güncel"
