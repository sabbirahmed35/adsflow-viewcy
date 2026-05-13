-- Add metaCampaignName column to Ad table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'Ad' AND column_name = 'metaCampaignName'
  ) THEN
    ALTER TABLE "Ad" ADD COLUMN "metaCampaignName" TEXT;
  END IF;
END $$;
