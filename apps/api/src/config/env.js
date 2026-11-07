import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config({ path: '../../.env' });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  API_PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  MONGODB_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/ostras'),
  JWT_SECRET: z.string().min(32).default('development-only-change-this-secret-please'),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_TEXT_MODEL: z.string().default('gpt-4.1-mini'),
  OPENAI_IMAGE_MODEL: z.string().default('gpt-image-1'),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_REDIRECT_URI: z.string().url().default('http://localhost:4000/api/integrations/instagram/callback'),
  META_GRAPH_VERSION: z.string().default('v27.0'),
  UPLOAD_DIR: z.string().default('./uploads'),
});

export const env = schema.parse(process.env);
if (env.NODE_ENV === 'production' && env.JWT_SECRET === 'development-only-change-this-secret-please') {
  throw new Error('Set a private JWT_SECRET before starting in production.');
}
