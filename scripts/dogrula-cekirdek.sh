#!/usr/bin/env bash
# Bağımlılık yüklemeden çalışabilen doğrulama: paylaşılan paketlerin tip
# kontrolü + birim testleri + müfredat üretimi + veritabanı testleri.
# Gereken: Node 22+, global typescript ve tsx, PostgreSQL 16.
# Tam doğrulama (lint, uygulama derlemeleri) için: pnpm install && pnpm dogrula
set -euo pipefail
KOK="$(cd "$(dirname "$0")/.." && pwd)"
cd "$KOK"

echo "═══ 1/4 Tip kontrolü (packages/*, katı mod)"
for p in shared ai realtime; do
  tsc -p "packages/$p/tsconfig.json" && echo "  ✔ @kmy/$p"
done

echo "═══ 2/4 Birim testleri"
for p in shared ai realtime; do
  (cd "packages/$p" && tsx --test test/*.test.ts 2>&1 | grep -E "^# (tests|pass|fail) " | tr '\n' ' ' | sed "s/^/  @kmy\/$p: /"; echo)
  (cd "packages/$p" && tsx --test test/*.test.ts >/dev/null 2>&1) || { echo "  ✖ @kmy/$p testleri başarısız"; exit 1; }
done

echo "═══ 3/4 Müfredat JSON → SQL (değişiklik olmamalı)"
tsx scripts/mufredat-sql.ts 2>&1 | sed 's/^/  /'
if command -v git >/dev/null && git rev-parse --git-dir >/dev/null 2>&1 && git ls-files --error-unmatch supabase/seed/01_mufredat.sql >/dev/null 2>&1; then
  git diff --exit-code --stat supabase/seed/01_mufredat.sql && echo "  ✔ üretilen SQL güncel"
fi

echo "═══ 4/4 Veritabanı: migration + seed + RLS testleri"
bash scripts/db-test.sh

echo "✔ Çekirdek doğrulama tamamlandı"
