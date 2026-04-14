-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CLIENT', 'ADMIN');
CREATE TYPE "AdStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PUBLISHING', 'PUBLISHED', 'PAUSED', 'FAILED');
CREATE TYPE "CampaignObjective" AS ENUM ('TRAFFIC', 'AWARENESS', 'SALES', 'LEAD_GENERATION');
CREATE TYPE "BudgetType" AS ENUM ('DAILY', 'LIFETIME');
CREATE TYPE "CtaType" AS ENUM ('LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'GET_OFFER', 'BOOK_NOW', 'CONTACT_US', 'DOWNLOAD');
CREATE TYPE "CreativeType" AS ENUM ('IMAGE', 'VIDEO');

-- CreateTable: users
CREATE TABLE "users" (
    "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name"         TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role"         "UserRole" NOT NULL DEFAULT 'CLIENT',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateTable: refresh_tokens
CREATE TABLE "refresh_tokens" (
    "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "token"     TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateTable: ads
CREATE TABLE "ads" (
    "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId"          TEXT NOT NULL,
    "status"          "AdStatus" NOT NULL DEFAULT 'DRAFT',
    "websiteUrl"      TEXT NOT NULL,
    "primaryText"     TEXT NOT NULL,
    "headline"        TEXT NOT NULL,
    "description"     TEXT NOT NULL,
    "cta"             "CtaType" NOT NULL DEFAULT 'LEARN_MORE',
    "creativeUrl"     TEXT,
    "creativeType"    "CreativeType",
    "creativeKey"     TEXT,
    "objective"       "CampaignObjective" NOT NULL DEFAULT 'TRAFFIC',
    "budgetType"      "BudgetType" NOT NULL DEFAULT 'DAILY',
    "budgetAmount"    DOUBLE PRECISION NOT NULL,
    "startDate"       TIMESTAMP(3),
    "endDate"         TIMESTAMP(3),
    "locations"       TEXT[],
    "ageMin"          INTEGER NOT NULL DEFAULT 18,
    "ageMax"          INTEGER NOT NULL DEFAULT 65,
    "interests"       TEXT[],
    "placements"      TEXT[],
    "metaCampaignId"  TEXT,
    "metaAdSetId"     TEXT,
    "metaAdId"        TEXT,
    "rejectionReason" TEXT,
    "reviewedById"    TEXT,
    "reviewedAt"      TIMESTAMP(3),
    "publishError"    TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ad_performance
CREATE TABLE "ad_performance" (
    "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "adId"        TEXT NOT NULL,
    "date"        DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks"      INTEGER NOT NULL DEFAULT 0,
    "ctr"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpc"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpm"         DOUBLE PRECISION NOT NULL DEFAULT 0,
    "spend"       DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "reach"       INTEGER NOT NULL DEFAULT 0,
    "frequency"   DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ad_performance_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ad_performance_adId_date_key" ON "ad_performance"("adId", "date");

-- CreateIndex for common queries
CREATE INDEX "ads_userId_idx"    ON "ads"("userId");
CREATE INDEX "ads_status_idx"    ON "ads"("status");
CREATE INDEX "ads_createdAt_idx" ON "ads"("createdAt" DESC);
CREATE INDEX "ad_performance_adId_idx"   ON "ad_performance"("adId");
CREATE INDEX "ad_performance_date_idx"   ON "ad_performance"("date" DESC);
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ads" ADD CONSTRAINT "ads_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ads" ADD CONSTRAINT "ads_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ad_performance" ADD CONSTRAINT "ad_performance_adId_fkey"
    FOREIGN KEY ("adId") REFERENCES "ads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
