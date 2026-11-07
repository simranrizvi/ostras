import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { Brand } from '../models/Brand.js';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validators.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';

const router = Router();
const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(10).max(72),
  brandName: z.string().trim().min(2).max(100),
  niche: z.string().trim().min(2).max(120),
});
const loginSchema = z.object({ email: z.email().transform((value) => value.toLowerCase()), password: z.string().min(1).max(72) });

function issueSession(res, user) {
  const token = jwt.sign({ sub: user._id.toString(), role: user.role }, env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie('ostras_session', token, {
    httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

router.post('/register', validate(registerSchema), asyncHandler(async (req, res) => {
  const { name, email, password, brandName, niche } = req.validatedBody;
  if (await User.exists({ email })) throw new AppError('An account with this email already exists.', 409, 'EMAIL_EXISTS');
  const brand = await Brand.create({ name: brandName, niche });
  try {
    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12), brandId: brand._id });
    await Brand.updateOne({ _id: brand._id }, { $set: { ownerId: user._id } });
    issueSession(res, user);
    res.status(201).json({ user: { id: user._id, name: user.name, email: user.email }, brand });
  } catch (error) {
    await Brand.deleteOne({ _id: brand._id });
    throw error;
  }
}));

router.post('/login', validate(loginSchema), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.validatedBody.email }).select('+passwordHash');
  if (!user || !(await bcrypt.compare(req.validatedBody.password, user.passwordHash))) {
    throw new AppError('Email or password is incorrect.', 401, 'INVALID_CREDENTIALS');
  }
  issueSession(res, user);
  res.json({ user: { id: user._id, name: user.name, email: user.email } });
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const brand = req.user.brandId ? await Brand.findById(req.user.brandId) : null;
  res.json({ user: { id: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role }, brand });
}));

router.post('/logout', (_req, res) => {
  res.clearCookie('ostras_session', { httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
  res.status(204).end();
});

export default router;
