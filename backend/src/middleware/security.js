import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

export function requestContext(req, res, next) {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
  next();
}
// CORS alone does not stop cross-site cookie-authenticated writes.
export function protectOrigin(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.get('origin');
  if (
    (origin && origin !== env.WEB_ORIGIN) ||
    (!origin && req.get('sec-fetch-site') === 'cross-site')
  ) {
    return next(new AppError('This request origin is not allowed.', 403, 'ORIGIN_NOT_ALLOWED'));
  }
  if (
    req.headers['content-length'] &&
    Number(req.headers['content-length']) > 0 &&
    !req.is('application/json')
  ) {
    return next(
      new AppError('Use application/json for API requests.', 415, 'UNSUPPORTED_MEDIA_TYPE'),
    );
  }
  next();
}
