#!/usr/bin/env bash
# Migration + seed + RLS testlerini temiz bir PostgreSQL 16 üzerinde çalıştırır.
#
#  • DB_TEST_URL verilmişse o sunucuyu kullanır (CI: postgres:16 servisi).
#    DİKKAT: Hedef veritabanı tamamen silinip yeniden kurulur — asla canlı
#    Supabase adresi verme.
#  • Verilmemişse yerelde geçici bir küme (pg_ctl) açar, iş bitince kapatır.
set -euo pipefail

KOK="$(cd "$(dirname "$0")/.." && pwd)"
GECICI=""

temizle() {
  if [[ -n "$GECICI" ]]; then
    sudo_pg pg_ctl -D "$GECICI/veri" -m immediate stop >/dev/null 2>&1 || true
    rm -rf "$GECICI"
  fi
}
trap temizle EXIT

sudo_pg() {
  # Postgres root olarak çalışmaz; root isek postgres kullanıcısına geç.
  local bin
  bin="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)"
  if [[ "$(id -u)" == "0" ]]; then
    su postgres -s /bin/bash -c "PATH=$bin:\$PATH $(printf '%q ' "$@")"
  else
    PATH="$bin:$PATH" "$@"
  fi
}

if [[ -z "${DB_TEST_URL:-}" ]]; then
  GECICI="$(mktemp -d /tmp/kmy-pg-XXXXXX)"
  chmod 777 "$GECICI"
  PORT=54329
  sudo_pg initdb -D "$GECICI/veri" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
  sudo_pg pg_ctl -D "$GECICI/veri" -o "-p $PORT -k $GECICI -c listen_addresses=''" -l "$GECICI/log" -w start >/dev/null
  DB_TEST_URL="postgresql://postgres@/postgres?host=$GECICI&port=$PORT"
fi

PSQL=(psql "$DB_TEST_URL" -X -q -v ON_ERROR_STOP=1 --no-psqlrc)

echo "• Veritabanı sıfırlanıyor"
"${PSQL[@]}" -c "drop schema if exists public cascade; drop schema if exists app cascade; drop schema if exists test cascade; drop schema if exists auth cascade; create schema public;" >/dev/null

echo "• Supabase yerel taklidi"
"${PSQL[@]}" -f "$KOK/supabase/tests/00_supabase_yerel_taklit.sql" >/dev/null

for f in "$KOK"/supabase/migrations/*.sql; do
  echo "• Migration: $(basename "$f")"
  "${PSQL[@]}" -f "$f" >/dev/null
done

for f in "$KOK"/supabase/seed/*.sql; do
  echo "• Seed: $(basename "$f")"
  "${PSQL[@]}" -f "$f" >/dev/null
done

echo "• Seed tekrar çalıştırılabilir mi (idempotent)"
for f in "$KOK"/supabase/seed/*.sql; do "${PSQL[@]}" -f "$f" >/dev/null; done

echo "• Testler"
"${PSQL[@]}" -o /dev/null -f "$KOK/supabase/tests/01_rls_test.sql"
