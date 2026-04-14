import { AdStatus } from '@prisma/client';
import { makeAd } from '../setup';

// Mock all external deps
const mockPrismaAd = {
  update: jest.fn(),
  findUnique: jest.fn(),
};

const mockMetaService = {
  publishAd: jest.fn(),
};

jest.mock('../../src/config/database', () => ({
  prisma: { ad: mockPrismaAd },
}));

jest.mock('../../src/services/meta.service', () => ({
  metaService: mockMetaService,
}));

import { handlePublishAd } from '../../src/jobs/publishAd.job';

function makeJob(payload: any) {
  return { data: payload } as any;
}

describe('handlePublishAd', () => {
  beforeEach(() => jest.clearAllMocks());

  it('marks ad PUBLISHING then PUBLISHED on success', async () => {
    const ad = makeAd({ status: AdStatus.APPROVED, creativeUrl: 'https://s3.example.com/img.jpg' });
    mockPrismaAd.findUnique.mockResolvedValue(ad);
    mockMetaService.publishAd.mockResolvedValue({
      campaignId: 'meta-campaign-1',
      adSetId: 'meta-adset-1',
      adId: 'meta-ad-1',
      creativeId: 'meta-creative-1',
    });
    mockPrismaAd.update.mockResolvedValue({});

    await handlePublishAd(makeJob({ adId: 'ad-123', approvedBy: 'admin-123' }));

    // First update: PUBLISHING
    expect(mockPrismaAd.update).toHaveBeenNthCalledWith(1,
      expect.objectContaining({ data: { status: AdStatus.PUBLISHING } })
    );

    // Second update: PUBLISHED with Meta IDs
    expect(mockPrismaAd.update).toHaveBeenNthCalledWith(2,
      expect.objectContaining({
        data: expect.objectContaining({
          status: AdStatus.PUBLISHED,
          metaCampaignId: 'meta-campaign-1',
          metaAdId: 'meta-ad-1',
        }),
      })
    );
  });

  it('marks ad FAILED and rethrows when Meta API fails', async () => {
    const ad = makeAd({ status: AdStatus.APPROVED, creativeUrl: 'https://s3.example.com/img.jpg' });
    mockPrismaAd.findUnique.mockResolvedValue(ad);
    mockMetaService.publishAd.mockRejectedValue(new Error('Meta API rate limit exceeded'));
    mockPrismaAd.update.mockResolvedValue({});

    await expect(handlePublishAd(makeJob({ adId: 'ad-123', approvedBy: 'admin-123' })))
      .rejects.toThrow('Meta API rate limit exceeded');

    expect(mockPrismaAd.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AdStatus.FAILED,
          publishError: 'Meta API rate limit exceeded',
        }),
      })
    );
  });

  it('throws when ad has no creative URL', async () => {
    const ad = makeAd({ status: AdStatus.APPROVED, creativeUrl: null });
    mockPrismaAd.findUnique.mockResolvedValue(ad);
    mockPrismaAd.update.mockResolvedValue({});

    await expect(handlePublishAd(makeJob({ adId: 'ad-123', approvedBy: 'admin-123' })))
      .rejects.toThrow('no creative URL');
  });

  it('throws when ad is not found', async () => {
    mockPrismaAd.findUnique.mockResolvedValue(null);
    mockPrismaAd.update.mockResolvedValue({});

    await expect(handlePublishAd(makeJob({ adId: 'nonexistent', approvedBy: 'admin-123' })))
      .rejects.toThrow('not found');
  });
});
