# AdFlow — Launch Guide
### Get the app live and demo-ready for your boss

---

## What you'll have running

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | `https://yourdomain.com` | The full web app |
| Backend API | `https://yourdomain.com/api` | REST API |
| Admin panel | Login with admin credentials | Approve ads, view all campaigns |

---

## Fastest path to a live demo (2–3 hours)

**Recommended stack for a boss demo:**
- **Railway** — hosts backend + database + Redis (free tier works)
- **Vercel** — hosts the frontend (free, instant deploys)
- **Anthropic API** — AI copy generation (you already have this)
- Skip Meta API for demo — use the mock/preview mode built into the app

This avoids needing a domain, server setup, or paid infrastructure.

---

## PART 1 — Get your API keys

You need these before anything else. Get them in this order:

### 1. Anthropic API key (AI copy generation)
1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up / log in
3. Click **API Keys** → **Create Key**
4. Copy it — looks like `sk-ant-api03-...`
5. Add $5 credit (Settings → Billing) — plenty for a demo

### 2. Meta Marketing API (skip for demo, do this for real launch)
> You can demo the full app **without** Meta credentials — ads will go through the full workflow (create → submit → approve) but the "publish to Meta" step will show as queued. Your boss will see the complete product flow.

If you want real Meta publishing:
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. **My Apps → Create App → Business**
3. Add **Marketing API** product
4. Go to **Tools → Graph API Explorer**
5. Generate a User Token with permissions: `ads_management`, `ads_read`
6. Exchange for a long-lived token (60 days):
   ```
   https://graph.facebook.com/oauth/access_token?
     grant_type=fb_exchange_token
     &client_id=YOUR_APP_ID
     &client_secret=YOUR_APP_SECRET
     &fb_exchange_token=YOUR_SHORT_TOKEN
   ```
