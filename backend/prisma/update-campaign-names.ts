/**
 * update-campaign-names.ts
 *
 * 1. Fetches actual campaign names from Meta and updates the database
 * 2. Checks for NEW campaigns in Meta not in the database yet and imports them
 *
 * Run with:
 *   cd backend
 *   npx ts-node --require dotenv/config prisma/update-campaign-names.ts
 */

import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';
import axios from 'axios';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN!;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID!;
const META_API_VERSION = process.env.META_API_VERSION || 'v20.0';
const BASE = `https://graph.facebook.com/${META_API_VERSION}`;

async function metaGet<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const { data } = await axios.get(`${BASE}${endpoint}`, {
    params: { access_token: META_ACCESS_TOKEN, ...params },
  });
  if (data.error) throw new Error(data.error.message);
  return data as T;
}

async function fetchAllMetaAds() {
  console.log(`\n📡 Fetching all ads from Meta account: ${META_AD_ACCOUNT_ID}...`);
  const data = await metaGet<{ data: any[] }>(`/${META_AD_ACCOUNT_ID}/ads`, {
    fields: 'id,name,status,adset_id,campaign_id,creative{id,object_story_spec,image_url},created_time',
    limit: '200',
  });
  console.log(`✅ Found ${data.data.length} ads in Meta\n`);
  return data.data;
}

async function fetchCampaign(campaignId: string) {
  try {
    return await metaGet<any>(`/${campaignId}`, {
      fields: 'name,objective,status,daily_budget,lifetime_budget',
    });
  } catch { return null; }
}

async function fetchAdSet(adSetId: string) {
  try {
    return await metaGet<any>(`/${adSetId}`, {
      fields: 'name,daily_budget,lifetime_budget,targeting',
    });
  } catch { return null; }
}

async function fetchAdInsights(metaAdId: string) {
  try {
    const data = await metaGet<{ data: any[] }>(`/${metaAdId}/insights`, {
      fields: 'date_start,impressions,clicks,ctr,cpc,cpm,spend,actions,reach,frequency',
      date_preset: 'last_30d',
      time_increment: '1',
    });
    return data.data || [];
  } catch { return []; }
}

function mapObjective(obj: string): string {
  const map: Record<string, string> = {
    LINK_CLICKS: 'TRAFFIC', OUTCOME_TRAFFIC: 'TRAFFIC',
    BRAND_AWARENESS: 'AWARENESS', OUTCOME_AWARENESS: 'AWARENESS',
    CONVERSIONS: 'SALES', OUTCOME_SALES: 'SALES',
    LEAD_GENERATION: 'LEAD_GENERATION', OUTCOME_LEADS: 'LEAD_GENERATION',
    REACH: 'AWARENESS', OUTCOME_ENGAGEMENT: 'AWARENESS',
  };
  return map[obj] || 'TRAFFIC';
}

function mapStatus(s: string): string {
  return { ACTIVE: 'PUBLISHED', PAUSED: 'PAUSED', DELETED: 'FAILED', ARCHIVED: 'PAUSED' }[s] || 'PUBLISHED';
}

