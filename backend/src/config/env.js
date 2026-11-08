import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../');
dotenv.config({ path: path.join(repositoryRoot, '.env') });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/social-flow'),
  JWT_SECRET: z.string().min(32).default('development-only-change-this-secret-please'),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_TEXT_MODEL: z.string().default('gpt-4.1-mini'),
  OPENAI_IMAGE_MODEL: z.string().default('gpt-image-1'),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_REDIRECT_URI: z
    .string()
    .url()
    .default('http://localhost:4000/api/integrations/instagram/callback'),
  META_GRAPH_VERSION: z.string().default('v27.0'),
  UPLOAD_DIR: z.string().default('./uploads'),
  N8N_WEBHOOK_URL: z.union([z.string().url(), z.literal('')]).optional(),
  N8N_WEBHOOK_SECRET: z.union([z.string().min(16), z.literal('')]).optional(),
});

export const env = schema.parse(process.env);
if (env.N8N_WEBHOOK_URL && !env.N8N_WEBHOOK_SECRET) {
  throw new Error('Set N8N_WEBHOOK_SECRET when N8N_WEBHOOK_URL is configured.');
}
if (
  env.NODE_ENV === 'production' &&
  env.JWT_SECRET === 'development-only-change-this-secret-please'
) {
  throw new Error('Set a private JWT_SECRET before starting in production.');
}

if (
  env.NODE_ENV === 'production' &&
  (!env.WEB_ORIGIN.startsWith('https://') || !env.API_PUBLIC_URL.startsWith('https://'))
)
  throw new Error('Production origins must use HTTPS.');
if (env.META_APP_ID && !/^[a-f\d]{64}$/i.test(env.TOKEN_ENCRYPTION_KEY || ''))
  throw new Error('Meta integration requires a 32-byte TOKEN_ENCRYPTION_KEY.');

export const uploadDirectory = path.resolve(repositoryRoot, 'backend', env.UPLOAD_DIR);
