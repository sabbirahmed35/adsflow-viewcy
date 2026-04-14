import { Request, Response } from 'express';
import { z } from 'zod';
import { adService } from '../services/ad.service';
import { ok, created, noContent } from '../middleware/errorHandler';
import { AdStatus, BudgetType, CampaignObjective, CtaType } from '@prisma/client';
import { UserRole } from '@prisma/client';

const createAdSchema = z.object({
  websiteUrl: z.string().url(),
  primaryText: z.string().max(2000).default(''),
  headline: z.string().max(255).default(''),
  description: z.string().max(500).default(''),
  cta: z.nativeEnum(CtaType).default(CtaType.LEARN_MORE),
  creativeUrl: z.string().url().optional(),
  creativeType: z.enum(['IMAGE', 'VIDEO']).optional(),
  objective: z.nativeEnum(CampaignObjective).default(CampaignObjective.TRAFFIC),
  budgetType: z.nativeEnum(BudgetType).default(BudgetType.DAILY),
  budgetAmount: z.number().positive().max(100000).default(25),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  locations: z.array(z.string()).min(1).default(['United States']),
  ageMin: z.number().int().min(13).max(65).default(18),
  ageMax: z.number().int().min(13).max(65).default(65),
  interests: z.array(z.string()).default([]),
  placements: z.array(z.string()).default(['AUTOMATIC']),
});

const updateAdSchema = createAdSchema.partial();

export class AdController {
  async list(req: Request, res: Response) {
    const page = parseInt(String(req.query.page ?? 1));
    const limit = Math.min(parseInt(String(req.query.limit ?? 20)), 100);
    const status = req.query.status as AdStatus | undefined;
    const result = await adService.getUserAds(req.user!.userId, page, limit, status);
    ok(res, result);
  }

  async get(req: Request, res: Response) {
    const isAdmin = req.user!.role === UserRole.ADMIN;
    const ad = await adService.getAdById(req.params.id, req.user!.userId, isAdmin);
    ok(res, ad);
  }

  async create(req: Request, res: Response) {
    const body = createAdSchema.parse(req.body);
    const ad = await adService.createAd(req.user!.userId, body as any);
    created(res, ad);
  }

  async update(req: Request, res: Response) {
    const body = updateAdSchema.parse(req.body);
    const isAdmin = req.user!.role === UserRole.ADMIN;
    const ad = await adService.updateAd(req.params.id, req.user!.userId, isAdmin, body as any);
    ok(res, ad);
  }

  async delete(req: Request, res: Response) {
    const isAdmin = req.user!.role === UserRole.ADMIN;
    await adService.deleteAd(req.params.id, req.user!.userId, isAdmin);
    noContent(res);
  }

  async submit(req: Request, res: Response) {
    const ad = await adService.submitAd(req.params.id, req.user!.userId);
    ok(res, ad);
  }

  async getPerformance(req: Request, res: Response) {
    const isAdmin = req.user!.role === UserRole.ADMIN;
    const perf = await adService.getAdPerformance(req.params.id, req.user!.userId, isAdmin);
    ok(res, perf);
  }
}

export const adController = new AdController();
