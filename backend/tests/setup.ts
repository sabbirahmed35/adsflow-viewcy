import { PrismaClient, UserRole, AdStatus, CampaignObjective, BudgetType, CtaType } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ─── Prisma mock ──────────────────────────────────────────────────────────────
jest.mock('../src/config/database', () => ({
  prisma: jestPrisma(),
  connectDatabase: jest.fn().mockResolvedValue(undefined),
  disconnectDatabase: jest.fn().mockResolvedValue(undefined),
}));

function jestPrisma() {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      return new Proxy({} as any, {
        get(_t, method) {
          return jest.fn().mockResolvedValue(null);
        },
      });
    },
  };
  return new Proxy({} as any, handler);
}

// ─── JWT helpers ──────────────────────────────────────────────────────────────
const JWT_SECRET = 'test-secret-32-chars-minimum!!!!!';

export function makeAccessToken(overrides?: Partial<{ userId: string; email: string; role: UserRole }>) {
  const payload = {
    userId: overrides?.userId ?? 'user-123',
    email: overrides?.email ?? 'test@example.com',
    role: overrides?.role ?? UserRole.CLIENT,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

export function makeAdminToken() {
  return makeAccessToken({ userId: 'admin-123', email: 'admin@example.com', role: UserRole.ADMIN });
}

// ─── Factory functions ────────────────────────────────────────────────────────
export function makeUser(overrides?: Partial<any>) {
  return {
    id: 'user-123',
    name: 'Test User',
    email: 'test@example.com',
    passwordHash: bcrypt.hashSync('password123', 1),
    role: UserRole.CLIENT,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makeAd(overrides?: Partial<any>) {
  return {
    id: 'ad-123',
    userId: 'user-123',
    status: AdStatus.DRAFT,
    websiteUrl: 'https://example.com/product',
    primaryText: 'This is a compelling primary text for the ad.',
    headline: 'Amazing Product',
    description: 'Short description here',
    cta: CtaType.LEARN_MORE,
    creativeUrl: 'https://s3.amazonaws.com/bucket/creative.jpg',
    creativeType: 'IMAGE',
    objective: CampaignObjective.TRAFFIC,
    budgetType: BudgetType.DAILY,
    budgetAmount: 25,
    startDate: null,
    endDate: null,
    locations: ['United States'],
    ageMin: 18,
    ageMax: 65,
    interests: ['Technology'],
    placements: ['AUTOMATIC'],
    metaCampaignId: null,
    metaAdSetId: null,
    metaAdId: null,
    rejectionReason: null,
    reviewedById: null,
    reviewedAt: null,
    publishError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id: 'user-123', name: 'Test User', email: 'test@example.com' },
    reviewedBy: null,
    performance: [],
    ...overrides,
  };
}

export function makePerformance(overrides?: Partial<any>) {
  return {
    id: 'perf-123',
    adId: 'ad-123',
    date: new Date(),
    impressions: 1500,
    clicks: 75,
    ctr: 5.0,
    cpc: 0.67,
    cpm: 8.5,
    spend: 50.0,
    conversions: 8,
    reach: 1300,
    frequency: 1.15,
    createdAt: new Date(),
    ...overrides,
  };
}

// ─── Environment setup ────────────────────────────────────────────────────────
process.env.JWT_SECRET = JWT_SECRET;
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-chars-min!!';
process.env.JWT_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.NODE_ENV = 'test';
process.env.ANTHROPIC_API_KEY = 'test-key';
process.env.META_ACCESS_TOKEN = 'test-meta-token';
process.env.META_AD_ACCOUNT_ID = 'act_123456';
