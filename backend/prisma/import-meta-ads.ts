/**
 * import-meta-ads.ts
 * 
 * Imports your existing Meta ads into the database so they show
 * up in the admin dashboard with full performance data.
 * 
 * Run with:
 *   cd backend
 *   set DATABASE_URL=your_railway_db_url && set META_ACCESS_TOKEN=your_token && set META_AD_ACCOUNT_ID=act_your_id && npx ts-node --require dotenv/config prisma/import-meta-ads.ts
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import axios from 'axios';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN!;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID!; // e.g. act_679876111831234
const META_API_VERSION = process.env.META_API_VERSION || 'v20.0';
const BASE = `https://graph.facebook.com/${META_API_VERSION}`;

// ─── Meta API helpers ─────────────────────────────────────────────────────────

async function metaGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const { data } = await axios.get(`${BASE}${path}`, {
    params: { access_token: META_ACCESS_TOKEN, ...params },
  });
  if (data.error) {
    throw new Error(`Meta API error on ${path}: ${data.error?.message || JSON.stringify(data)}`);
  }
  return data as T;
}

// ─── Fetch all active/paused ads from your ad account ────────────────────────

async function fetchMetaAds() {
  console.log(`\n📡 Fetching ads from Meta account: ${META_AD_ACCOUNT_ID}...`);

  const data = await metaGet<{ data: any[] }>(`/${META_AD_ACCOUNT_ID}/ads`, {
    fields: [
      'id',
      'name',
      'status',
      'adset_id',
      'campaign_id',
      'creative{id,name,object_story_spec,image_url,video_id}',
      'created_time',
    ].join(','),
    limit: '100',
  });

  console.log(`✅ Found ${data.data.length} ads`);
  return data.data;
}

// ─── Fetch performance insights for a specific ad ────────────────────────────

async function fetchAdInsights(metaAdId: string) {
  try {
    const data = await metaGet<{ data: any[] }>(`/${metaAdId}/insights`, {
      fields: 'date_start,impressions,clicks,ctr,cpc,cpm,spend,actions,reach,frequency',
      date_preset: 'last_30d',
      time_increment: '1',
      level: 'ad',
    });
    return data.data || [];
  } catch (err: any) {
    console.warn(`  ⚠️  Could not fetch insights for ad ${metaAdId}: ${err.message}`);
    return [];
  }
}

// ─── Fetch adset details ──────────────────────────────────────────────────────

async function fetchAdSet(adSetId: string) {
  try {
    return await metaGet<any>(`/${adSetId}`, {
      fields: 'name,daily_budget,lifetime_budget,start_time,end_time,targeting,optimization_goal',
    });
  } catch {
    return null;
  }
}

// ─── Fetch campaign details ───────────────────────────────────────────────────

async function fetchCampaign(campaignId: string) {
  try {
    return await metaGet<any>(`/${campaignId}`, {
      fields: 'name,objective,status',
    });
  } catch {
    return null;
  }
}

// ─── Map Meta objective to our enum ──────────────────────────────────────────

function mapObjective(metaObjective: string): string {
  const map: Record<string, string> = {
    LINK_CLICKS: 'TRAFFIC',
    BRAND_AWARENESS: 'AWARENESS',
    CONVERSIONS: 'SALES',
    LEAD_GENERATION: 'LEAD_GENERATION',
    REACH: 'AWARENESS',
    VIDEO_VIEWS: 'AWARENESS',
    POST_ENGAGEMENT: 'AWARENESS',
    PAGE_LIKES: 'AWARENESS',
    APP_INSTALLS: 'TRAFFIC',
    MESSAGES: 'TRAFFIC',
    OUTCOME_TRAFFIC: 'TRAFFIC',
    OUTCOME_AWARENESS: 'AWARENESS',
    OUTCOME_LEADS: 'LEAD_GENERATION',
    OUTCOME_SALES: 'SALES',
    OUTCOME_ENGAGEMENT: 'AWARENESS',
  };
  return map[metaObjective] || 'TRAFFIC';
}

// ─── Map Meta status to our enum ─────────────────────────────────────────────

function mapStatus(metaStatus: string): string {
  const map: Record<string, string> = {
    ACTIVE: 'PUBLISHED',
    PAUSED: 'PAUSED',
    DELETED: 'FAILED',
    ARCHIVED: 'PAUSED',
    WITH_ISSUES: 'FAILED',
  };
  return map[metaStatus] || 'PUBLISHED';
}

// ─── Main import function ─────────────────────────────────────────────────────

async function main() {
  console.log('🚀 Starting Meta ads import...\n');

  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
    throw new Error('Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID in environment');
  }

  // Find or create an admin user to associate imported ads with
  let adminUser = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) {
    throw new Error('No admin user found in database. Run the seed first.');
  }
  console.log(`👤 Associating ads with admin: ${adminUser.email}`);

  const metaAds = await fetchMetaAds();

  let imported = 0;
  let skipped = 0;
  let failed = 0;

  for (const metaAd of metaAds) {
    console.log(`\n📦 Processing ad: ${metaAd.name} (${metaAd.id})`);

    try {
      // Check if already imported
      const existing = await prisma.ad.findFirst({ where: { metaAdId: metaAd.id } });
      if (existing) {
        console.log(`  ⏭️  Already imported, skipping`);
        skipped++;
        continue;
      }

      // Fetch campaign and adset details
      const [campaign, adSet] = await Promise.all([
        fetchCampaign(metaAd.campaign_id),
        fetchAdSet(metaAd.adset_id),
      ]);

      // Extract creative details
      const creative = metaAd.creative || {};
      const storySpec = creative.object_story_spec || {};
      const linkData = storySpec.link_data || storySpec.video_data || {};

      const websiteUrl = linkData.link || 'https://example.com';
      const primaryText = linkData.message || metaAd.name || '';
      const headline = linkData.name || linkData.title || metaAd.name || '';
      const description = linkData.description || '';
      const creativeUrl = creative.image_url || null;

      // Extract budget
      const dailyBudget = adSet?.daily_budget ? parseFloat(adSet.daily_budget) / 100 : 0;
      const lifetimeBudget = adSet?.lifetime_budget ? parseFloat(adSet.lifetime_budget) / 100 : 0;
      const budgetType = adSet?.lifetime_budget ? 'LIFETIME' : 'DAILY';
      const budgetAmount = budgetType === 'LIFETIME' ? lifetimeBudget : dailyBudget || 10;

      // Extract targeting
      const targeting = adSet?.targeting || {};
      const locations = targeting.geo_locations?.countries || ['US'];
      const ageMin = targeting.age_min || 18;
      const ageMax = targeting.age_max || 65;

      const objective = mapObjective(campaign?.objective || 'LINK_CLICKS');
      const status = mapStatus(metaAd.status);

      // Create ad in database
      const ad = await prisma.ad.create({
        data: {
          userId: adminUser.id,
          status: status as any,
          websiteUrl,
          primaryText: primaryText.substring(0, 500),
          headline: headline.substring(0, 255),
          description: description.substring(0, 255),
          cta: 'LEARN_MORE',
          creativeUrl,
          creativeType: creativeUrl ? 'IMAGE' : null,
          objective: objective as any,
          budgetType: budgetType as any,
          budgetAmount,
          locations,
          ageMin,
          ageMax,
          interests: [],
          placements: ['AUTOMATIC'],
          metaCampaignId: metaAd.campaign_id,
          metaAdSetId: metaAd.adset_id,
          metaAdId: metaAd.id,
          reviewedById: adminUser.id,
          reviewedAt: new Date(),
        },
      });

      console.log(`  ✅ Ad created in DB: ${ad.id}`);

      // Fetch and import performance data
      console.log(`  📊 Fetching performance data...`);
      const insights = await fetchAdInsights(metaAd.id);
      console.log(`  📈 Found ${insights.length} days of data`);

      for (const row of insights) {
        const date = new Date(row.date_start);
        const impressions = parseInt(row.impressions ?? '0');
        const clicks = parseInt(row.clicks ?? '0');
        const spend = parseFloat(row.spend ?? '0');
        const reach = parseInt(row.reach ?? '0');
        const frequency = parseFloat(row.frequency ?? '0');
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
        const conversions =
          row.actions
            ?.filter((a: any) =>
              ['purchase', 'lead', 'complete_registration'].includes(a.action_type)
            )
            .reduce((sum: number, a: any) => sum + parseInt(a.value), 0) ?? 0;

        await prisma.adPerformance.upsert({
          where: { adId_date: { adId: ad.id, date } },
          create: { adId: ad.id, date, impressions, clicks, ctr, cpc, cpm, spend, conversions, reach, frequency },
          update: { impressions, clicks, ctr, cpc, cpm, spend, conversions, reach, frequency },
        });
      }

      console.log(`  ✅ Performance data imported`);
      imported++;

    } catch (err: any) {
      console.error(`  ❌ Failed to import ad ${metaAd.id}: ${err.message}`);
      failed++;
    }
  }

  console.log('\n─────────────────────────────────────');
  console.log(`✅ Imported:  ${imported} ads`);
  console.log(`⏭️  Skipped:   ${skipped} ads (already existed)`);
  console.log(`❌ Failed:    ${failed} ads`);
  console.log('─────────────────────────────────────');
  console.log('\n🎉 Done! Check your admin dashboard.\n');
}

main()
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
