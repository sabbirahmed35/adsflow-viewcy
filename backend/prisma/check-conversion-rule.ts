/**
 * check-conversion-rule.ts
 * Fetches existing custom conversions to see exact rule format Meta uses
 *
 * Run with:
 *   cd backend
 *   npx ts-node --require dotenv/config prisma/check-conversion-rule.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import axios from 'axios';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN!;
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID!;
const META_API_VERSION = process.env.META_API_VERSION || 'v20.0';
const BASE = `https://graph.facebook.com/${META_API_VERSION}`;

async function main() {
  console.log('Fetching custom conversions...\n');

  const { data } = await axios.get(`${BASE}/${META_AD_ACCOUNT_ID}/customconversions`, {
    params: {
      access_token: META_ACCESS_TOKEN,
      fields: 'id,name,rule,custom_event_type,event_source_id',
      limit: '5',
    },
  });

  for (const conv of data.data) {
    console.log('─────────────────────────────────────');
    console.log('Name:', conv.name);
    console.log('ID:', conv.id);
    console.log('Rule (raw):', conv.rule);
    try {
      console.log('Rule (parsed):', JSON.stringify(JSON.parse(conv.rule || '{}'), null, 2));
    } catch { console.log('Could not parse rule'); }
    console.log('Event type:', conv.custom_event_type);
    console.log('Pixel ID:', conv.event_source_id);
    console.log();
  }
}

main().catch(console.error);
