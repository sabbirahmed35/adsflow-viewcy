FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl

# ── deps stage ────────────────────────────────────────────────────────────────
FROM base AS deps
COPY package*.json ./
RUN npm ci --only=production && cp -R node_modules /tmp/prod_node_modules
RUN npm ci

# ── build stage ───────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

# ── runner stage ──────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 adflow

COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/prisma        ./prisma
COPY --from=deps    /tmp/prod_node_modules ./node_modules
COPY package.json ./

# Generate Prisma client in production node_modules
RUN npx prisma generate

USER adflow

EXPOSE 3001

CMD ["node", "dist/index.js"]
