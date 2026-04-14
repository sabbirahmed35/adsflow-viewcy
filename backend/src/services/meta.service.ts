import { config } from '../config';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

const BASE = `https://graph.facebook.com/${config.meta.apiVersion}`;

interface MetaApiError {
  error: { message: string; type: string; code: number; fbtrace_id: string };
}

async function metaRequest<T extends object>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const url = `${BASE}${path}`;
  const params = new URLSearchParams({ access_token: config.meta.accessToken });

  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  let finalUrl = url;
  if (method === 'GET') {
    if (body) Object.entries(body).forEach(([k, v]) => params.set(k, String(v)));
    finalUrl = `${url}?${params}`;
  } else {
    finalUrl = `${url}?${params}`;
    options.body = JSON.stringify(body);
  }

  const res = await fetch(finalUrl, options);
  const data = (await res.json()) as T | MetaApiError;

  if (!res.ok || 'error' in data) {
    const err = (data as MetaApiError).error;
    logger.error('Meta API error', { path, code: err?.code, message: err?.message });
    throw new AppError(502, `Meta API error: ${err?.message || 'Unknown error'}`);
  }

  return data as T;
}

export interface MetaPublishResult {
  campaignId: string;
  adSetId: string;
  adId: string;
  creativeId: string;
}

export interface PublishAdParams {
  websiteUrl: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  creativeUrl: string;
  creativeType: 'IMAGE' | 'VIDEO';
  objective: string;
  budgetType: 'DAILY' | 'LIFETIME';
  budgetAmount: number;
  startDate?: Date;
  endDate?: Date;
  locations: string[];
  ageMin: number;
  ageMax: number;
  interests: string[];
}

// Map our objectives to Meta's
const OBJECTIVE_MAP: Record<string, string> = {
  TRAFFIC: 'LINK_CLICKS',
  AWARENESS: 'BRAND_AWARENESS',
  SALES: 'CONVERSIONS',
  LEAD_GENERATION: 'LEAD_GENERATION',
};

// Map our CTA to Meta's
const CTA_MAP: Record<string, string> = {
  LEARN_MORE: 'LEARN_MORE',
  SHOP_NOW: 'SHOP_NOW',
  SIGN_UP: 'SIGN_UP',
  GET_OFFER: 'GET_OFFER',
  BOOK_NOW: 'BOOK_NOW',
  CONTACT_US: 'CONTACT_US',
  DOWNLOAD: 'DOWNLOAD',
};

export class MetaService {
  private get accountId() {
    return config.meta.adAccountId;
  }

  async publishAd(params: PublishAdParams): Promise<MetaPublishResult> {
    if (!config.meta.accessToken || !config.meta.adAccountId) {
      throw new AppError(503, 'Meta API not configured');
    }

    logger.info('Starting Meta publish flow', { url: params.websiteUrl });

    const campaignId = await this.createCampaign(params);
    const adSetId = await this.createAdSet(params, campaignId);
    const creativeId = await this.createCreative(params);
    const adId = await this.createAd(adSetId, creativeId, params.primaryText);

    logger.info('Meta publish complete', { campaignId, adSetId, adId, creativeId });
    return { campaignId, adSetId, adId, creativeId };
  }

  private async createCampaign(params: PublishAdParams): Promise<string> {
    const objective = OBJECTIVE_MAP[params.objective] ?? 'LINK_CLICKS';
    const res = await metaRequest<{ id: string }>('POST', `/${this.accountId}/campaigns`, {
      name: `AdFlow — ${params.headline} — ${new Date().toISOString()}`,
      objective,
      status: 'ACTIVE',
      special_ad_categories: [],
    });
    logger.debug('Campaign created', { id: res.id });
    return res.id;
  }

