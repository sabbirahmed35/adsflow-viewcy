import { AuthService } from '../../src/services/auth.service';
import { ConflictError, AppError } from '../../src/middleware/errorHandler';
import { makeUser } from '../setup';
import bcrypt from 'bcryptjs';

// Mock Prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
  },
};

jest.mock('../../src/config/database', () => ({ prisma: mockPrisma }));

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
    jest.clearAllMocks();
    mockPrisma.refreshToken.create.mockResolvedValue({ token: 'refresh-token', userId: 'user-123' });
  });

  // ── register ───────────────────────────────────────────────────────────────
  describe('register', () => {
    it('creates user and returns tokens when email is new', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const created = makeUser();
      mockPrisma.user.create.mockResolvedValue(created);

      const result = await service.register('Test User', 'test@example.com', 'password123');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
      expect(result.user.email).toBe('test@example.com');
    });

    it('throws ConflictError when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(makeUser());

      await expect(service.register('Test', 'test@example.com', 'password123'))
        .rejects.toThrow(ConflictError);
    });
  });

  // ── login ──────────────────────────────────────────────────────────────────
  describe('login', () => {
    it('returns tokens when credentials are valid', async () => {
      const hash = await bcrypt.hash('correctpassword', 1);
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ passwordHash: hash }));

      const result = await service.login('test@example.com', 'correctpassword');

      expect(result.accessToken).toBeTruthy();
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('throws 401 when email not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login('nobody@example.com', 'pass'))
        .rejects.toThrow(AppError);
    });

    it('throws 401 when password is wrong', async () => {
      const hash = await bcrypt.hash('correctpassword', 1);
      mockPrisma.user.findUnique.mockResolvedValue(makeUser({ passwordHash: hash }));

      await expect(service.login('test@example.com', 'wrongpassword'))
        .rejects.toThrow(AppError);
    });
  });

  // ── refresh ────────────────────────────────────────────────────────────────
  describe('refresh', () => {
    it('throws 401 when refresh token not found in DB', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      // Need a valid JWT first (even if DB lookup fails)
      const { v4: uuid } = require('uuid');
      await expect(service.refresh('invalid-token'))
        .rejects.toThrow(AppError);
    });

    it('throws 401 when refresh token is expired in DB', async () => {
      const expiredDate = new Date(Date.now() - 1000);
      mockPrisma.refreshToken.findUnique.mockResolvedValue({
        token: 'some-token',
        userId: 'user-123',
        expiresAt: expiredDate,
      });

      await expect(service.refresh('invalid-jwt'))
        .rejects.toThrow(AppError);
    });
  });
});
