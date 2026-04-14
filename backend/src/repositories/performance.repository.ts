import { prisma } from '../config/database';

export class PerformanceRepository {
  async upsertDay(params: {
    adId: string;
    date: Date;
    impressions: number;
    clicks: number;
    spend: number;
    reach: number;
    frequency: number;
    conversions: number;
  }) {
    const { adId, date, impressions, clicks, spend, reach, frequency, conversions } = params;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const cpc = clicks > 0 ? spend / clicks : 0;
    const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;

    return prisma.adPerformance.upsert({
      where: { adId_date: { adId, date } },
      create: { adId, date, impressions, clicks, ctr, cpc, cpm, spend, conversions, reach, frequency },
      update: { impressions, clicks, ctr, cpc, cpm, spend, conversions, reach, frequency },
    });
  }

  async getForAd(adId: string, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return prisma.adPerformance.findMany({
      where: { adId, date: { gte: since } },
      orderBy: { date: 'asc' },
    });
  }

  async aggregateForUser(userId: string) {
    return prisma.adPerformance.aggregate({
      where: { ad: { userId } },
      _sum: { impressions: true, clicks: true, spend: true, conversions: true },
      _avg: { ctr: true, cpc: true },
    });
  }

  async aggregateAll() {
    return prisma.adPerformance.aggregate({
      _sum: { impressions: true, clicks: true, spend: true, conversions: true },
      _avg: { ctr: true, cpc: true },
    });
  }

  async deleteOlderThan(days: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return prisma.adPerformance.deleteMany({ where: { date: { lt: cutoff } } });
  }
}

export const performanceRepository = new PerformanceRepository();
