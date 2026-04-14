// Re-export Prisma enums so they are compatible everywhere
export { UserRole, AdStatus, CampaignObjective, BudgetType, CtaType } from '@prisma/client';
import { UserRole, AdStatus, CtaType, CampaignObjective, BudgetType } from '@prisma/client';

export enum Placement {
  AUTOMATIC = 'AUTOMATIC',
  FACEBOOK_FEED = 'FACEBOOK_FEED',
  INSTAGRAM_FEED = 'INSTAGRAM_FEED',
  STORIES = 'STORIES',
  REELS = 'REELS',
}

export interface User {
  id: string; name: string; email: string; role: UserRole; createdAt: string;
}

export interface AdPerformance {
  id: string; adId: string; date: string; impressions: number; clicks: number;
  ctr: number; cpc: number; cpm: number; spend: number; conversions: number;
  reach: number; frequency: number; createdAt: string;
}

export interface GeneratedCopy { primaryText: string; headline: string; description: string; }
export interface ExtractedUrlMetadata { title: string; description: string; imageUrl: string | null; domain: string; }
export interface UploadCreativeResponse { url: string; key: string; type: 'IMAGE' | 'VIDEO'; size: number; mimeType: string; }
export interface PaginationQuery { page?: number; limit?: number; status?: AdStatus; search?: string; }
export interface PaginatedResponse<T> { data: T[]; total: number; page: number; limit: number; totalPages: number; }
export interface AdminStats { totalAds: number; byStatus: Record<AdStatus, number>; totalSpend: number; totalImpressions: number; totalClicks: number; avgCtr: number; }
export interface ApiResponse<T = unknown> { success: boolean; data?: T; error?: string; message?: string; }
export interface PublishAdJobPayload { adId: string; approvedBy: string; }
export interface SyncPerformanceJobPayload { adId?: string; }
