import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import authRoutes from './routes/auth.js';
import brandRoutes from './routes/brand.js';
import postRoutes from './routes/posts.js';
import dashboardRoutes from './routes/dashboard.js';
import integrationRoutes from './routes/integrations.js';
import { errorHandler, notFound } from './utils/errors.js';

const app = express();
const uploadFolder = path.resolve(process.cwd(), env.UPLOAD_DIR);
fs.mkdirSync(uploadFolder, { recursive: true });

app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
app.use('/uploads', express.static(uploadFolder, { maxAge: '1d', immutable: true, dotfiles: 'deny' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'ostras-api', requestId: crypto.randomUUID(), timestamp: new Date().toISOString() }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 40, standardHeaders: 'draft-8', legacyHeaders: false }), authRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/brand', brandRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/posts', rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }), postRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