  private async createAdSet(params: PublishAdParams, campaignId: string): Promise<string> {
    const targeting: Record<string, unknown> = {
      age_min: params.ageMin,
      age_max: params.ageMax,
      geo_locations: {
        countries: params.locations.map((l) => this.countryToCode(l)),
      },
    };

    if (params.interests.length) {
      targeting.flexible_spec = [
        {
          interests: params.interests.slice(0, 5).map((name, i) => ({
            id: String(6003623684364 + i),
            name,
          })),
        },
      ];
    }

    const budgetKey =
      params.budgetType === 'DAILY' ? 'daily_budget' : 'lifetime_budget';

    const body: Record<string, unknown> = {
      name: `AdFlow AdSet — ${params.headline}`,
      campaign_id: campaignId,
      targeting,
      optimization_goal: 'LINK_CLICKS',
      billing_event: 'IMPRESSIONS',
      [budgetKey]: Math.round(params.budgetAmount * 100), // cents
      status: 'ACTIVE',
    };

    if (params.startDate) {
      body.start_time = Math.floor(params.startDate.getTime() / 1000);
    }
    if (params.endDate && params.budgetType === 'LIFETIME') {
      body.end_time = Math.floor(params.endDate.getTime() / 1000);
    }

    const res = await metaRequest<{ id: string }>('POST', `/${this.accountId}/adsets`, body);
    logger.debug('Ad set created', { id: res.id });
    return res.id;
  }

  private async createCreative(params: PublishAdParams): Promise<string> {
    const cta = CTA_MAP[params.cta] ?? 'LEARN_MORE';
    const domain = new URL(params.websiteUrl).hostname;

    const objectStorySpec =
      params.creativeType === 'VIDEO'
        ? {
            page_id: config.meta.appId,
            video_data: {
              video_url: params.creativeUrl,
              message: params.primaryText,
              title: params.headline,
              call_to_action: { type: cta, value: { link: params.websiteUrl } },
            },
          }
        : {
            page_id: config.meta.appId,
            link_data: {
              link: params.websiteUrl,
              message: params.primaryText,
              name: params.headline,
              description: params.description,
              image_url: params.creativeUrl,
              call_to_action: { type: cta, value: { link: params.websiteUrl } },
            },
          };

    const res = await metaRequest<{ id: string }>('POST', `/${this.accountId}/adcreatives`, {
      name: `AdFlow Creative — ${params.headline}`,
      object_story_spec: objectStorySpec,
    });
    logger.debug('Creative created', { id: res.id });
    return res.id;
  }

  private async createAd(adSetId: string, creativeId: string, name: string): Promise<string> {
    const res = await metaRequest<{ id: string }>('POST', `/${this.accountId}/ads`, {
      name: `AdFlow Ad — ${name}`,
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: 'ACTIVE',
    });
    logger.debug('Ad created', { id: res.id });
    return res.id;
  }

  async getAdInsights(metaAdId: string, datePreset = 'last_14d') {
    try {
      const res = await metaRequest<{
        data: Array<{
          date_start: string;
          impressions: string;
          clicks: string;
          ctr: string;
          cpc: string;
          cpm: string;
          spend: string;
          actions?: Array<{ action_type: string; value: string }>;
          reach: string;
          frequency: string;
        }>;
      }>('GET', `/${metaAdId}/insights`, {
        fields: 'date_start,impressions,clicks,ctr,cpc,cpm,spend,actions,reach,frequency',
        date_preset: datePreset,
        time_increment: '1',
        level: 'ad',
      });
      return res.data;
    } catch (err) {
      logger.warn('Failed to fetch Meta insights', { metaAdId, err });
      return [];
    }
  }

  async pauseAd(metaAdId: string): Promise<void> {
    await metaRequest('POST', `/${metaAdId}`, { status: 'PAUSED' });
  }

  async resumeAd(metaAdId: string): Promise<void> {
    await metaRequest('POST', `/${metaAdId}`, { status: 'ACTIVE' });
  }

  private countryToCode(country: string): string {
    const map: Record<string, string> = {
      'United States': 'US',
      'Canada': 'CA',
      'United Kingdom': 'GB',
      'Australia': 'AU',
      'Germany': 'DE',
      'France': 'FR',
      'Global': 'US',
    };
    return map[country] ?? country.substring(0, 2).toUpperCase();
  }
}

export const metaService = new MetaService();
