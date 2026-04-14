#!/bin/sh
# scripts/dev.sh
# One-command local development startup.
# Starts Postgres + Redis via Docker, then backend + worker + frontend natively.
#
# Requirements: Docker, Node 18+, npm
# Usage: ./scripts/dev.sh

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo "${GREEN}[dev]${NC} $1"; }
warn()  { echo "${YELLOW}[dev]${NC} $1"; }
error() { echo "${RED}[dev]${NC} $1"; exit 1; }

# ── Check prerequisites ────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || error "Docker is required"
command -v node   >/dev/null 2>&1 || error "Node.js is required"
command -v npm    >/dev/null 2>&1 || error "npm is required"

# ── Start infrastructure ───────────────────────────────────────────────────────
info "Starting Postgres and Redis..."
docker compose up -d postgres redis

info "Waiting for Postgres to be ready..."
until docker compose exec -T postgres pg_isready -U adflow -q 2>/dev/null; do
  printf '.'
  sleep 1
done
echo ""
info "Postgres is ready"

# ── Install dependencies ────────────────────────────────────────────────────────
info "Installing backend dependencies..."
(cd backend && npm install --silent)

info "Installing frontend dependencies..."
(cd frontend && npm install --silent)

# ── Setup backend env ──────────────────────────────────────────────────────────
if [ ! -f backend/.env ]; then
  warn ".env not found — copying from .env.example"
  cp backend/.env.example backend/.env
  warn "Edit backend/.env and add your API keys before using AI/Meta features"
fi

# Override DB/Redis to use docker compose services
export DATABASE_URL="postgresql://adflow:adflow_secret@localhost:5432/adflow"
export REDIS_URL="redis://localhost:6379"

# ── Run migrations ─────────────────────────────────────────────────────────────
info "Running database migrations..."
(cd backend && DATABASE_URL="$DATABASE_URL" npx prisma migrate dev --name init 2>/dev/null || \
              DATABASE_URL="$DATABASE_URL" npx prisma migrate dev)

info "Seeding database..."
(cd backend && DATABASE_URL="$DATABASE_URL" npx ts-node prisma/seed.ts 2>/dev/null || true)

# ── Launch processes ───────────────────────────────────────────────────────────
info "Starting all services..."
info "  Backend API  → http://localhost:3001"
info "  Frontend     → http://localhost:5173"
info "  Worker       → background process"
info ""
info "Press Ctrl+C to stop everything"

# Use trap to kill all background processes on exit
cleanup() {
  info "Shutting down..."
  kill $BACKEND_PID $WORKER_PID $FRONTEND_PID 2>/dev/null || true
  docker compose stop postgres redis
  exit 0
}
trap cleanup INT TERM

# Start backend
(cd backend && DATABASE_URL="$DATABASE_URL" REDIS_URL="$REDIS_URL" npm run dev) &
BACKEND_PID=$!

# Start worker
(cd backend && DATABASE_URL="$DATABASE_URL" REDIS_URL="$REDIS_URL" npm run worker) &
WORKER_PID=$!

# Give backend a moment to start
sleep 3

# Start frontend
(cd frontend && npm run dev) &
FRONTEND_PID=$!

# Wait for all background processes
wait $BACKEND_PID $WORKER_PID $FRONTEND_PID
