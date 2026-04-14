import request from 'supertest';
import express from 'express';
import { UserRole, AdStatus } from '@prisma/client';
import { makeUser, makeAd, makeAccessToken, makeAdminToken } from '../setup';

// ── Lightweight express app for integration tests ──────────────────────────────
// We wire up just the routes without starting the real DB/Redis.

const mockAuthService = {
  login: jest.fn(),
  register: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
};

const mockAdService = {
  getUserAds: jest.fn(),
  getAdById: jest.fn(),
  createAd: jest.fn(),
  updateAd: jest.fn(),
  deleteAd: jest.fn(),
  submitAd: jest.fn(),
  approveAd: jest.fn(),
  rejectAd: jest.fn(),
  getAdPerformance: jest.fn(),
  getAllAds: jest.fn(),
  getPendingAds: jest.fn(),
  getStats: jest.fn(),
};

jest.mock('../../src/services/auth.service', () => ({ authService: mockAuthService }));
jest.mock('../../src/services/ad.service', () => ({ adService: mockAdService }));
jest.mock('../../src/config/database', () => ({
  prisma: { user: { findUnique: jest.fn() } },
  connectDatabase: jest.fn(),
}));

// Override JWT secret for tests
process.env.JWT_SECRET = 'test-secret-32-chars-minimum!!!!!';

import app from '../../src/index';

// ─── Auth routes ──────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('returns 200 with tokens on valid credentials', async () => {
    const user = makeUser();
    mockAuthService.login.mockResolvedValue({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBe('access-token');
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'password123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when email is invalid format', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: 'password123' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/register', () => {
  it('returns 201 on successful registration', async () => {
    const user = makeUser();
    mockAuthService.register.mockResolvedValue({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email: 'new@example.com', password: 'password123' });

    expect(res.status).toBe(201);
    expect(res.body.data.user.email).toBe('new@example.com');
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'New User', email: 'new@example.com', password: 'short' });

    expect(res.status).toBe(400);
  });
});

// ─── Ads routes ───────────────────────────────────────────────────────────────
describe('GET /api/ads', () => {
  it('returns 401 when no token provided', async () => {
    const res = await request(app).get('/api/ads');
    expect(res.status).toBe(401);
  });

  it('returns 200 with paginated ads when authenticated', async () => {
    mockAdService.getUserAds.mockResolvedValue({
      data: [makeAd()],
      total: 1, page: 1, limit: 20, totalPages: 1,
    });

    const res = await request(app)
      .get('/api/ads')
      .set('Authorization', `Bearer ${makeAccessToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.data.data).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });
});

describe('POST /api/ads', () => {
  const validPayload = {
    websiteUrl: 'https://example.com',
    primaryText: 'Great product, buy now!',
    headline: 'Amazing Product',
    description: 'The best you can get',
    cta: 'LEARN_MORE',
    objective: 'TRAFFIC',
    budgetType: 'DAILY',
    budgetAmount: 25,
    locations: ['United States'],
    ageMin: 18,
    ageMax: 65,
    interests: ['Technology'],
    placements: ['AUTOMATIC'],
  };

  it('creates ad and returns 201', async () => {
    mockAdService.createAd.mockResolvedValue(makeAd());

    const res = await request(app)
      .post('/api/ads')
      .set('Authorization', `Bearer ${makeAccessToken()}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(mockAdService.createAd).toHaveBeenCalled();
  });

  it('returns 400 when websiteUrl is not a valid URL', async () => {
    const res = await request(app)
      .post('/api/ads')
      .set('Authorization', `Bearer ${makeAccessToken()}`)
      .send({ ...validPayload, websiteUrl: 'not-a-url' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/ads/:id/submit', () => {
  it('submits ad for review', async () => {
    mockAdService.submitAd.mockResolvedValue(makeAd({ status: AdStatus.PENDING }));

    const res = await request(app)
      .post('/api/ads/ad-123/submit')
      .set('Authorization', `Bearer ${makeAccessToken()}`);

    expect(res.status).toBe(200);
    expect(mockAdService.submitAd).toHaveBeenCalledWith('ad-123', 'user-123');
  });
});

// ─── Admin routes ─────────────────────────────────────────────────────────────
describe('POST /api/admin/ads/:id/approve', () => {
  it('returns 403 when CLIENT tries to approve', async () => {
    const res = await request(app)
      .post('/api/admin/ads/ad-123/approve')
      .set('Authorization', `Bearer ${makeAccessToken({ role: UserRole.CLIENT })}`);

    expect(res.status).toBe(403);
  });

  it('approves ad when ADMIN makes request', async () => {
    mockAdService.approveAd.mockResolvedValue(makeAd({ status: AdStatus.APPROVED }));

    const res = await request(app)
      .post('/api/admin/ads/ad-123/approve')
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/admin/ads/:id/reject', () => {
  it('returns 400 when reason is missing', async () => {
    const res = await request(app)
      .post('/api/admin/ads/ad-123/reject')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ reason: 'short' }); // too short (< 10 chars)

    expect(res.status).toBe(400);
  });

  it('rejects ad with valid reason', async () => {
    mockAdService.rejectAd.mockResolvedValue(makeAd({ status: AdStatus.REJECTED }));

    const res = await request(app)
      .post('/api/admin/ads/ad-123/reject')
      .set('Authorization', `Bearer ${makeAdminToken()}`)
      .send({ reason: 'Creative does not meet Meta ad policies.' });

    expect(res.status).toBe(200);
  });
});
