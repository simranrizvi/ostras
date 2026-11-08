import mongoose from 'mongoose';
import { requestContext, protectOrigin } from './middleware/security.js';
import fs from 'node:fs';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env, uploadDirectory } from './config/env.js';
import authRoutes from './modules/auth/auth.routes.js';
import brandRoutes from './modules/brands/brand.routes.js';
import postRoutes from './modules/posts/posts.routes.js';
import dashboardRoutes from './modules/dashboard/dashboard.routes.js';
import integrationRoutes from './modules/integrations/integrations.routes.js';
import { errorHandler, notFound } from './utils/errors.js';

const app = express();
const uploadFolder = uploadDirectory;
fs.mkdirSync(uploadFolder, { recursive: true });

app.disable('x-powered-by');
app.set('trust proxy', env.TRUST_PROXY_HOPS);
app.use(requestContext);
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use('/api', protectOrigin);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
// Do not log OAuth codes/state or other sensitive query parameters.
morgan.token('safe-path', (req) => req.path);
morgan.token('request-id', (req) => req.id);
app.use(morgan(':method :safe-path :status :response-time ms requestId=:request-id'));
app.use(
  '/uploads',
  express.static(uploadFolder, { maxAge: '1d', immutable: true, dotfiles: 'deny' }),
);

app.get('/api/health', (_req, res) =>
  res.json({
    status: 'ok',
    service: 'social-flow-api',
    requestId: _req.id,
    timestamp: new Date().toISOString(),
  }),
);
app.get('/api/ready', (_req, res) =>
  res
    .status(mongoose.connection.readyState === 1 ? 200 : 503)
    .json({ status: mongoose.connection.readyState === 1 ? 'ready' : 'unavailable' }),
);
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  authRoutes,
);
app.use('/api/integrations', integrationRoutes);
app.use('/api/brand', brandRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use(
  '/api/posts',
  rateLimit({ windowMs: 60 * 1000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false }),
  postRoutes,
);
app.use(notFound);
app.use(errorHandler);

export default app;
