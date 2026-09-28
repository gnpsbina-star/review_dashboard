#!/usr/bin/env bash
# Prepares a fresh Claude Code cloud session: dependencies, local Postgres, migrations.
set -euo pipefail
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}"

[ -d node_modules ] || npm ci --no-audit --no-fund

if command -v pg_lsclusters >/dev/null 2>&1; then
  service postgresql start >/dev/null 2>&1 || true
  for i in 1 2 3 4 5; do pg_isready -q && break; sleep 1; done
  su postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='srp'\" | grep -q 1 || psql -c \"CREATE USER srp WITH PASSWORD 'srp' CREATEDB\"" >/dev/null
  for db in srp_dev srp_test; do
    su postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='$db'\" | grep -q 1 || psql -c \"CREATE DATABASE $db OWNER srp\"" >/dev/null
  done
fi

if [ ! -f .env ]; then
  cat > .env <<'ENV'
DATABASE_URL="postgresql://srp:srp@localhost:5432/srp_dev"
APP_URL="http://localhost:3000"
FIELD_ENCRYPTION_KEY="dGVzdC1vbmx5LWtleS0zMi1ieXRlcy1sb25nLTAwMDA="
HASH_SECRET="local-dev-hash-secret-change-me-please-0123"
CRON_SECRET="local-dev-cron-secret-0123456789"
PLATFORM_OWNER_EMAILS="owner@synergy.test"
DEV_LOGIN_ENABLED="true"
AI_PROVIDER="MOCK"
ENV
fi

npx prisma migrate deploy >/dev/null
npx prisma generate >/dev/null
echo "Ready: npm run dev · npm test · SEED_DEMO=true npm run db:seed"
