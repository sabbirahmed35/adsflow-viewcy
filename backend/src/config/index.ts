import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3001')),
  frontendUrl: optional('FRONTEND_URL', 'http://localhost:5173'),

  db: {
    url: required('DATABASE_URL'),
  },

  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
  },

  jwt: {
    secret: optional('JWT_SECRET', 'dev-secret-change-in-production-32chars!!'),
    refreshSecret: optional('JWT_REFRESH_SECRET', 'dev-refresh-secret-change-in-prod!!'),
    expiresIn: optional('JWT_EXPIRES_IN', '15m'),
    refreshExpiresIn: optional('JWT_REFRESH_EXPIRES_IN', '7d'),
  },

  aws: {
    accessKeyId: optional('AWS_ACCESS_KEY_ID', ''),
    secretAccessKey: optional('AWS_SECRET_ACCESS_KEY', ''),
    region: optional('AWS_REGION', 'us-east-1'),
    s3Bucket: optional('AWS_S3_BUCKET', 'adflow-creatives'),
  },

  meta: {
    appId: optional('META_APP_ID', ''),
    appSecret: optional('META_APP_SECRET', ''),
    accessToken: optional('META_ACCESS_TOKEN', ''),
    adAccountId: optional('META_AD_ACCOUNT_ID', ''),
    apiVersion: optional('META_API_VERSION', 'v20.0'),
    pageId: optional('META_PAGE_ID', ''),
  },

  anthropic: {
    apiKey: optional('ANTHROPIC_API_KEY', ''),
  },

  jobs: {
    perfSyncCron: optional('PERF_SYNC_CRON', '0 */2 * * *'),
    concurrency: parseInt(optional('JOB_CONCURRENCY', '3')),
  },

  upload: {
    maxSizeMb: parseInt(optional('MAX_UPLOAD_SIZE_MB', '30')),
    allowedImageTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
    allowedVideoTypes: ['video/mp4', 'video/quicktime', 'video/x-msvideo'],
  },
} as const;

export type Config = typeof config;
