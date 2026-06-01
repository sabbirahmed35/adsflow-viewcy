import { Job } from 'bullmq';
import { AdStatus } from '../types/shared';
import { prisma } from '../config/database';
import { metaService } from '../services/meta.service';
import { PublishAdJobPayload } from '../types/shared';
import { logger } from '../utils/logger';

export async function handlePublishAd(job: Job<PublishAdJobPayload>): Promise<void> {
  const { adId } = job.data;
  logger.info(`[publish-ad] Starting job for ad ${adId}`);

  // Mark as PUBLISHING
  await prisma.ad.update({
    where: { id: adId },
    data: { status: AdStatus.PUBLISHING as any },
  });

  const ad = await prisma.ad.findUnique({ where: { id: adId } });
  if (!ad) throw new Error(`Ad ${adId} not found`);

  if (!ad.creativeUrl) {
    throw new Error('Ad has no creative URL — cannot publish');
  }

  // ── Look up existing campaign/adset for same event URL ──────────────────────
  // If another ad with the same websiteUrl was already published,
  // reuse its campaign and ad set
  let existingCampaignId: string | null = null;
  let existingAdSetId: string | null = null;
  let existingCustomConversionId: string | null = null;

  // Check for PUBLISHED or PUBLISHING ads with same URL
  // PUBLISHING handles the case where bulk ads are approved together
  const existingAd = await prisma.ad.findFirst({
    where: {
      websiteUrl: ad.websiteUrl,
      status: { in: [AdStatus.PUBLISHED as any, AdStatus.PUBLISHING as any] },
      metaCampaignId: { not: null },
      metaAdSetId: { not: null },
      id: { not: adId },
    },
    orderBy: { createdAt: 'asc' }, // use the FIRST one created
  });

  // If another ad is still PUBLISHING, wait briefly for it to finish
  if (existingAd && (existingAd as any).status === AdStatus.PUBLISHING) {
    logger.info('[publish-ad] Another ad is still publishing, waiting 5s...', { existingAdId: existingAd.id });
    await new Promise(r => setTimeout(r, 5000));
    // Re-fetch to get updated campaign IDs
    const refreshed = await prisma.ad.findUnique({ where: { id: existingAd.id } });
    if (refreshed?.metaCampaignId) {
      existingAd.metaCampaignId = refreshed.metaCampaignId;
      existingAd.metaAdSetId = refreshed.metaAdSetId;
    }
  }

  if (existingAd) {
    existingCampaignId = existingAd.metaCampaignId;
    existingAdSetId = existingAd.metaAdSetId;
    existingCustomConversionId = (existingAd as any).metaCustomConversionId || null;
    logger.info(`[publish-ad] Found existing campaign for URL, reusing`, {
      campaignId: existingCampaignId,
      adSetId: existingAdSetId,
      url: ad.websiteUrl,
    });
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

    await prisma.ad.update({
      where: { id: adId },
      data: {
        status: AdStatus.PUBLISHED as any,
        metaCampaignId: result.campaignId,
        metaAdSetId: result.adSetId,
        metaAdId: result.adId,
        publishError: null,
        ...(result.customConversionId && { metaCustomConversionId: result.customConversionId } as any),
      },
    });

    logger.info(`[publish-ad] Ad ${adId} published successfully`, result);
  } catch (err: any) {
    logger.error(`[publish-ad] Failed to publish ad ${adId}`, { error: err.message });

    await prisma.ad.update({
      where: { id: adId },
      data: {
        status: AdStatus.FAILED as any,
        publishError: err.message,
      },
    });

    throw err;
  }
}
