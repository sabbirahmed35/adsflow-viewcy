import { Prisma } from '@prisma/client';
import { AdStatus } from '../types/shared';
import { prisma } from '../config/database';

const adWithRelations = {
  include: {
    user: { select: { id: true, name: true, email: true } },
    reviewedBy: { select: { id: true, name: true } },
    performance: {
      orderBy: { date: 'desc' as const },
      take: 30,
    },
  },
};

export type AdWithRelations = Prisma.AdGetPayload<{ include: typeof adWithRelations.include }>;

export class AdRepository {
  async findById(id: string): Promise<AdWithRelations | null> {
    return prisma.ad.findUnique({
      where: { id },
      ...adWithRelations,
    });
  }

  async findByIdAndUserId(id: string, userId: string): Promise<AdWithRelations | null> {
    return prisma.ad.findFirst({
      where: { id, userId },
      ...adWithRelations,
    });
  }

  async findByUser(
    userId: string,
    params: { page: number; limit: number; status?: AdStatus }
  ) {
    const where: Prisma.AdWhereInput = { userId };
    if (params.status) where.status = params.status;

    const [data, total] = await Promise.all([
      prisma.ad.findMany({
        where,
        ...adWithRelations,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.ad.count({ where }),
    ]);

    return { data, total };
  }

  async findAll(params: { page: number; limit: number; status?: AdStatus; search?: string }) {
    const where: Prisma.AdWhereInput = {};
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { headline: { contains: params.search, mode: 'insensitive' } },
        { websiteUrl: { contains: params.search, mode: 'insensitive' } },
        { user: { name: { contains: params.search, mode: 'insensitive' } } },
        { user: { email: { contains: params.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.ad.findMany({
        where,
        ...adWithRelations,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      prisma.ad.count({ where }),
    ]);

    return { data, total };
  }

  async findPendingAds() {
    return prisma.ad.findMany({
      where: { status: AdStatus.PENDING },
      ...adWithRelations,
      orderBy: { createdAt: 'asc' },
    });
  }

  async findPublishedAds() {
    return prisma.ad.findMany({
      where: { status: AdStatus.PUBLISHED },
      select: { id: true, metaAdId: true, metaCampaignId: true },
    });
  }

  async create(userId: string, data: Prisma.AdCreateInput) {
    return prisma.ad.create({
      data: { ...data, user: { connect: { id: userId } } },
      ...adWithRelations,
    });
  }

  async update(id: string, data: Prisma.AdUpdateInput) {
    return prisma.ad.update({
      where: { id },
      data,
      ...adWithRelations,
    });
  }

  async delete(id: string) {
    return prisma.ad.delete({ where: { id } });
  }

  async updateStatus(id: string, status: AdStatus, extra?: Prisma.AdUpdateInput) {
    return prisma.ad.update({
      where: { id },
      data: { status, ...extra },
      ...adWithRelations,
    });
  }

  async getStats() {
    const [byStatus, perfAgg] = await Promise.all([
      prisma.ad.groupBy({ by: ['status'], _count: true }),
      prisma.adPerformance.aggregate({
        _sum: { spend: true, impressions: true, clicks: true },
        _avg: { ctr: true },
      }),
    ]);

    return {
      totalAds: byStatus.reduce((sum: number, s: { _count: number }) => sum + s._count, 0),
      byStatus: Object.fromEntries(byStatus.map((s: { status: string; _count: number }) => [s.status, s._count])),
      totalSpend: perfAgg._sum.spend ?? 0,
      totalImpressions: perfAgg._sum.impressions ?? 0,
      totalClicks: perfAgg._sum.clicks ?? 0,
      avgCtr: perfAgg._avg.ctr ?? 0,
    };
  }
}

export const adRepository = new AdRepository();
