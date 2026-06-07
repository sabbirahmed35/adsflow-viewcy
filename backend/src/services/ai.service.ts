import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { GeneratedCopy, ExtractedUrlMetadata } from '../types/shared';
import { logger } from '../utils/logger';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    if (!config.anthropic.apiKey) throw new AppError(503, 'AI service not configured');
    _client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return _client;
}

// ─── Fetch real page content from viewcy event pages ─────────────────────────
async function fetchPageContent(url: string): Promise<string> {
  try {
    const { data } = await axios.get(url, {
      timeout: 8000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AdFlowBot/1.0)',
        'Accept': 'text/html',
      },
    });

    // Extract text content — strip HTML tags
    const text = (data as string)
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000); // Keep first 3000 chars

    return text;
  } catch {
    return '';
  }
}

export class AIService {
  async extractUrlMetadata(url: string): Promise<ExtractedUrlMetadata> {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      const pageContent = await fetchPageContent(url);

      const prompt = `You are extracting event details from a Viewcy event page.

URL: ${url}
Page content: ${pageContent || 'Not available - infer from URL'}

Extract the following event details. If not found in the content, infer from the URL slug:
- Event title/name
- Artist(s) or performer(s) names
- Event date and time
- Venue name and location/city
- Brief description of the event type (concert, qawwali, classical music, etc.)
- Any special features (workshop, dinner, etc.)

Respond with ONLY valid JSON, no markdown:
{
  "title": "full event title",
  "description": "2-3 sentence description with key details",
  "artists": "artist names if found",
  "date": "date and time if found",
  "venue": "venue name and location if found",
  "eventType": "type of event",
  "domain": "${domain}",
  "imageUrl": null
}`;

      const message = await getClient().messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = message.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('');

      const clean = text.replace(/```json|```/g, '').trim().replace(/,(\s*[}\]])/g, '$1');
      const parsed = JSON.parse(clean);
      return {
        title: parsed.title || '',
        description: parsed.description || '',
        imageUrl: null,
        domain,
        // Store extra event fields in description for use in copy generation
        ...(parsed.artists && { description: `${parsed.description} Artists: ${parsed.artists}. Date: ${parsed.date}. Venue: ${parsed.venue}.` }),
      };
    } catch (err) {
      logger.warn('URL metadata extraction failed, using fallback', { url, err });
      const domain = new URL(url).hostname.replace('www.', '');
      const slug = new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
      return {
        title: slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || domain,
        description: `Live event at ${domain}.`,
        imageUrl: null,
        domain,
      };
    }
  }

  async generateAdCopy(
    url: string,
    metadata: ExtractedUrlMetadata,
    context?: string
  ): Promise<GeneratedCopy> {
    const isViewcyEvent = url.includes('viewcy.com/event/');

    const prompt = isViewcyEvent
      ? `You are an expert Facebook ads copywriter for live events and cultural performances.

Event URL: ${url}
Event title: ${metadata.title}
Event details: ${metadata.description}
${context ? `Additional info: ${context}` : ''}

Write a compelling Facebook ad for this live event in the style of these examples:

Example 1:
"🎶 An Evening of Sitar & Bharatanatyam 🎭
Join acclaimed sitar virtuoso Indro Roy-Chowdhury and renowned tabla artist Indranil Mallick for an immersive journey through North Indian classical music, opening with a captivating Bharatanatyam dance performance by award-winning dancer Oindrila Roy Mallick.
📅 Saturday, June 6, 2026
🕖 7:00 PM (Doors 6:30 PM)
📍 TEMPO Concert Hall, Kingston, NY
Celebrate the profound beauty, rhythm, and spirituality of India's classical arts.
Reserve your seats today."

Example 2:
"Experience a night of breathtaking Hindustani classical music at Park Theater Hudson on May 30.
Featuring:
🎵 Sougata Roy Chowdhury — Sarod
🎤 Sohini Singha Mojumdar — Vocal
🥁 Ehren Hanson — Tabla
From soulful ragas to intricate rhythms, this special evening brings together three acclaimed artists for an unforgettable live performance.
📍 Park Theater Hudson | 📅 Sat, May 30, 2026 | 🕢 7:30 PM"

Rules:
- Start with the event name or a strong hook with relevant emoji
- Include artist names prominently if available
- Add date, time, and venue with emojis (📅 🕖 📍)
- End with a clear call to action ("Reserve your seats", "Get tickets now", "Join us")
- Keep it authentic and culturally respectful
- 150-300 words total
- Headline: 5-8 words, event name or key artist + event type
- Description: 10-15 words with date and venue

Return ONLY valid JSON, no markdown:
{"primaryText":"...","headline":"...","description":"..."}`

      : `You are an expert Facebook ads copywriter specializing in high-converting direct response copy.

URL: ${url}
Page title: ${metadata.title}
Page description: ${metadata.description}
Domain: ${metadata.domain}
${context ? `Additional context: ${context}` : ''}

Write compelling Facebook ad copy:
- Primary text: 2-3 punchy sentences (max 125 chars each), emotionally engaging, benefit-driven, creates urgency
- Headline: 4-7 words, attention-grabbing, specific benefit or curiosity-driven
- Description: 8-12 words, supporting detail or social proof

Return ONLY valid JSON, no markdown:
{"primaryText":"...","headline":"...","description":"..."}`;

    const message = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    try {
      const clean = text
        .replace(/```json|```/g, '')  // strip code fences
        .trim()
        .replace(/,(\s*[}\]])/g, '$1'); // remove trailing commas
      const parsed = JSON.parse(clean);
      return {
        primaryText: parsed.primaryText || parsed.primary_text || '',
        headline: parsed.headline || '',
        description: parsed.description || '',
      };
    } catch {
      logger.error('Failed to parse AI copy response', { text });
      throw new AppError(502, 'AI returned invalid response format');
    }
  }

  async regenerateCopy(
    url: string,
    existingCopy: GeneratedCopy,
    feedback?: string
  ): Promise<GeneratedCopy> {
    const metadata = await this.extractUrlMetadata(url);
    const isViewcyEvent = url.includes('viewcy.com/event/');

    const prompt = isViewcyEvent
      ? `You are an expert Facebook ads copywriter for live events.

Event URL: ${url}
Event details: ${metadata.title} — ${metadata.description}

Previous copy (create something DIFFERENT):
- Primary text: "${existingCopy.primaryText}"
- Headline: "${existingCopy.headline}"

${feedback ? `User wants: ${feedback}` : 'Try a completely different angle — different opening, different emphasis.'}

Write a fresh version following the same style as these examples:
- Start with event name or strong hook + emojis
- Include artists, date, time, venue with emojis (📅 🕖 📍)
- End with call to action
- 150-300 words

Return ONLY valid JSON:
{"primaryText":"...","headline":"...","description":"..."}`

      : `You are an expert Facebook ads copywriter.

URL: ${url}
Domain: ${metadata.domain}

Previous copy (do NOT reuse — create something fresh):
- Primary text: "${existingCopy.primaryText}"
- Headline: "${existingCopy.headline}"

${feedback ? `The user wants: ${feedback}` : 'Generate a completely different angle and tone.'}

Requirements:
- Different hook/angle than previous
- Primary text: 2-3 sentences, max 125 chars each
- Headline: 4-7 words
- Description: 8-12 words

Return ONLY valid JSON:
{"primaryText":"...","headline":"...","description":"..."}`;

    const message = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    const clean = text.replace(/```json|```/g, '').trim().replace(/,(\s*[}\]])/g, '$1');
    const parsed = JSON.parse(clean);
    return {
      primaryText: parsed.primaryText || parsed.primary_text || '',
      headline: parsed.headline || '',
      description: parsed.description || '',
    };
  }
}

export const aiService = new AIService();