async function main() {
  console.log('🚀 Syncing campaigns from Meta...\n');

  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
    throw new Error('Missing META_ACCESS_TOKEN or META_AD_ACCOUNT_ID in .env');
  }

  const adminUser = await (prisma as any).user.findFirst({ where: { role: 'ADMIN' } });
  if (!adminUser) throw new Error('No admin user found. Run seed first.');

  // ── PART 1: Update existing campaign names ───────────────────────────────
  console.log('─── PART 1: Updating existing campaign names ───────────────────\n');

  const existingAds = await (prisma as any).ad.findMany({
    where: { metaCampaignId: { not: null } },
    select: { id: true, metaCampaignId: true },
  });

  const uniqueCampaignIds = [...new Set(existingAds.map((a: any) => a.metaCampaignId as string))] as string[];
  console.log(`Fetching names for ${uniqueCampaignIds.length} unique campaigns...\n`);

  const campaignNames: Record<string, string> = {};
  for (const cid of uniqueCampaignIds) {
    process.stdout.write(`  ${cid}... `);
    const campaign = await fetchCampaign(cid);
    if (campaign?.name) {
      campaignNames[cid] = campaign.name;
      console.log(`✅ "${campaign.name}"`);
    } else {
      console.log('❌ failed');
    }
    await new Promise(r => setTimeout(r, 150));
  }

  let namesUpdated = 0;
  for (const ad of existingAds) {
    const name = campaignNames[ad.metaCampaignId as string];
    if (name) {
      try {
        await prisma.$executeRawUnsafe(
          `UPDATE ads SET "metaCampaignName" = $1 WHERE id = $2`,
          name, ad.id
        );
        namesUpdated++;
      } catch (e: any) {
        // Column might not exist yet - add it first
        await prisma.$executeRawUnsafe(`ALTER TABLE ads ADD COLUMN IF NOT EXISTS "metaCampaignName" TEXT`);
        await prisma.$executeRawUnsafe(
          `UPDATE ads SET "metaCampaignName" = $1 WHERE id = $2`,
          name, ad.id
        );
        namesUpdated++;
      }
    }
  }
  console.log(`\n✅ Updated ${namesUpdated} campaign names\n`);

  // ── PART 2: Import new campaigns ─────────────────────────────────────────
  console.log('─── PART 2: Checking for new campaigns ─────────────────────────\n');

  const metaAds = await fetchAllMetaAds();

  const existingMetaAdIds = new Set(
    (await (prisma as any).ad.findMany({
      where: { metaAdId: { not: null } },
      select: { metaAdId: true },
    })).map((a: any) => a.metaAdId as string)
  );

  const newAds = metaAds.filter((a: any) => !existingMetaAdIds.has(a.id));
  console.log(`Found ${newAds.length} new ads not in database\n`);

  let imported = 0;
  let failed = 0;

  for (const metaAd of newAds) {
    console.log(`📦 Importing: ${metaAd.name} (${metaAd.id})`);
    try {
      const [campaign, adSet] = await Promise.all([
        fetchCampaign(metaAd.campaign_id),
        fetchAdSet(metaAd.adset_id),
      ]);

      const storySpec = metaAd.creative?.object_story_spec || {};
      const linkData = storySpec.link_data || storySpec.video_data || {};
      const websiteUrl = linkData.link || 'https://example.com';
      const primaryText = (linkData.message || metaAd.name || '').substring(0, 500);
      const headline = (linkData.name || linkData.title || metaAd.name || '').substring(0, 255);
      const description = (linkData.description || '').substring(0, 255);
      const creativeUrl = metaAd.creative?.image_url || null;

      const dailyBudget = adSet?.daily_budget ? parseFloat(adSet.daily_budget) / 100 : 0;
      const lifetimeBudget = adSet?.lifetime_budget ? parseFloat(adSet.lifetime_budget) / 100 : 0;
      const budgetType = adSet?.lifetime_budget ? 'LIFETIME' : 'DAILY';
      const budgetAmount = budgetType === 'LIFETIME' ? lifetimeBudget : (dailyBudget || 10);
      const targeting = adSet?.targeting || {};
      const locations = targeting.geo_locations?.countries || ['US'];

      const ad = await (prisma as any).ad.create({
        data: {
          userId: adminUser.id,
          status: mapStatus(metaAd.status),
          websiteUrl: websiteUrl.substring(0, 500),
          primaryText,
          headline,
          description,
          cta: 'LEARN_MORE',
          creativeUrl,
          creativeType: creativeUrl ? 'IMAGE' : null,
          objective: mapObjective(campaign?.objective || ''),
          budgetType,
          budgetAmount,
          locations,
          ageMin: targeting.age_min || 18,
          ageMax: targeting.age_max || 65,
          interests: [],
          placements: ['AUTOMATIC'],
          metaCampaignId: metaAd.campaign_id,
          metaAdSetId: metaAd.adset_id,
          metaAdId: metaAd.id,
          reviewedById: adminUser.id,
          reviewedAt: new Date(),
        },
      });

      const insights = await fetchAdInsights(metaAd.id);
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
        const conversions = row.actions
          ?.filter((a: any) => ['purchase', 'lead', 'complete_registration'].includes(a.action_type))
          .reduce((sum: number, a: any) => sum + parseInt(a.value), 0) ?? 0;

        await (prisma as any).adPerformance.upsert({
          where: { adId_date: { adId: ad.id, date } },
          create: { adId: ad.id, date, impressions, clicks, ctr, cpc, cpm, spend, conversions, reach, frequency },
          update: { impressions, clicks, ctr, cpc, cpm, spend, conversions, reach, frequency },
        });
      }

      // Set campaign name via raw SQL (works even if column was just added)
      if (campaign?.name) {
        await prisma.$executeRawUnsafe(
          `UPDATE ads SET "metaCampaignName" = $1 WHERE id = $2`,
          campaign.name, ad.id
        );
      }
      console.log(`  ✅ Imported with ${insights.length} days of data`);
      imported++;
    } catch (err: any) {
      console.error(`  ❌ Failed: ${err.message}`);
      failed++;
    }
  }

  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log(`✅ Campaign names updated: ${namesUpdated}`);
  console.log(`✅ New ads imported:       ${imported}`);
  console.log(`❌ Failed:                 ${failed}`);
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('\n🎉 Done! Refresh the All Campaigns page.\n');
}

main()
  .catch((err) => { console.error('Fatal error:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
