import 'express-async-errors';
import { Queue } from 'bullmq';
import { connectDatabase, disconnectDatabase } from './config/database';
import { redis, QUEUE_NAMES, createWorker, getSyncQueue } from './config/queue';
import { handlePublishAd } from './jobs/publishAd.job';
import { handleSyncPerformance } from './jobs/syncPerformance.job';
import { config } from './config';
import { logger } from './utils/logger';

async function startWorker() {
  await connectDatabase();
  logger.info('[worker] Database connected');

  // ── Publish worker ──────────────────────────────────────────────────────────
  const publishWorker = createWorker(QUEUE_NAMES.PUBLISH_AD, handlePublishAd, 3);
  logger.info('[worker] Publish worker started');

  // ── Performance sync worker ─────────────────────────────────────────────────
  const syncWorker = createWorker(QUEUE_NAMES.SYNC_PERFORMANCE, handleSyncPerformance, 1);
  logger.info('[worker] Performance sync worker started');

  // ── Cron scheduler ─────────────────────────────────────────────────────────
  // Schedule recurring performance sync using BullMQ's repeatable jobs
  const syncQueue = getSyncQueue();
  await syncQueue.add(
    'sync-all',
    {}, // empty payload = sync all published ads
    {
      repeat: { pattern: config.jobs.perfSyncCron },
      jobId: 'perf-sync-cron',
    }
  );
  logger.info(`[worker] Performance sync cron scheduled: ${config.jobs.perfSyncCron}`);

  // ── Graceful shutdown ───────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`[worker] ${signal} — shutting down workers`);
    await publishWorker.close();
    await syncWorker.close();
    await disconnectDatabase();
    redis.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));

  logger.info('[worker] All workers running. Waiting for jobs...');
}

startWorker().catch((err) => {
  logger.error('[worker] Startup failed', err);
  process.exit(1);
});
