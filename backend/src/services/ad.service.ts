import { Prisma } from '@prisma/client';
import { AdStatus } from '../types/shared';
import { adRepository } from '../repositories/ad.repository';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../middleware/errorHandler';
import { getPublishQueue } from '../config/queue';
import { QUEUE_NAMES } from '../config/queue';
import { PublishAdJobPayload } from '../types/shared';
import { logger } from '../utils/logger';

const EDITABLE_STATUSES: AdStatus[] = [AdStatus.DRAFT, AdStatus.REJECTED];

export class AdService {
  async getUserAds(userId: string, page = 1, limit = 20, status?: AdStatus) {
    const { data, total } = await adRepository.findByUser(userId, { page, limit, status });
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getAdById(id: string, userId: string, isAdmin: boolean) {
    const ad = await adRepository.findById(id);
    if (!ad) throw new NotFoundError('Ad');
    if (!isAdmin && ad.userId !== userId) throw new ForbiddenError();
    return ad;
  }

  async createAd(userId: string, data: Prisma.AdCreateInput) {
    return adRepository.create(userId, { ...data, status: AdStatus.DRAFT });
  }

  async updateAd(id: string, userId: string, isAdmin: boolean, data: Prisma.AdUpdateInput) {
    const ad = await adRepository.findById(id);
    if (!ad) throw new NotFoundError('Ad');
    if (!isAdmin && ad.userId !== userId) throw new ForbiddenError();
    if (!isAdmin && !EDITABLE_STATUSES.includes(ad.status)) {
      throw new ValidationError(`Cannot edit ad with status: ${ad.status}. Only DRAFT or REJECTED ads can be edited.`);
    }
    return adRepository.update(id, data);
  }

  async deleteAd(id: string, userId: string, isAdmin: boolean) {
    const ad = await adRepository.findById(id);
    if (!ad) throw new NotFoundError('Ad');
    if (!isAdmin && ad.userId !== userId) throw new ForbiddenError();
    if (ad.status !== AdStatus.DRAFT) {
      throw new ValidationError('Only DRAFT ads can be deleted');
    }
    await adRepository.delete(id);
  }

  async submitAd(id: string, userId: string) {
    const ad = await adRepository.findByIdAndUserId(id, userId);
    if (!ad) throw new NotFoundError('Ad');
    if (!EDITABLE_STATUSES.includes(ad.status)) {
      throw new ValidationError(`Ad cannot be submitted from status: ${ad.status}`);
    }

    // Validate required fields
    const missing: string[] = [];
    if (!ad.primaryText?.trim()) missing.push('primaryText');
    if (!ad.headline?.trim()) missing.push('headline');
    if (!ad.websiteUrl?.trim()) missing.push('websiteUrl');
    if (missing.length) {
      throw new ValidationError(`Missing required fields: ${missing.join(', ')}`);
    }

    return adRepository.updateStatus(id, AdStatus.PENDING as any, {
      rejectionReason: null,
      reviewedBy: { disconnect: true },
      reviewedAt: null,
    });
  }

  async approveAd(id: string, adminId: string) {
    const ad = await adRepository.findById(id);
    if (!ad) throw new NotFoundError('Ad');
    if (ad.status !== AdStatus.PENDING) {
      throw new ValidationError(`Ad is not pending approval (status: ${ad.status})`);
    }

    const updated = await adRepository.updateStatus(id, AdStatus.APPROVED as any, {
      reviewedBy: { connect: { id: adminId } },
      reviewedAt: new Date(),
    });

    // Queue publish job
    const queue = getPublishQueue();
    await queue.add(
      QUEUE_NAMES.PUBLISH_AD,
      { adId: id, approvedBy: adminId } as PublishAdJobPayload,
      { jobId: `publish-${id}` }
    );

    logger.info(`Ad ${id} approved by ${adminId}, queued for publishing`);
    return updated;
  }

  async rejectAd(id: string, adminId: string, reason: string) {
    const ad = await adRepository.findById(id);
    if (!ad) throw new NotFoundError('Ad');
    if (ad.status !== AdStatus.PENDING) {
      throw new ValidationError(`Ad is not pending review (status: ${ad.status})`);
    }
    if (!reason?.trim()) throw new ValidationError('Rejection reason is required');

    return adRepository.updateStatus(id, AdStatus.REJECTED as any, {
      rejectionReason: reason,
      reviewedBy: { connect: { id: adminId } },
      reviewedAt: new Date(),
    });
  }

  async getAdPerformance(id: string, userId: string, isAdmin: boolean) {
    const ad = await adRepository.findById(id);
    if (!ad) throw new NotFoundError('Ad');
    if (!isAdmin && ad.userId !== userId) throw new ForbiddenError();
    return ad.performance;
  }

  // Admin only
  async getAllAds(page = 1, limit = 20, status?: AdStatus, search?: string) {
    const { data, total } = await adRepository.findAll({ page, limit, status, search });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getPendingAds() {
    return adRepository.findPendingAds();
  }

  async getStats() {
    return adRepository.getStats();
  }
}

export const adService = new AdService();
