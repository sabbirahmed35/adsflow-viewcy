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
    logger.error('Meta API error', { path, code: err?.code, message: err?.message, full: JSON.stringify(data) });
    throw new AppError(502, `Meta API error: ${err?.message || 'Unknown error'}`);
  }

  return data as T;
}

export interface MetaPublishResult {
  campaignId: string;
  adSetId: string;
  adId: string;
  creativeId: string;
  customConversionId: string | null;
}

export interface PublishAdParams {
  websiteUrl: string;
  primaryText: string;
  headline: string;
  description: string;
  cta: string;
  creativeUrl: string;
  creativeType: 'IMAGE' | 'VIDEO';
  creativeKey?: string;
  existingCampaignId?: string | null;
  existingAdSetId?: string | null;
  existingCustomConversionId?: string | null;
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
  TRAFFIC: 'OUTCOME_TRAFFIC',
  AWARENESS: 'OUTCOME_AWARENESS',
  SALES: 'OUTCOME_SALES',
  LEAD_GENERATION: 'OUTCOME_LEADS',
};

// Map our CTA to Meta's
const CTA_MAP: Record<string, string> = {
  LEARN_MORE: 'LEARN_MORE',
  SHOP_NOW: 'SHOP_NOW',
  SIGN_UP: 'SIGN_UP',
  GET_OFFER: 'GET_OFFER',
  BOOK_NOW: 'BOOK_TRAVEL',  // Meta's correct value for Book Now
  CONTACT_US: 'CONTACT_US',
  DOWNLOAD: 'DOWNLOAD',
};

export class MetaService {
  private get accountId() {
    return config.meta.adAccountId;
  }

  // ─── Custom conversion helpers ──────────────────────────────────────────────

