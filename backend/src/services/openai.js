import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

async function openAI(pathname, body) {
  if (!env.OPENAI_API_KEY) throw new AppError('Add OPENAI_API_KEY to enable AI content generation.', 503, 'AI_NOT_CONFIGURED');
  const response = await fetch(`https://api.openai.com/v1/${pathname}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new AppError(data.error?.message || 'AI generation failed.', 502, 'AI_PROVIDER_ERROR');
  return data;
}

export async function generateSocialCopy({ brand, topic, platform }) {
  const data = await openAI('chat/completions', {
    model: env.OPENAI_TEXT_MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You are a social media editor. Return valid JSON with keys title, caption, hashtags (array of strings). Write original, useful content in the brand voice. Do not invent statistics, guarantees, testimonials, or customer results.' },
      { role: 'user', content: JSON.stringify({ platform, brand: brand.name, niche: brand.niche, audience: brand.audience, voice: brand.voice, goals: brand.goals, topic }) },
    ],
    temperature: 0.75,
  });
  const result = JSON.parse(data.choices?.[0]?.message?.content || '{}');
  if (!result.caption) throw new AppError('AI returned an empty caption. Try another topic.', 502, 'AI_EMPTY_RESPONSE');
  return {
    title: String(result.title || topic || 'New social post').slice(0, 140),
    caption: String(result.caption).slice(0, 2200),
    hashtags: Array.isArray(result.hashtags) ? result.hashtags.map((tag) => `#${String(tag).replace(/^#+/, '').replace(/\s+/g, '')}`).slice(0, 20) : [],
    model: env.OPENAI_TEXT_MODEL,
  };
}

export async function generateSocialImage({ brand, topic }) {
  const data = await openAI('images/generations', {
    model: env.OPENAI_IMAGE_MODEL,
    prompt: `Create a polished Instagram feed image for ${brand.name}, a ${brand.niche} brand. Topic: ${topic}. Audience: ${brand.audience || 'general audience'}. Art direction: clean premium campaign photography, clear focal point, natural lighting, generous negative space, no text, no logos, no watermark. Square 1:1 composition.`,
    size: '1024x1024',
    quality: 'medium',
    output_format: 'png',
  });
  const encoded = data.data?.[0]?.b64_json;
  if (!encoded) throw new AppError('AI image generation returned no image.', 502, 'AI_IMAGE_EMPTY');
  const folder = path.resolve(process.cwd(), env.UPLOAD_DIR);
  await fs.mkdir(folder, { recursive: true });
  const filename = `ostras-${Date.now()}-${crypto.randomUUID()}.png`;
  await fs.writeFile(path.join(folder, filename), Buffer.from(encoded, 'base64'));
  return `${env.API_PUBLIC_URL}/uploads/${filename}`;
}