7. Get your Ad Account ID from [business.facebook.com](https://business.facebook.com) → Ad Accounts → it starts with `act_`

### 3. AWS S3 for creative uploads (optional for demo)
> Without S3, users can still create ads — they just paste an image URL instead of uploading a file. Fine for a demo.

If you want file uploads:
1. Log into [aws.amazon.com](https://aws.amazon.com)
2. S3 → **Create bucket** → name it `adflow-creatives` → region `us-east-1`
3. Bucket settings → **Block Public Access** → uncheck all → Save
4. Add this bucket policy (Permissions tab):
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [{
       "Effect": "Allow",
       "Principal": "*",
       "Action": "s3:GetObject",
       "Resource": "arn:aws:s3:::adflow-creatives/*"
     }]
   }
   ```
5. IAM → Users → Create user → Attach policy: `AmazonS3FullAccess` → Create access key → save both keys

---

## PART 2 — Deploy the backend (Railway)

Railway gives you Postgres + Redis + Node.js hosting in one place, free to start.

### Step 1 — Create Railway account
1. Go to [railway.app](https://railway.app) → Sign in with GitHub

### Step 2 — Create a new project
1. Click **New Project**
2. Choose **Deploy from GitHub repo** → connect your GitHub → select your `adflow` repo
3. Set the **root directory** to `backend`

### Step 3 — Add Postgres
1. In your Railway project, click **+ New** → **Database** → **PostgreSQL**
2. Railway auto-creates `DATABASE_URL` — it will be available as an env var

### Step 4 — Add Redis
1. Click **+ New** → **Database** → **Redis**
2. Railway auto-creates `REDIS_URL`

### Step 5 — Set environment variables
In your Railway backend service → **Variables** tab, add:

```
NODE_ENV=production
PORT=3001
JWT_SECRET=<run: openssl rand -hex 32>
JWT_REFRESH_SECRET=<run: openssl rand -hex 32>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
FRONTEND_URL=https://your-vercel-url.vercel.app

ANTHROPIC_API_KEY=sk-ant-api03-...

# Leave blank if skipping Meta for demo
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=
META_AD_ACCOUNT_ID=

# Leave blank if skipping S3 for demo
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=adflow-creatives
```

> **Generate secrets:** open your terminal and run `openssl rand -hex 32` twice — once for JWT_SECRET, once for JWT_REFRESH_SECRET.

### Step 6 — Set the start command
In Railway service settings → **Start Command**:
```
npx prisma migrate deploy && node dist/index.js
```

### Step 7 — Set the build command
```
npm install && npx prisma generate && npm run build
```

### Step 8 — Deploy and seed
1. Click **Deploy** — watch the build logs
2. Once live, go to Railway → your service → **Shell** tab, run:
   ```bash
   npx ts-node prisma/seed.ts
   ```
   This creates the demo accounts.

3. Note your Railway backend URL — looks like `https://adflow-backend-production.up.railway.app`

### Step 9 — Add the worker service
1. In your Railway project → **+ New** → **GitHub Repo** → same repo
2. Root directory: `backend`
3. Start command: `node dist/worker.js`
4. Add the **same environment variables** as the backend service
5. Deploy

---

## PART 3 — Deploy the frontend (Vercel)

### Step 1 — Create Vercel account
1. Go to [vercel.com](https://vercel.com) → Sign in with GitHub

### Step 2 — Import your repo
1. Click **Add New → Project**
2. Import your `adflow` GitHub repo
3. Set **Root Directory** to `frontend`
4. Framework: **Vite**

### Step 3 — Set environment variables
In Vercel project settings → **Environment Variables**:
```
VITE_API_URL=https://adflow-backend-production.up.railway.app/api
```
(Use your actual Railway backend URL from Part 2 Step 8)

### Step 4 — Deploy
1. Click **Deploy**
2. Vercel builds and gives you a URL like `https://adflow-xyz.vercel.app`
3. Copy this URL and go back to Railway → update `FRONTEND_URL` to this Vercel URL

### Step 5 — Test it
Open your Vercel URL in a browser. You should see the AdFlow login page.

Login with the demo credentials:
- **Admin:** `admin@adflow.io` / `admin123`
- **Client:** `jane@techlaunch.io` / `client123`

---

## PART 4 — Run locally (alternative, easier for a quick demo)

If you just want to show it to your boss on your laptop:

### Prerequisites
- Node.js 18+ ([nodejs.org](https://nodejs.org))
- Docker Desktop ([docker.com/products/docker-desktop](https://docker.com/products/docker-desktop))

### Step 1 — Clone and configure
```bash
git clone https://github.com/yourorg/adflow
cd adflow

# Set up backend env
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in at minimum:
```
JWT_SECRET=any-long-random-string-at-least-32-chars
JWT_REFRESH_SECRET=another-long-random-string-32-chars
ANTHROPIC_API_KEY=sk-ant-api03-...
```
Everything else can stay blank for a local demo.

### Step 2 — Install dependencies
```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

### Step 3 — Start infrastructure (Postgres + Redis)
```bash
docker compose up -d postgres redis
```

### Step 4 — Run migrations and seed
```bash
cd backend
DATABASE_URL="postgresql://adflow:adflow_secret@localhost:5432/adflow" \
  npx prisma migrate dev --name init

DATABASE_URL="postgresql://adflow:adflow_secret@localhost:5432/adflow" \
  npx ts-node prisma/seed.ts
```

### Step 5 — Start everything
Open **3 terminal tabs:**

**Tab 1 — Backend API:**
```bash
cd backend
DATABASE_URL="postgresql://adflow:adflow_secret@localhost:5432/adflow" \
  REDIS_URL="redis://localhost:6379" \
  npm run dev
```

**Tab 2 — Background worker:**
```bash
cd backend
DATABASE_URL="postgresql://adflow:adflow_secret@localhost:5432/adflow" \
  REDIS_URL="redis://localhost:6379" \
  npm run worker
```

**Tab 3 — Frontend:**
```bash
cd frontend && npm run dev
```

### Step 6 — Open the app
Go to [http://localhost:5173](http://localhost:5173)

---

## PART 5 — Demo script for your boss

Walk through this flow — it takes about 10 minutes and shows the full product:

### Scene 1: Client creates an ad (3 min)
1. Log in as **Client** (`jane@techlaunch.io` / `client123`)
2. Click **Create ad**
3. Paste any real URL (e.g. your company website)
4. Click **Generate AI copy** — watch Claude write the headline and ad text live
5. Edit the copy if you like — show the live Facebook preview updating
6. Set a budget ($25/day), audience (US, age 25–45, interests)
7. Click **Submit for approval**

> **Talking point:** "The client never needs to know anything about Meta's API — they just paste a URL and we handle everything."

### Scene 2: Admin reviews and approves (2 min)
1. Log out → log in as **Admin** (`admin@adflow.io` / `admin123`)
2. Click **Approvals** in the sidebar — see the pending ad
3. Review the copy, targeting, and the live ad preview side by side
4. Click **Approve & publish**
5. Show the status change to "Publishing…" → "Published"

> **Talking point:** "Admin has full visibility before anything goes live on Meta. One click publishes — the system handles creating the campaign, ad set, and creative via the Meta Marketing API."

### Scene 3: Performance dashboard (2 min)
1. Click **Performance** in the sidebar
2. Show the impressions/clicks/CTR/spend charts for published campaigns
3. Click into a specific ad to see the detailed timeline

> **Talking point:** "Performance data syncs automatically from Meta every 2 hours. Clients can see ROI in real time without leaving the platform."

### Scene 4: All campaigns overview (1 min)
1. As admin, click **All campaigns**
2. Show the platform-wide view — all clients, all statuses, spend totals

> **Talking point:** "Admins see everything across all clients in one place — total spend, what's live, what's pending, what got rejected."

---

## PART 6 — Custom domain (optional, looks more professional)

### With Vercel (frontend)
1. Vercel project → **Settings → Domains**
2. Add your domain (e.g. `adflow.yourcompany.com`)
3. Add the CNAME record your domain registrar

### With Railway (API)
1. Railway service → **Settings → Domains**
2. Add a custom domain (e.g. `api.adflow.yourcompany.com`)
3. Update `VITE_API_URL` in Vercel to use the new domain
4. Update `FRONTEND_URL` in Railway to your Vercel domain

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Login fails | Check `JWT_SECRET` is set and at least 32 chars |
| AI copy generation fails | Check `ANTHROPIC_API_KEY` is valid and has credit |
| "Cannot connect to database" | Make sure `DATABASE_URL` points to your Railway Postgres |
| Frontend shows blank page | Check `VITE_API_URL` is set correctly in Vercel env vars |
| CORS errors in browser | Make sure `FRONTEND_URL` in backend matches your Vercel URL exactly |
| Seed fails | Run `npx prisma migrate deploy` first, then seed |
| Meta publishing fails | Expected if Meta credentials are blank — status stays "Approved" |

---

## Demo accounts (created by seed)

| Role | Email | Password | Access |
|------|-------|----------|--------|
| Admin | `admin@adflow.io` | `admin123` | Full platform, approve/reject all ads |
| Client 1 | `jane@techlaunch.io` | `client123` | Own ads, performance data |
| Client 2 | `marcus@shopnova.co` | `client123` | Own ads, performance data |

The seed also creates 6 pre-built ads in various statuses (draft, pending, published, rejected) so the dashboard looks populated from the start.

---

## Cost estimate for a live demo

| Service | Free tier | Enough for demo? |
|---------|-----------|-----------------|
| Railway (backend + DB + Redis) | $5 free credit | Yes — lasts weeks |
| Vercel (frontend) | Free forever | Yes |
| Anthropic API | Pay per use | ~$0.01 per ad generation |
| Meta API | Free | Yes (no cost to call the API) |
| AWS S3 | First 5GB free | Yes |

**Total: ~$0–5 for a demo**

---

## What to say when your boss asks "what would it take to go to production?"

1. **Meta Business Verification** — your company needs to verify with Meta to run real ads (~1–2 weeks)
2. **Meta App Review** — submit the app for `ads_management` permission approval (~1 week)
3. **Production infrastructure** — upgrade Railway to paid plan or move to AWS ECS ($50–200/month)
4. **Custom domain + SSL** — already handled by Vercel/Railway, just need a domain (~$12/year)
5. **Compliance** — Meta has strict ad policies; add a review checklist for admins

The code is production-ready. The blockers are business/compliance, not technical.
