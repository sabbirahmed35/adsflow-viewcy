#!/bin/sh
# scripts/migrate.sh
# Run before every production deployment.
# Applies pending Prisma migrations and optionally seeds.
#
# Usage:
#   ./scripts/migrate.sh              # migrate only
#   SEED=true ./scripts/migrate.sh   # migrate + seed (first deploy only)

set -e

echo "🗄️  Running database migrations..."

cd "$(dirname "$0")/../backend"

# Ensure DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌  DATABASE_URL is not set"
  exit 1
fi

# Apply migrations
npx prisma migrate deploy
echo "✅  Migrations applied"

# Seed (only when explicitly requested, e.g. first deploy)
if [ "$SEED" = "true" ]; then
  echo "🌱  Seeding database..."
  npx ts-node prisma/seed.ts
  echo "✅  Seed complete"
fi

echo "✅  Database ready"
