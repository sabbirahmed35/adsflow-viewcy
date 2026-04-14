import { Request, Response } from 'express';
import { z } from 'zod';
import { aiService } from '../services/ai.service';
import { ok } from '../middleware/errorHandler';

const generateSchema = z.object({
  url: z.string().url(),
  context: z.string().max(500).optional(),
});

const regenerateSchema = z.object({
  url: z.string().url(),
  existingCopy: z.object({
    primaryText: z.string(),
    headline: z.string(),
    description: z.string(),
  }),
  feedback: z.string().max(500).optional(),
});

export class AIController {
  async extractUrl(req: Request, res: Response) {
    const { url } = z.object({ url: z.string().url() }).parse(req.body);
    const metadata = await aiService.extractUrlMetadata(url);
    ok(res, metadata);
  }

  async generateCopy(req: Request, res: Response) {
    const { url, context } = generateSchema.parse(req.body);
    const metadata = await aiService.extractUrlMetadata(url);
    const copy = await aiService.generateAdCopy(url, metadata, context);
    ok(res, { copy, metadata });
  }

  async regenerateCopy(req: Request, res: Response) {
    const { url, existingCopy, feedback } = regenerateSchema.parse(req.body);
    const copy = await aiService.regenerateCopy(url, existingCopy, feedback);
    ok(res, copy);
  }
}

export const aiController = new AIController();
