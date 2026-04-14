import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { config } from './config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { redis } from './config/queue';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { authRouter, adRouter, adminRouter, aiRouter, uploadRouter, webhookRouter } from './routes';

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: config.frontendUrl,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const limiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true });
const authLimiter = rateLimit({ windowMs: 60_000, max: 10, standardHeaders: true });
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api', limiter);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logging ──────────────────────────────────────────────────────────────────
app.use(morgan(config.env === 'production' ? 'combined' : 'dev', {
  stream: { write: (msg) => logger.http(msg.trim()) },
}));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', env: config.env, ts: new Date().toISOString() });
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',   authRouter);
app.use('/api/ads',    adRouter);
app.use('/api/admin',  adminRouter);
app.use('/api/ai',     aiRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/webhooks', webhookRouter);

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ success: false, error: 'Route not found' }));

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Startup ──────────────────────────────────────────────────────────────────
async function start() {
  await connectDatabase();
  logger.info('Redis status: ' + redis.status);

  const server = app.listen(config.port, () => {
    logger.info(`Server running on http://localhost:${config.port} [${config.env}]`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down`);
    server.close(async () => {
      await disconnectDatabase();
      redis.disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT',  () => shutdown('SIGINT'));
}

start().catch((err) => {
  logger.error('Startup failed', err);
  process.exit(1);
});

export default app;
