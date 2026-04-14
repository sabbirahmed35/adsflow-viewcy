import { AdService } from '../../src/services/ad.service';
import { AdStatus, UserRole } from '@prisma/client';
import { ForbiddenError, NotFoundError, ValidationError } from '../../src/middleware/errorHandler';
import { makeAd } from '../setup';

// Mock ad repository
const mockAdRepository = {
  findById: jest.fn(),
  findByIdAndUserId: jest.fn(),
  findByUser: jest.fn(),
  findAll: jest.fn(),
  findPendingAds: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  updateStatus: jest.fn(),
  getStats: jest.fn(),
};

jest.mock('../../src/repositories/ad.repository', () => ({
  adRepository: mockAdRepository,
}));

// Mock queue
jest.mock('../../src/config/queue', () => ({
  getPublishQueue: () => ({ add: jest.fn().mockResolvedValue({ id: 'job-1' }) }),
  QUEUE_NAMES: { PUBLISH_AD: 'publish-ad' },
}));

describe('AdService', () => {
  let service: AdService;

  beforeEach(() => {
    service = new AdService();
    jest.clearAllMocks();
  });

  // ── getAdById ─────────────────────────────────────────────────────────────
  describe('getAdById', () => {
    it('returns ad when owner requests it', async () => {
      const ad = makeAd({ userId: 'user-123' });
      mockAdRepository.findById.mockResolvedValue(ad);

      const result = await service.getAdById('ad-123', 'user-123', false);
      expect(result).toEqual(ad);
    });

    it('returns ad when admin requests it (any user)', async () => {
      const ad = makeAd({ userId: 'other-user' });
      mockAdRepository.findById.mockResolvedValue(ad);

      const result = await service.getAdById('ad-123', 'admin-123', true);
      expect(result).toEqual(ad);
    });

    it('throws ForbiddenError when non-owner non-admin requests ad', async () => {
      const ad = makeAd({ userId: 'other-user' });
      mockAdRepository.findById.mockResolvedValue(ad);

      await expect(service.getAdById('ad-123', 'user-123', false))
        .rejects.toThrow(ForbiddenError);
    });

    it('throws NotFoundError when ad does not exist', async () => {
      mockAdRepository.findById.mockResolvedValue(null);

      await expect(service.getAdById('nonexistent', 'user-123', false))
        .rejects.toThrow(NotFoundError);
    });
  });

  // ── submitAd ──────────────────────────────────────────────────────────────
  describe('submitAd', () => {
    it('transitions DRAFT ad to PENDING', async () => {
      const ad = makeAd({ status: AdStatus.DRAFT });
      mockAdRepository.findByIdAndUserId.mockResolvedValue(ad);
      mockAdRepository.updateStatus.mockResolvedValue({ ...ad, status: AdStatus.PENDING });

      const result = await service.submitAd('ad-123', 'user-123');

      expect(mockAdRepository.updateStatus).toHaveBeenCalledWith(
        'ad-123',
        AdStatus.PENDING,
        expect.any(Object)
      );
    });

    it('allows re-submission of REJECTED ad', async () => {
      const ad = makeAd({ status: AdStatus.REJECTED });
      mockAdRepository.findByIdAndUserId.mockResolvedValue(ad);
      mockAdRepository.updateStatus.mockResolvedValue({ ...ad, status: AdStatus.PENDING });

      await service.submitAd('ad-123', 'user-123');
      expect(mockAdRepository.updateStatus).toHaveBeenCalled();
    });

    it('throws ValidationError when ad is already PENDING', async () => {
      const ad = makeAd({ status: AdStatus.PENDING });
      mockAdRepository.findByIdAndUserId.mockResolvedValue(ad);

      await expect(service.submitAd('ad-123', 'user-123'))
        .rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when primaryText is empty', async () => {
      const ad = makeAd({ status: AdStatus.DRAFT, primaryText: '' });
      mockAdRepository.findByIdAndUserId.mockResolvedValue(ad);

      await expect(service.submitAd('ad-123', 'user-123'))
        .rejects.toThrow(ValidationError);
    });

    it('throws NotFoundError when ad not found for user', async () => {
      mockAdRepository.findByIdAndUserId.mockResolvedValue(null);

      await expect(service.submitAd('nonexistent', 'user-123'))
        .rejects.toThrow(NotFoundError);
    });
  });

  // ── approveAd ─────────────────────────────────────────────────────────────
  describe('approveAd', () => {
    it('approves PENDING ad and queues publish job', async () => {
      const ad = makeAd({ status: AdStatus.PENDING });
      mockAdRepository.findById.mockResolvedValue(ad);
      mockAdRepository.updateStatus.mockResolvedValue({ ...ad, status: AdStatus.APPROVED });

      const result = await service.approveAd('ad-123', 'admin-123');

      expect(mockAdRepository.updateStatus).toHaveBeenCalledWith(
        'ad-123',
        AdStatus.APPROVED,
        expect.objectContaining({ reviewedById: 'admin-123' })
      );
    });

    it('throws ValidationError when ad is not PENDING', async () => {
      const ad = makeAd({ status: AdStatus.DRAFT });
      mockAdRepository.findById.mockResolvedValue(ad);

      await expect(service.approveAd('ad-123', 'admin-123'))
        .rejects.toThrow(ValidationError);
    });
  });

  // ── rejectAd ──────────────────────────────────────────────────────────────
  describe('rejectAd', () => {
    it('rejects PENDING ad with reason', async () => {
      const ad = makeAd({ status: AdStatus.PENDING });
      mockAdRepository.findById.mockResolvedValue(ad);
      mockAdRepository.updateStatus.mockResolvedValue({ ...ad, status: AdStatus.REJECTED });

      await service.rejectAd('ad-123', 'admin-123', 'Creative does not meet guidelines');

      expect(mockAdRepository.updateStatus).toHaveBeenCalledWith(
        'ad-123',
        AdStatus.REJECTED,
        expect.objectContaining({ rejectionReason: 'Creative does not meet guidelines' })
      );
    });

    it('throws ValidationError when reason is empty', async () => {
      const ad = makeAd({ status: AdStatus.PENDING });
      mockAdRepository.findById.mockResolvedValue(ad);

      await expect(service.rejectAd('ad-123', 'admin-123', ''))
        .rejects.toThrow(ValidationError);
    });
  });

  // ── deleteAd ──────────────────────────────────────────────────────────────
  describe('deleteAd', () => {
    it('deletes DRAFT ad owned by user', async () => {
      const ad = makeAd({ userId: 'user-123', status: AdStatus.DRAFT });
      mockAdRepository.findById.mockResolvedValue(ad);
      mockAdRepository.delete.mockResolvedValue(ad);

      await service.deleteAd('ad-123', 'user-123', false);
      expect(mockAdRepository.delete).toHaveBeenCalledWith('ad-123');
    });

    it('throws ValidationError when trying to delete non-DRAFT ad', async () => {
      const ad = makeAd({ userId: 'user-123', status: AdStatus.PUBLISHED });
      mockAdRepository.findById.mockResolvedValue(ad);

      await expect(service.deleteAd('ad-123', 'user-123', false))
        .rejects.toThrow(ValidationError);
    });
  });
});
