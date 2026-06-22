-- AddConversionValue
ALTER TABLE "ad_performance" ADD COLUMN IF NOT EXISTS "conversionValue" DOUBLE PRECISION NOT NULL DEFAULT 0;