  private extractEventSlug(url: string): string | null {
    try {
      const match = url.match(/\/event\/([^/?#]+)/);
      return match ? match[1] : null;
    } catch { return null; }
  }

  private buildEventName(slug: string, wordCount: number = 4): string {
    // Replace underscores/hyphens with spaces, capitalize each word
    const words = slug.replace(/[-_]/g, ' ').split(' ').filter(Boolean);
    return words.slice(0, wordCount)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  private buildDateSuffix(): string {
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    return `${dd}${mm}${yy}`;
  }

  private buildAdName(url: string): string {
    const slug = this.extractEventSlug(url);
    if (!slug) return `AdFlow ${this.buildDateSuffix()}`;
    return `${this.buildEventName(slug)} ${this.buildDateSuffix()}`;
  }

  private buildConversionName(slug: string): string {
    const eventName = this.buildEventName(slug, 2);
    const date = new Date().toISOString().split('T')[0];
    return `Purchase - ${eventName} ${date}`;
  }

  async createCustomConversion(websiteUrl: string): Promise<string | null> {
    const slug = this.extractEventSlug(websiteUrl);
    if (!slug) {
      logger.warn('Could not extract event slug from URL', { websiteUrl });
      return null;
    }

    const conversionName = this.buildConversionName(slug);
    const urlPath = `/event/${slug}/`;

    try {
      // Meta rule format - matches manual creation exactly
      const rule = JSON.stringify({
        and: [
          { event: { eq: 'Purchase' } },
          { or: [{ URL: { i_contains: urlPath } }] }
        ]
      });

      logger.debug('Creating custom conversion', { conversionName, urlPath, rule });

      const res = await metaRequest<{ id: string }>('POST', `/${this.accountId}/customconversions`, {
        name: conversionName,
        event_source_id: config.meta.pixelId,
        rule,
        custom_event_type: 'PURCHASE',
        description: `Auto-created for event: ${websiteUrl}`,
      });

      logger.info('Custom conversion created', { id: res.id, name: conversionName, urlPath });
      return res.id;
    } catch (err: any) {
      const fullError = err.response?.data?.error || err.message;
      const errMsg = typeof fullError === 'object' ? fullError.message : fullError;

      // Handle duplicate - Meta returns the existing conversion name in the error
      // We need to look it up by name
      if (errMsg?.includes('Duplicate Custom Conversion Rule')) {
        try {
          logger.info('Duplicate conversion found, looking up by name...', { conversionName });
          const { data: lookupResp } = await require('axios').get(
            `https://graph.facebook.com/v20.0/${this.accountId}/customconversions`,
            { params: { access_token: config.meta.accessToken, fields: 'id,name', limit: '200' } }
          );
          logger.debug('Listed conversions', { count: lookupResp.data?.length });
          const match = lookupResp.data?.find((c: any) => c.name === conversionName);
          if (match) {
            logger.info('Reusing existing custom conversion', { id: match.id });
            return match.id;
          }
          logger.warn('No match found', { conversionName });
        } catch (lookupErr: any) {
          logger.error('Lookup failed', { error: lookupErr.response?.data || lookupErr.message });
        }
      }

      logger.error('Failed to create custom conversion', { error: fullError, websiteUrl, name: conversionName });
      return null;
    }
  }

  async publishAd(params: PublishAdParams): Promise<MetaPublishResult> {
    if (!config.meta.accessToken || !config.meta.adAccountId) {
      throw new AppError(503, 'Meta API not configured');
    }

    logger.info('Starting Meta publish flow', { url: params.websiteUrl });

    // Reuse existing campaign/adset if provided (multiple ads under same campaign)
    let customConversionId: string | null = params.existingCustomConversionId || null;
    let campaignId: string;
    let adSetId: string;

    if (params.existingCampaignId && params.existingAdSetId) {
      // Reuse existing campaign and ad set
      campaignId = params.existingCampaignId;
      adSetId = params.existingAdSetId;
      logger.info('Reusing existing campaign and ad set', { campaignId, adSetId });
    } else {
      // Create custom conversion for SALES ads with event URLs
      if (params.objective === 'SALES' && params.websiteUrl.includes('/event/')) {
        customConversionId = await this.createCustomConversion(params.websiteUrl);
      }
      campaignId = await this.createCampaign(params);
      adSetId = await this.createAdSet(params, campaignId, customConversionId);
    }
    const creativeId = await this.createCreative(params);
    const adId = await this.createAd(adSetId, creativeId, params.websiteUrl);

    logger.info('Meta publish complete', { campaignId, adSetId, adId, creativeId, customConversionId });
    return { campaignId, adSetId, adId, creativeId, customConversionId };
  }

  private async createCampaign(params: PublishAdParams): Promise<string> {
    const objective = OBJECTIVE_MAP[params.objective] ?? 'OUTCOME_TRAFFIC';
    const res = await metaRequest<{ id: string }>('POST', `/${this.accountId}/campaigns`, {
      name: this.buildAdName(params.websiteUrl),
      objective,
      status: 'ACTIVE',
      special_ad_categories: [],
      buying_type: 'AUCTION',
      is_adset_budget_sharing_enabled: false,
    });
    logger.debug('Campaign created', { id: res.id });
    return res.id;
  }

  private async createAdSet(params: PublishAdParams, campaignId: string, customConversionId?: string | null): Promise<string> {
    const targeting: Record<string, unknown> = {
      age_min: params.ageMin,
      age_max: params.ageMax,
      geo_locations: this.buildGeoLocations(params.locations),
    };

    const isSales = params.objective === 'SALES';
    const budgetKey = params.budgetType === 'DAILY' ? 'daily_budget' : 'lifetime_budget';

    const body: Record<string, unknown> = {
      name: this.buildAdName(params.websiteUrl),
      campaign_id: campaignId,
      targeting,
      optimization_goal: isSales ? 'OFFSITE_CONVERSIONS' : 'LINK_CLICKS',
      billing_event: 'IMPRESSIONS',
      bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
      [budgetKey]: Math.round(params.budgetAmount * 100), // cents
      status: 'ACTIVE',
    };

    // Sales ads: add promoted_object with pixel and custom conversion
    if (isSales && config.meta.pixelId) {
      if (customConversionId) {
        // Include both pixel_id and custom_conversion_id for proper UI display
        // pixel_id shows the dataset, custom_conversion_id shows the conversion event
        body.promoted_object = {
          pixel_id: config.meta.pixelId,
          custom_conversion_id: customConversionId,
        };
      } else {
        body.promoted_object = {
          pixel_id: config.meta.pixelId,
          custom_event_type: 'PURCHASE',
        };
      }
    }

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

  private async uploadVideo(videoUrl: string, name: string): Promise<string> {
    // Upload video to Meta by providing the file URL
    const res = await metaRequest<{ id: string }>('POST', `/${this.accountId}/advideos`, {
      name: `AdFlow Video — ${name}`,
      file_url: videoUrl,
    });
    logger.debug('Video uploaded to Meta', { id: res.id });
    return res.id;
  }

  private async waitForVideoReady(videoId: string): Promise<string | null> {
    // Wait for video to finish processing and get thumbnail
    // Retry up to 10 times with 5s delay = up to 50 seconds
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const res = await metaRequest<{
          status: { processing_progress: number; video_status: string };
          thumbnails: { data: Array<{ uri: string; is_preferred: boolean }> };
        }>('GET', `/${videoId}`, { fields: 'status,thumbnails' });

        const status = res.status?.video_status;
        const thumbs = res.thumbnails?.data || [];

        logger.debug('Video status check', { videoId, status, attempt: i + 1 });

        if (status === 'ready' && thumbs.length > 0) {
          const preferred = thumbs.find((t: any) => t.is_preferred) || thumbs[0];
          logger.debug('Video ready with thumbnail', { videoId, attempt: i + 1 });
          return preferred?.uri || null;
        }

        logger.debug('Video not ready yet, retrying...', { videoId, status, attempt: i + 1 });
      } catch {
        logger.debug('Video status check failed, retrying...', { videoId, attempt: i + 1 });
      }
    }
    return null;
  }

  private async createCreative(params: PublishAdParams): Promise<string> {
    const cta = CTA_MAP[params.cta] ?? 'LEARN_MORE';
    const pageId = config.meta.pageId || config.meta.appId;

    let objectStorySpec: Record<string, unknown>;

    if (params.creativeType === 'VIDEO' && params.creativeUrl) {
      // Upload video to Meta first to get video_id
      const videoId = await this.uploadVideo(params.creativeUrl, params.headline);
      // Get thumbnail for the video
      const thumbnailUrl = await this.waitForVideoReady(videoId);
      if (!thumbnailUrl) {
        throw new Error('Could not get video thumbnail from Meta. Please try again in a few minutes.');
      }
      objectStorySpec = {
        page_id: pageId,
        video_data: {
          video_id: videoId,
          image_url: thumbnailUrl,
          message: params.primaryText,
          title: params.headline,
          call_to_action: { type: cta, value: { link: params.websiteUrl } },
        },
      };
    } else {
      objectStorySpec = {
        page_id: pageId,
        link_data: {
          link: params.websiteUrl,
          message: params.primaryText,
          name: params.headline,
          description: params.description,
          image_url: params.creativeUrl,
          call_to_action: { type: cta, value: { link: params.websiteUrl } },
        },
      };
    }

    // Use original filename from S3 key or URL as creative name
    const creativeName = params.creativeKey
      ? params.creativeKey.split('/').pop()?.split('?')[0] || this.buildAdName(params.websiteUrl)
      : params.creativeUrl
        ? params.creativeUrl.split('/').pop()?.split('?')[0] || this.buildAdName(params.websiteUrl)
        : this.buildAdName(params.websiteUrl);

    const res = await metaRequest<{ id: string }>('POST', `/${this.accountId}/adcreatives`, {
      name: creativeName.substring(0, 255),
      object_story_spec: objectStorySpec,
    });
    logger.debug('Creative created', { id: res.id });
    return res.id;
  }

  private async createAd(adSetId: string, creativeId: string, websiteUrl: string): Promise<string> {
    const adBody: Record<string, unknown> = {
      name: this.buildAdName(websiteUrl),
      adset_id: adSetId,
      creative: { creative_id: creativeId },
      status: 'ACTIVE',
    };

    if (config.meta.pixelId) {
      adBody.tracking_specs = [{
        'action.type': ['offsite_conversion'],
        fb_pixel: [config.meta.pixelId],
      }];
    }

    const res = await metaRequest<{ id: string }>('POST', `/${this.accountId}/ads`, adBody);
    logger.debug('Ad created', { id: res.id });
    return res.id;
  }

  async getCampaignName(campaignId: string): Promise<string | null> {
    try {
      const res = await metaRequest<{ name: string }>('GET', `/${campaignId}`, { fields: 'name' });
      return res.name || null;
    } catch {
      return null;
    }
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

  private buildGeoLocations(locations: string[]): Record<string, unknown> {
    const customLocations: Array<{ latitude: number; longitude: number; radius: number; distance_unit: string }> = [];
    const countries: string[] = [];

    for (const loc of locations) {
      // Check if it's a coordinate format: "lat,lng+Xmi"
      const coordMatch = loc.match(/^(-?\d+\.\d+),(-?\d+\.\d+)(?:\+(\d+)mi)?/);
      if (coordMatch) {
        customLocations.push({
          latitude: parseFloat(coordMatch[1]),
          longitude: parseFloat(coordMatch[2]),
          radius: coordMatch[3] ? parseInt(coordMatch[3]) : 10,
          distance_unit: 'mile',
        });
      } else {
        countries.push(this.countryToCode(loc));
      }
    }

    if (customLocations.length > 0) {
      return { custom_locations: customLocations };
    }
    return { countries: countries.length > 0 ? countries : ['US'] };
  }

  private countryToCode(country: string): string {
    const map: Record<string, string> = {
      'United States': 'US', 'United Kingdom': 'GB', 'Canada': 'CA',
      'Australia': 'AU', 'Germany': 'DE', 'France': 'FR', 'India': 'IN',
      'Brazil': 'BR', 'Japan': 'JP', 'Mexico': 'MX', 'Nigeria': 'NG',
      'South Africa': 'ZA', 'United Arab Emirates': 'AE', 'Singapore': 'SG',
      'Netherlands': 'NL', 'Spain': 'ES', 'Italy': 'IT', 'Pakistan': 'PK',
      'Bangladesh': 'BD', 'Philippines': 'PH', 'Indonesia': 'ID',
      'Turkey': 'TR', 'Saudi Arabia': 'SA', 'Egypt': 'EG', 'Kenya': 'KE',
      'Ghana': 'GH', 'Argentina': 'AR', 'Colombia': 'CO', 'Malaysia': 'MY',
      'Thailand': 'TH', 'Global': 'US',
    };
    // If already a 2-letter code, return as-is
    if (country.length === 2) return country.toUpperCase();
    return map[country] ?? country.substring(0, 2).toUpperCase();
  }
}

export const metaService = new MetaService();
