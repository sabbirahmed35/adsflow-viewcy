import { Request, Response } from 'express';
import { z } from 'zod';
import { adService } from '../services/ad.service';
import { ok } from '../middleware/errorHandler';
import { AdStatus } from '@prisma/client';

export class AdminController {
  async listAds(req: Request, res: Response) {
    const page = parseInt(String(req.query.page ?? 1));
    const limit = Math.min(parseInt(String(req.query.limit ?? 20)), 100);
    const status = req.query.status as AdStatus | undefined;
    const search = req.query.search as string | undefined;
    const result = await adService.getAllAds(page, limit, status, search);
    ok(res, result);
  }

  async getPendingAds(req: Request, res: Response) {
    const ads = await adService.getPendingAds();
    ok(res, ads);
  }

  async approve(req: Request, res: Response) {
    const ad = await adService.approveAd(req.params.id, req.user!.userId);
    ok(res, ad);
  }

  async reject(req: Request, res: Response) {
    const { reason } = z.object({ reason: z.string().min(10).max(1000) }).parse(req.body);
    const ad = await adService.rejectAd(req.params.id, req.user!.userId, reason);
    ok(res, ad);
  }

  async getStats(req: Request, res: Response) {
    const stats = await adService.getStats();
    ok(res, stats);
  }
}

export const adminController = new AdminController();
