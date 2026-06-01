import { Job } from 'bullmq';
import { AdStatus } from '../types/shared';
import { prisma } from '../config/database';
import { metaService } from '../services/meta.service';
import { PublishAdJobPayload } from '../types/shared';
import { logger } from '../utils/logger';

export async function handlePublishAd(job: Job<PublishAdJobPayload>): Promise<void> {
  const { adId } = job.data;
  logger.info(`[publish-ad] Starting job for ad ${adId}`);

  await prisma.ad.update({
    where: { id: adId },
    data: { status: AdStatus.PUBLISHING as any },
  });

  const ad = await prisma.ad.findUnique({ where: { id: adId } });
  if (!ad) throw new Error(`Ad ${adId} not found`);
  if (!ad.creativeUrl) throw new Error('Ad has no creative URL — cannot publish');

  // ── Find existing campaign/adset for same URL ────────────────────────────
  // Retry up to 12 times (60s) to handle bulk ads publishing concurrently —
  // the first ad creates the campaign, subsequent ads must wait and reuse it.
  let existingCampaignId: string | null = null;
  let existingAdSetId: string | null = null;
  let existingCustomConversionId: string | null = null;

  for (let attempt = 0; attempt < 12; attempt++) {
    // Look for any sibling ad with same URL that already has Meta IDs
    const sibling = await (prisma as any).ad.findFirst({
      where: {
        websiteUrl: ad.websiteUrl,
        metaCampaignId: { not: null },
        metaAdSetId: { not: null },
        id: { not: adId },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (sibling) {
      existingCampaignId = sibling.metaCampaignId;
      existingAdSetId = sibling.metaAdSetId;
      existingCustomConversionId = sibling.metaCustomConversionId || null;
      logger.info('[publish-ad] Reusing existing campaign/adset', { campaignId: existingCampaignId, adSetId: existingAdSetId });
      break;
    }

    // Check if another sibling is currently publishing (will create campaign soon)
    const publishingSibling = await (prisma as any).ad.findFirst({
      where: {
        websiteUrl: ad.websiteUrl,
        status: AdStatus.PUBLISHING as any,
        id: { not: adId },
      },
    });

    if (publishingSibling) {
      logger.info(`[publish-ad] Sibling ad is publishing, waiting 5s (attempt ${attempt + 1}/12)...`);
      await new Promise(r => setTimeout(r, 5000));
    } else {
      // No sibling publishing — this is the first ad, create new campaign
      logger.info('[publish-ad] No existing campaign found, creating new one');
      break;
    }
  }

  try {
    const result = await metaService.publishAd({
      websiteUrl: ad.websiteUrl,
      primaryText: ad.primaryText,
      headline: ad.headline,
      description: ad.description,
      cta: ad.cta,
      creativeUrl: ad.creativeUrl,
      creativeType: ad.creativeType ?? 'IMAGE',
      creativeKey: (ad as any).creativeKey ?? undefined,
      objective: ad.objective,
      budgetType: ad.budgetType,
      budgetAmount: ad.budgetAmount,
      startDate: ad.startDate ?? undefined,
      endDate: ad.endDate ?? undefined,
      locations: ad.locations,
      ageMin: ad.ageMin,
      ageMax: ad.ageMax,
      interests: ad.interests,
      existingCampaignId,
      existingAdSetId,
      existingCustomConversionId,
    });

    await (prisma as any).ad.update({
      where: { id: adId },
      data: {
        status: AdStatus.PUBLISHED as any,
        metaCampaignId: result.campaignId,
        metaAdSetId: result.adSetId,
        metaAdId: result.adId,
        publishError: null,
        ...(result.customConversionId && { metaCustomConversionId: result.customConversionId }),
      },
    });

    logger.info(`[publish-ad] Ad ${adId} published successfully`, result);
  } catch (err: any) {
    logger.error(`[publish-ad] Failed to publish ad ${adId}`, { error: err.message });
    await (prisma as any).ad.update({
      where: { id: adId },
      data: { status: AdStatus.FAILED as any, publishError: err.message },
    });
    throw err;
  }
}
