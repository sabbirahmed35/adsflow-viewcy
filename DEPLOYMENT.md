# AdFlow Deployment Guide

## Deployment options

| Method | Best for | Complexity |
|--------|----------|-----------|
| Docker Compose (single server) | Small teams, VPS | Low |
| AWS ECS / Fargate | Auto-scaling, managed | Medium |
| Kubernetes (EKS/GKE) | Large scale | High |

---

## Option 1: Single VPS with Docker Compose (Recommended start)

### Requirements
- Ubuntu 22.04+ VPS (min 2 vCPU, 4 GB RAM)
- Docker + Docker Compose v2 installed
- A domain pointing to the server IP
- Ports 80/443 open

### 1. Server setup

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER

# Install Docker Compose plugin
apt install docker-compose-plugin -y

# Create app directory
mkdir -p /opt/adflow && cd /opt/adflow
```

### 2. Clone and configure

```bash
git clone https://github.com/yourorg/adflow .

# Backend env
cp backend/.env.example backend/.env
nano backend/.env        # Fill in all required values

# Verify env
make deploy-check
```

### 3. First deploy

```bash
# Build images
docker compose build

# Run migrations + seed
docker compose run --rm migrate

# Start all services
docker compose up -d

# Check health
docker compose ps
curl http://localhost:3001/health
```

### 4. Add HTTPS with Caddy (recommended over raw Nginx)

```bash
apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" > /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install caddy -y
```

Create `/etc/caddy/Caddyfile`:

```
yourdomain.com {
    reverse_proxy /api/* backend:3001
    reverse_proxy /* frontend:80
}
```

```bash
systemctl enable caddy && systemctl start caddy
```

---

## Option 2: AWS (ECS + RDS + ElastiCache)

### Architecture

```
Route 53 → CloudFront → ALB → ECS Fargate (backend x2, worker x1)
                                    ↓
                               RDS PostgreSQL (Multi-AZ)
                               ElastiCache Redis
                               S3 (creatives)
```

### Terraform quick start (see `infra/` directory)

```bash
cd infra/
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars

terraform init
terraform plan
terraform apply
```

### Environment variables in AWS

Store secrets in **AWS Secrets Manager** or **Parameter Store**:

```bash
aws ssm put-parameter \
  --name "/adflow/prod/JWT_SECRET" \
  --value "your-secret" \
  --type SecureString

aws ssm put-parameter \
  --name "/adflow/prod/ANTHROPIC_API_KEY" \
  --value "sk-ant-..." \
  --type SecureString
```

Reference in ECS task definition:
```json
{
  "secrets": [
    {
      "name": "JWT_SECRET",
      "valueFrom": "arn:aws:ssm:us-east-1:123456789:parameter/adflow/prod/JWT_SECRET"
    }
  ]
}
```

---

## Environment variable reference

### Required (app will not start without these)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/adflow` |
| `REDIS_URL` | Redis connection string | `redis://host:6379` |
| `JWT_SECRET` | Access token signing key (min 32 chars) | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Refresh token signing key (min 32 chars) | `openssl rand -hex 32` |

### Required for AI copy generation

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Get from console.anthropic.com |

### Required for publishing ads to Meta

| Variable | Description | Where to get |
|----------|-------------|-------------|
| `META_APP_ID` | Meta app ID | developers.facebook.com |
| `META_APP_SECRET` | Meta app secret | developers.facebook.com |
| `META_ACCESS_TOKEN` | Long-lived user/system access token | Meta Business Suite |
| `META_AD_ACCOUNT_ID` | Your ad account (format: `act_XXXXXXXXX`) | Meta Ads Manager |

### Required for creative uploads

| Variable | Description |
|----------|-------------|
| `AWS_ACCESS_KEY_ID` | IAM user with S3 PutObject permission |
| `AWS_SECRET_ACCESS_KEY` | IAM secret |
| `AWS_REGION` | e.g. `us-east-1` |
| `AWS_S3_BUCKET` | Bucket name (must be pre-created) |

### S3 bucket policy (allow public read for creatives)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::adflow-creatives/*"
    }
  ]
}
```

---

## Meta API setup

### 1. Create a Meta App
1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a new app → Business type
3. Add **Marketing API** product

### 2. Get a long-lived access token
```bash
# Exchange short-lived for long-lived token (valid 60 days)
curl "https://graph.facebook.com/oauth/access_token?\
  grant_type=fb_exchange_token&\
  client_id=APP_ID&\
  client_secret=APP_SECRET&\
  fb_exchange_token=SHORT_LIVED_TOKEN"
```

### 3. Create a System User (recommended for production)
1. Business Settings → System Users → Add
2. Assign assets (Ad Account, Pages)
3. Generate token with `ads_management` + `ads_read` scopes

### 4. Required permissions
- `ads_management` — create/manage campaigns, ad sets, ads
- `ads_read` — read performance insights
- `pages_read_engagement` — read page info for ad creatives

---

## Production checklist

### Before first deploy
- [ ] All required env vars set and verified (`make deploy-check`)
- [ ] `JWT_SECRET` and `JWT_REFRESH_SECRET` are random 32+ char strings
- [ ] PostgreSQL is accessible from the app server
- [ ] Redis is accessible from the app server
- [ ] S3 bucket created with correct CORS policy
- [ ] Meta API credentials tested
- [ ] Anthropic API key valid

### After first deploy
- [ ] Migrations ran successfully (`prisma migrate deploy`)
- [ ] `/health` endpoint returns 200
- [ ] Can register + login
- [ ] Demo credentials work (if seeded)
- [ ] Performance sync cron is running (check worker logs)

### Ongoing
- [ ] Set up log aggregation (CloudWatch, Datadog, Logtail)
- [ ] Set up uptime monitoring (Better Uptime, Pingdom)
- [ ] Enable PostgreSQL automated backups
- [ ] Rotate Meta access token before 60-day expiry
- [ ] Monitor Meta API rate limits (200 calls/hour per account)

---

## Scaling considerations

### When to scale the worker
The worker is stateless — run multiple instances safely. Add replicas when:
- Performance sync jobs queue up
- Ad publishing takes > 30 seconds

```bash
docker compose up -d --scale worker=3
```

### When to scale the backend
The backend is stateless (JWT auth, no in-memory state). Scale horizontally:

```bash
docker compose up -d --scale backend=4
```

Add a load balancer (Nginx upstream, AWS ALB) in front.

### Database connection pooling
For > 10 backend replicas, add PgBouncer between the app and Postgres:

```yaml
pgbouncer:
  image: pgbouncer/pgbouncer
  environment:
    DATABASES_HOST: postgres
    DATABASES_PORT: 5432
    DATABASES_DBNAME: adflow
    PGBOUNCER_POOL_MODE: transaction
    PGBOUNCER_MAX_CLIENT_CONN: 200
    PGBOUNCER_DEFAULT_POOL_SIZE: 25
```

Then update `DATABASE_URL` to point to pgbouncer.

---

## Monitoring

### Key metrics to alert on
| Metric | Warning | Critical |
|--------|---------|----------|
| API p95 latency | > 500ms | > 2s |
| Error rate | > 1% | > 5% |
| Queue depth (publish-ad) | > 10 | > 50 |
| Failed jobs | > 0 | > 5 |
| DB connections | > 80% | > 95% |
| Redis memory | > 70% | > 90% |

### Log locations (Docker)
```bash
docker compose logs -f backend    # API logs
docker compose logs -f worker     # Job processing logs
docker compose logs -f postgres   # DB logs
```

### BullMQ dashboard
Install [bull-board](https://github.com/felixmosh/bull-board) for a UI over your job queues:

```typescript
// Add to backend src/index.ts
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(getPublishQueue()),
    new BullMQAdapter(getSyncQueue()),
  ],
  serverAdapter,
});

// Protect with admin auth middleware
app.use('/admin/queues', authenticate, requireAdmin, serverAdapter.getRouter());
```
