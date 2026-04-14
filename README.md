# AdFlow — Facebook Ads Automation Platform

Full-stack SaaS application for creating, managing, approving, and publishing Facebook (Meta) ad campaigns automatically.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Queue | BullMQ + Redis |
| Storage | AWS S3 |
| AI | Anthropic Claude API |
| Ads | Meta Marketing API |
| Auth | JWT (access + refresh tokens) |

## Project Structure

```
adflow/
├── backend/
│   ├── src/
│   │   ├── controllers/     # Route handlers
│   │   ├── services/        # Business logic
│   │   ├── repositories/    # Database access
│   │   ├── middleware/       # Auth, validation, error handling
│   │   ├── jobs/            # BullMQ background jobs
│   │   ├── config/          # App configuration
│   │   └── utils/           # Shared utilities
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route-level page components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── lib/             # API client, utilities
│   │   ├── store/           # Zustand state management
│   │   └── types/           # TypeScript types
│   └── package.json
└── shared/
    └── types.ts             # Shared types (frontend + backend)
```

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- AWS account (S3)
- Meta Developer account
- Anthropic API key

### 1. Clone & install

```bash
git clone https://github.com/yourorg/adflow
cd adflow

# Install backend deps
cd backend && npm install

# Install frontend deps
cd ../frontend && npm install
```

### 2. Configure environment

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials

# Frontend
cp frontend/.env.example frontend/.env
```

### 3. Database setup

```bash
cd backend
npx prisma migrate dev --name init
npx prisma db seed
```

### 4. Start development servers

```bash
# Terminal 1 — Backend
cd backend && npm run dev

# Terminal 2 — Frontend
cd frontend && npm run dev

# Terminal 3 — Queue worker
cd backend && npm run worker
```

Backend runs on http://localhost:3001  
Frontend runs on http://localhost:5173

## Environment Variables

### Backend `.env`

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/adflow"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="your-jwt-secret-min-32-chars"
JWT_REFRESH_SECRET="your-refresh-secret-min-32-chars"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# AWS S3
AWS_ACCESS_KEY_ID="your-aws-key"
AWS_SECRET_ACCESS_KEY="your-aws-secret"
AWS_REGION="us-east-1"
AWS_S3_BUCKET="adflow-creatives"

# Meta Marketing API
META_APP_ID="your-meta-app-id"
META_APP_SECRET="your-meta-app-secret"
META_ACCESS_TOKEN="your-long-lived-access-token"
META_AD_ACCOUNT_ID="act_your-account-id"

# Anthropic
ANTHROPIC_API_KEY="sk-ant-..."

# App
PORT=3001
NODE_ENV=development
FRONTEND_URL="http://localhost:5173"

# Performance sync
PERF_SYNC_CRON="0 */2 * * *"
```

### Frontend `.env`

```env
VITE_API_URL="http://localhost:3001/api"
```

## API Reference

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Logout |

### Ads
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/ads` | List user's ads |
| POST | `/api/ads` | Create new ad (draft) |
| GET | `/api/ads/:id` | Get single ad |
| PATCH | `/api/ads/:id` | Update ad |
| DELETE | `/api/ads/:id` | Delete draft ad |
| POST | `/api/ads/:id/submit` | Submit for approval |
| GET | `/api/ads/:id/performance` | Get performance data |

### AI
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/ai/generate-copy` | Generate ad copy from URL |
| POST | `/api/ai/extract-url` | Extract metadata from URL |

### Upload
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/upload/creative` | Upload image/video to S3 |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/ads` | List all ads |
| POST | `/api/admin/ads/:id/approve` | Approve ad |
| POST | `/api/admin/ads/:id/reject` | Reject with reason |
| GET | `/api/admin/stats` | Platform stats |

## Meta API Integration

The publishing flow:
1. `approveAd()` → queues `publish-ad` job in BullMQ
2. Worker picks up job → calls `MetaService.publishAd()`
3. Creates Campaign → Ad Set → uploads Creative → creates Ad
4. Stores Meta IDs (`campaign_id`, `adset_id`, `ad_id`) on the Ad record
5. Ad status set to `PUBLISHED`

## Background Jobs

| Job | Trigger | Description |
|-----|---------|-------------|
| `publish-ad` | On approval | Publishes to Meta API |
| `sync-performance` | Cron (every 2h) | Fetches metrics from Meta Insights API |

## User Roles

- **CLIENT** — create/edit/submit own ads, view own performance
- **ADMIN** — all client permissions + approve/reject any ad, view all campaigns
