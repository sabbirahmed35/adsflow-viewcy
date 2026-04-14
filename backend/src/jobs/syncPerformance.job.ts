import { Job } from 'bullmq';
import { prisma } from '../config/database';
import { metaService } from '../services/meta.service';
import { SyncPerformanceJobPayload } from '../types/shared';
import { logger } from '../utils/logger';

export async function handleSyncPerformance(job: Job<SyncPerformanceJobPayload>): Promise<void> {
  const { adId } = job.data;

  // Fetch either a single ad or all published ads
  const ads = adId
    ? await prisma.ad.findMany({ where: { id: adId, metaAdId: { not: null } } })
    : await prisma.ad.findMany({ where: { status: 'PUBLISHED', metaAdId: { not: null } } });

  logger.info(`[sync-performance] Syncing ${ads.length} ads`);

  let synced = 0;
  let failed = 0;

  for (const ad of ads) {
    if (!ad.metaAdId) continue;

    try {
      const insights = await metaService.getAdInsights(ad.metaAdId, 'last_14d');

      for (const row of insights) {
        const date = new Date(row.date_start);
        const impressions = parseInt(row.impressions ?? '0');
        const clicks = parseInt(row.clicks ?? '0');
        const spend = parseFloat(row.spend ?? '0');
        const reach = parseInt(row.reach ?? '0');
        const frequency = parseFloat(row.frequency ?? '0');
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
        const conversions =
          row.actions
            ?.filter((a) =>
              ['purchase', 'lead', 'complete_registration'].includes(a.action_type)
            )
            .reduce((sum, a) => sum + parseInt(a.value), 0) ?? 0;

        await prisma.adPerformance.upsert({
          where: { adId_date: { adId: ad.id, date } },
          create: {
            adId: ad.id,
            date,
            impressions,
            clicks,
            ctr,
            cpc,
            cpm,
            spend,
            conversions,
            reach,
            frequency,
          },
          update: {
            impressions,
            clicks,
            ctr,
            cpc,
            cpm,
            spend,
            conversions,
            reach,
            frequency,
          },
        });
      }

      synced++;
    } catch (err: any) {
      logger.error(`[sync-performance] Failed for ad ${ad.id}`, { error: err.message });
      failed++;
    }
  }

  logger.info(`[sync-performance] Done. Synced: ${synced}, Failed: ${failed}`);
}
