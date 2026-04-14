// Re-export Prisma enums so shared types stay compatible
export { UserRole, AdStatus, CampaignObjective, BudgetType, CtaType } from '@prisma/client';

export enum Placement {
  AUTOMATIC = 'AUTOMATIC',
  FACEBOOK_FEED = 'FACEBOOK_FEED',
  INSTAGRAM_FEED = 'INSTAGRAM_FEED',
  STORIES = 'STORIES',
  REELS = 'REELS',
}

// ─── Core Models ──────────────────────────────────────────────────────────────

import { UserRole, AdStatus, CtaType, CampaignObjective, BudgetType } from '@prisma/client';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Ad {
  id: string;
  userId: string;
  user?: Pick<User, 'id' | 'name' | 'email'>;
  status: AdStatus;
  websiteUrl: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: CtaType;
  creativeUrl: string | null;
  creativeType: 'IMAGE' | 'VIDEO' | null;
  objective: CampaignObjective;
  budgetType: BudgetType;
  budgetAmount: number;
  startDate: string | null;
  endDate: string | null;
  locations: string[];
  ageMin: number;
  ageMax: number;
  interests: string[];
  placements: Placement[];
  metaCampaignId: string | null;
  metaAdSetId: string | null;
  metaAdId: string | null;
  rejectionReason: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  performance?: AdPerformance[];
  latestPerformance?: AdPerformance | null;
}

export interface AdPerformance {
  id: string;
  adId: string;
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  cpm: number;
  spend: number;
  conversions: number;
  reach: number;
  frequency: number;
  createdAt: string;
}

// ─── Request / Response Types ─────────────────────────────────────────────────

export interface CreateAdDTO {
  websiteUrl: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: CtaType;
  creativeUrl?: string;
  creativeType?: 'IMAGE' | 'VIDEO';
  objective: CampaignObjective;
  budgetType: BudgetType;
  budgetAmount: number;
  startDate?: string;
  endDate?: string;
  locations: string[];
  ageMin: number;
  ageMax: number;
  interests: string[];
  placements: Placement[];
}

export type UpdateAdDTO = Partial<CreateAdDTO>;

export interface GenerateCopyDTO {
  url: string;
  extractedTitle?: string;
  extractedDescription?: string;
}

export interface GeneratedCopy {
  primaryText: string;
  headline: string;
  description: string;
}

export interface ExtractedUrlMetadata {
  title: string;
  description: string;
  imageUrl: string | null;
  domain: string;
}

export interface UploadCreativeResponse {
  url: string;
  key: string;
  type: 'IMAGE' | 'VIDEO';
  size: number;
  mimeType: string;
}

export interface RejectAdDTO {
  reason: string;
}

export interface AuthLoginDTO {
  email: string;
  password: string;
}

export interface AuthRegisterDTO {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  status?: AdStatus;
  search?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminStats {
  totalAds: number;
  byStatus: Record<AdStatus, number>;
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  avgCtr: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PublishAdJobPayload {
  adId: string;
  approvedBy: string;
}

export interface SyncPerformanceJobPayload {
  adId?: string;
}
