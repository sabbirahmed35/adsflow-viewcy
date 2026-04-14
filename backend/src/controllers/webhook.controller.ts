import { Request, Response } from 'express';
import crypto from 'crypto';
import { config } from '../config';
import { prisma } from '../config/database';
import { AdStatus } from '../types/shared';
import { logger } from '../utils/logger';

/**
 * Meta sends webhooks to notify us of ad status changes, delivery issues,
 * and account policy violations in real-time.
 *
 * Setup in Meta App Dashboard:
 *   Webhooks → Subscribe to: "ads" object → fields: ad_review_update, ad_account
 *
 * Verify Token: set META_WEBHOOK_VERIFY_TOKEN in your .env
 * Callback URL: https://yourdomain.com/api/webhooks/meta
 */

function verifySignature(req: Request): boolean {
  const signature = req.headers['x-hub-signature-256'] as string;
  if (!signature) return false;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', config.meta.appSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

interface MetaAdStatusChange {
  ad_id: string;
  status: string; // ACTIVE, PAUSED, DISAPPROVED, WITH_ISSUES, etc.
  review_feedback?: {
    global?: string[];
    [placement: string]: string[] | undefined;
  };
}

async function handleAdStatusChange(change: MetaAdStatusChange) {
  const ad = await prisma.ad.findFirst({
    where: { metaAdId: change.ad_id },
  });

  if (!ad) {
    logger.warn('[webhook] Meta ad not found in DB', { metaAdId: change.ad_id });
    return;
  }

  const metaStatus = change.status?.toUpperCase();

  if (metaStatus === 'DISAPPROVED') {
    const feedback = change.review_feedback;
    const reasons = Object.values(feedback ?? {})
      .flat()
      .filter(Boolean)
      .join('; ');

    await prisma.ad.update({
      where: { id: ad.id },
      data: {
        status: AdStatus.REJECTED,
        rejectionReason: `Meta disapproved: ${reasons || 'Policy violation'}`,
      },
    });
    logger.info('[webhook] Ad disapproved by Meta', { adId: ad.id, reasons });
  } else if (metaStatus === 'PAUSED') {
    await prisma.ad.update({
      where: { id: ad.id },
      data: { status: AdStatus.PAUSED },
    });
    logger.info('[webhook] Ad paused on Meta', { adId: ad.id });
  } else if (metaStatus === 'ACTIVE') {
    await prisma.ad.update({
      where: { id: ad.id },
      data: { status: AdStatus.PUBLISHED },
    });
    logger.info('[webhook] Ad re-activated on Meta', { adId: ad.id });
  }
}

export class WebhookController {
  // GET /api/webhooks/meta — Meta verification handshake
  verify(req: Request, res: Response): void {
    const mode      = req.query['hub.mode'];
    const token     = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.META_WEBHOOK_VERIFY_TOKEN ?? 'adflow-webhook-secret';

    if (mode === 'subscribe' && token === verifyToken) {
      logger.info('[webhook] Meta webhook verified');
      res.status(200).send(challenge);
    } else {
      logger.warn('[webhook] Meta webhook verification failed');
      res.status(403).json({ error: 'Verification failed' });
    }
  }

  // POST /api/webhooks/meta — Receive real-time events
  async receive(req: Request, res: Response): Promise<void> {
    // Always respond quickly — Meta will retry if we timeout
    res.status(200).json({ received: true });

    if (config.env === 'production' && !verifySignature(req)) {
      logger.warn('[webhook] Invalid Meta signature — ignoring');
      return;
    }

    const body = req.body as {
      object: string;
      entry: Array<{
        id: string;
        changes: Array<{
          value: MetaAdStatusChange;
          field: string;
        }>;
      }>;
    };

    if (body.object !== 'ad_account') {
      logger.debug('[webhook] Ignoring non-ad_account webhook', { object: body.object });
      return;
    }

    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        try {
          if (change.field === 'ad_review_update') {
            await handleAdStatusChange(change.value);
          }
        } catch (err) {
          logger.error('[webhook] Error handling Meta event', {
            field: change.field,
            error: (err as Error).message,
          });
        }
      }
    }
  }
}

export const webhookController = new WebhookController();
