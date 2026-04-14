.PHONY: dev build test clean docker-up docker-down migrate seed lint typecheck

# ── Development ────────────────────────────────────────────────────────────────
dev:
	./scripts/dev.sh

dev-docker:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml up

# ── Dependencies ───────────────────────────────────────────────────────────────
install:
	cd backend && npm install
	cd frontend && npm install

# ── Build ─────────────────────────────────────────────────────────────────────
build:
	cd backend && npm run build
	cd frontend && npm run build

# ── Testing ────────────────────────────────────────────────────────────────────
test:
	cd backend && npm test

test-watch:
	cd backend && npm run test:watch

test-coverage:
	cd backend && npm run test:coverage

# ── Code quality ──────────────────────────────────────────────────────────────
typecheck:
	cd backend && npm run typecheck
	cd frontend && npm run typecheck

lint:
	cd backend && npm run lint || true
	cd frontend && npm run lint || true

# ── Database ──────────────────────────────────────────────────────────────────
migrate:
	cd backend && npx prisma migrate dev

migrate-prod:
	cd backend && npx prisma migrate deploy

seed:
	cd backend && npx ts-node prisma/seed.ts

studio:
	cd backend && npx prisma studio

generate:
	cd backend && npx prisma generate

# ── Docker ─────────────────────────────────────────────────────────────────────
docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-build:
	docker compose build

docker-logs:
	docker compose logs -f backend worker

docker-prod:
	docker compose up -d
	docker compose logs -f

# ── Cleanup ────────────────────────────────────────────────────────────────────
clean:
	rm -rf backend/dist backend/node_modules
	rm -rf frontend/dist frontend/node_modules
	docker compose down -v

# ── Production helpers ────────────────────────────────────────────────────────
deploy-check:
	@echo "Checking required env vars..."
	@test -n "$$DATABASE_URL"        || (echo "Missing DATABASE_URL" && exit 1)
	@test -n "$$JWT_SECRET"          || (echo "Missing JWT_SECRET" && exit 1)
	@test -n "$$ANTHROPIC_API_KEY"   || (echo "Missing ANTHROPIC_API_KEY" && exit 1)
	@test -n "$$META_ACCESS_TOKEN"   || (echo "Missing META_ACCESS_TOKEN" && exit 1)
	@echo "All required env vars present ✓"
