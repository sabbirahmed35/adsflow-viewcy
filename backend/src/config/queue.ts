import { Queue, Worker, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

export const redis = new IORedis(config.redis.url, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error('Redis error', err));

export const QUEUE_NAMES = {
  PUBLISH_AD: 'publish-ad',
  SYNC_PERFORMANCE: 'sync-performance',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export function createQueue<T>(name: QueueName): Queue<T> {
  return new Queue<T>(name, {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 200 },
    },
  });
}

export function createWorker<T>(
  name: QueueName,
  processor: (job: import('bullmq').Job<T>) => Promise<void>,
  concurrency = config.jobs.concurrency
): Worker<T> {
  const worker = new Worker<T>(name, processor, {
    connection: redis,
    concurrency,
  });

  worker.on('completed', (job) => logger.info(`Job ${name}/${job.id} completed`));
  worker.on('failed', (job, err) => logger.error(`Job ${name}/${job?.id} failed`, { error: err.message }));

  return worker;
}

export function createQueueEvents(name: QueueName): QueueEvents {
  return new QueueEvents(name, { connection: redis });
}

// Singleton queues
let publishQueue: Queue | null = null;
let syncQueue: Queue | null = null;

export function getPublishQueue() {
  if (!publishQueue) publishQueue = createQueue(QUEUE_NAMES.PUBLISH_AD);
  return publishQueue;
}

export function getSyncQueue() {
  if (!syncQueue) syncQueue = createQueue(QUEUE_NAMES.SYNC_PERFORMANCE);
  return syncQueue;
}
