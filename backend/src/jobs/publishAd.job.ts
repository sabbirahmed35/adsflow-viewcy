import { Job } from 'bullmq';
import { AdStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { metaService } from '../services/meta.service';
import { PublishAdJobPayload } from '../../../shared/types';
import { logger } from '../utils/logger';

export async function handlePublishAd(job: Job<PublishAdJobPayload>): Promise<void> {
  const { adId } = job.data;
  logger.info(`[publish-ad] Starting job for ad ${adId}`);

  // Mark as PUBLISHING
  await prisma.ad.update({
    where: { id: adId },
    data: { status: AdStatus.PUBLISHING },
  });

  const ad = await prisma.ad.findUnique({ where: { id: adId } });
  if (!ad) throw new Error(`Ad ${adId} not found`);

  if (!ad.creativeUrl) {
    throw new Error('Ad has no creative URL — cannot publish');
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
      objective: ad.objective,
      budgetType: ad.budgetType,
      budgetAmount: ad.budgetAmount,
      startDate: ad.startDate ?? undefined,
      endDate: ad.endDate ?? undefined,
      locations: ad.locations,
      ageMin: ad.ageMin,
      ageMax: ad.ageMax,
      interests: ad.interests,
    });

    await prisma.ad.update({
      where: { id: adId },
      data: {
        status: AdStatus.PUBLISHED,
        metaCampaignId: result.campaignId,
        metaAdSetId: result.adSetId,
        metaAdId: result.adId,
        publishError: null,
      },
    });

    logger.info(`[publish-ad] Ad ${adId} published successfully`, result);
  } catch (err: any) {
    logger.error(`[publish-ad] Failed to publish ad ${adId}`, { error: err.message });

    await prisma.ad.update({
      where: { id: adId },
      data: {
        status: AdStatus.FAILED,
        publishError: err.message,
      },
    });

    throw err; // Re-throw so BullMQ marks job as failed and retries
  }
}
