#!/usr/bin/env bash
# Testa as migrações e a RLS num Postgres local temporário (sem Docker nem Supabase CLI).
# Uso: npm run test:db   (precisa de initdb/pg_ctl/psql do PostgreSQL 15+ no PATH ou em /usr/lib/postgresql)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/.." && pwd)"
bin="$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)"
export PATH="${bin:+$bin:}$PATH"
port="${PGTEST_PORT:-54329}"
dir="$(mktemp -d)"
as_pg=()
if [ "$(id -u)" = 0 ]; then
  chown postgres "$dir"
  as_pg=(runuser -u postgres --)
fi
cleanup() { "${as_pg[@]}" pg_ctl -D "$dir/data" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$dir"; }
trap cleanup EXIT
"${as_pg[@]}" initdb -D "$dir/data" -U postgres -A trust >/dev/null
"${as_pg[@]}" pg_ctl -D "$dir/data" -o "-p $port -k $dir -c listen_addresses=''" -l "$dir/log" -w start >/dev/null
psql_db() { local db="$1"; shift; psql -h "$dir" -p "$port" -U postgres -d "$db" -X -q -v ON_ERROR_STOP=1 "$@"; }
# Cada ficheiro de teste corre numa base de dados nova: os testes não dependem uns dos outros.
setup_db() {
  local db="$1"
  psql_db postgres -c "create database $db" >/dev/null
  psql_db "$db" -f "$here/supabase_stub.sql"
  local m
  for m in "$root"/migrations/*.sql; do psql_db "$db" -f "$m"; done
}
echo "migrações: $(cd "$root/migrations" && ls *.sql | tr '\n' ' ')"
status=0
n=0
for f in "$here"/*.test.sql; do
  n=$((n + 1))
  db="teste_$n"
  if setup_db "$db" && psql_db "$db" -f "$f" >/dev/null; then echo "ok   $(basename "$f")"; else echo "FALHOU $(basename "$f")"; status=1; fi
done
exit $status
