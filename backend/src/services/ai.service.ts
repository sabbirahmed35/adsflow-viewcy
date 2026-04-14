import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';
import { AppError } from '../middleware/errorHandler';
import { GeneratedCopy, ExtractedUrlMetadata } from '../types/shared';
import { logger } from '../utils/logger';

// Lazy-init to avoid crash if key not set in dev
let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) {
    if (!config.anthropic.apiKey) throw new AppError(503, 'AI service not configured');
    _client = new Anthropic({ apiKey: config.anthropic.apiKey });
  }
  return _client;
}

export class AIService {
  async extractUrlMetadata(url: string): Promise<ExtractedUrlMetadata> {
    try {
      // Use Claude to intelligently extract/infer metadata from URL
      const domain = new URL(url).hostname.replace('www.', '');
      const pathSegments = new URL(url).pathname
        .split('/')
        .filter(Boolean)
        .map((s) => s.replace(/-/g, ' '));

      const prompt = `Given this URL: ${url}

Extract useful metadata for creating a Facebook ad. Based on the URL structure and domain, infer:
1. A likely page title (be specific and realistic)
2. A likely page description (1-2 sentences about what this page offers)
3. The domain name cleaned up

Respond with ONLY valid JSON, no markdown:
{"title":"...","description":"...","domain":"${domain}","imageUrl":null}`;

      const message = await getClient().messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = message.content
        .filter((b) => b.type === 'text')
        .map((b) => (b as { type: 'text'; text: string }).text)
        .join('');

      const clean = text.replace(/```json|```/g, '').trim();
      return JSON.parse(clean);
    } catch (err) {
      logger.warn('URL metadata extraction failed, using fallback', { url, err });
      const domain = new URL(url).hostname.replace('www.', '');
      const slug = new URL(url).pathname.split('/').filter(Boolean).pop() ?? '';
      return {
        title: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || domain,
        description: `Visit ${domain} to learn more.`,
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
    const prompt = `You are an expert Facebook ads copywriter specializing in high-converting direct response copy.

URL: ${url}
Page title: ${metadata.title}
Page description: ${metadata.description}
Domain: ${metadata.domain}
${context ? `Additional context: ${context}` : ''}

Write compelling Facebook ad copy that:
- Primary text: 2-3 punchy sentences (max 125 chars each), emotionally engaging, benefit-driven, creates urgency
- Headline: 4-7 words, attention-grabbing, specific benefit or curiosity-driven
- Description: 8-12 words, supporting detail or social proof

Return ONLY valid JSON, no markdown, no code fences:
{"primaryText":"...","headline":"...","description":"..."}`;

    const message = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    try {
      const clean = text.replace(/```json|```/g, '').trim();
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

    const prompt = `You are an expert Facebook ads copywriter.

URL: ${url}
Domain: ${metadata.domain}

Previous copy (do NOT reuse this verbatim — create something fresh and different):
- Primary text: "${existingCopy.primaryText}"
- Headline: "${existingCopy.headline}"
- Description: "${existingCopy.description}"

${feedback ? `The user wants: ${feedback}` : 'Generate a completely different angle and tone.'}

Requirements:
- Different hook/angle than the previous copy
- Primary text: 2-3 sentences, max 125 chars each
- Headline: 4-7 words
- Description: 8-12 words

Return ONLY valid JSON:
{"primaryText":"...","headline":"...","description":"..."}`;

    const message = await getClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('');

    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);
    return {
      primaryText: parsed.primaryText || parsed.primary_text || '',
      headline: parsed.headline || '',
      description: parsed.description || '',
    };
  }
}

export const aiService = new AIService();
