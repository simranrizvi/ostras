import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/errors.js';
import { asyncHandler } from '../utils/async-handler.js';

export const requireAuth = asyncHandler(async (req, _res, next) => {
  const token = req.cookies.ostras_session || req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) throw new AppError('Sign in to continue.', 401, 'UNAUTHORIZED');
  let claims;
  try { claims = jwt.verify(token, env.JWT_SECRET); }
  catch { throw new AppError('Your session has expired. Sign in again.', 401, 'SESSION_EXPIRED'); }
  const user = await User.findById(claims.sub);
  if (!user) throw new AppError('Account no longer exists.', 401, 'UNAUTHORIZED');
  req.user = user;
  next();
});

export function requireBrand(req, _res, next) {
  if (!req.user.brandId) return next(new AppError('Complete your workspace setup first.', 409, 'WORKSPACE_REQUIRED'));
  next();
}
