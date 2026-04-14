import { Request, Response } from 'express';
import { z } from 'zod';
import { authService } from '../services/auth.service';
import { ok, created } from '../middleware/errorHandler';
import { userRepository } from '../repositories/user.repository';

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export class AuthController {
  async register(req: Request, res: Response) {
    const body = registerSchema.parse(req.body);
    const result = await authService.register(body.name, body.email, body.password);
    created(res, result);
  }

  async login(req: Request, res: Response) {
    const body = loginSchema.parse(req.body);
    const result = await authService.login(body.email, body.password);
    ok(res, result);
  }

  async refresh(req: Request, res: Response) {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    const result = await authService.refresh(refreshToken);
    ok(res, result);
  }

  async logout(req: Request, res: Response) {
    const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);
    await authService.logout(refreshToken);
    ok(res, { message: 'Logged out' });
  }

  async me(req: Request, res: Response) {
    const user = await userRepository.findById(req.user!.userId);
    ok(res, user);
  }

  async updateProfile(req: Request, res: Response) {
    const { name } = z.object({ name: z.string().min(2).max(80) }).parse(req.body);
    const user = await userRepository.updateProfile(req.user!.userId, { name });
    ok(res, user);
  }
}

export const authController = new AuthController();
