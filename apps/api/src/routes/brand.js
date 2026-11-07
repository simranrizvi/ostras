import { Router } from 'express';
import { z } from 'zod';
import { Brand } from '../models/Brand.js';
import { SocialAccount } from '../models/SocialAccount.js';
import { requireAuth, requireBrand } from '../middleware/auth.js';
import { validate } from '../middleware/validators.js';
import { asyncHandler } from '../utils/async-handler.js';

const router = Router();
const updateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  niche: z.string().trim().min(2).max(120),
  audience: z.string().trim().max(500).optional(),
  voice: z.enum(['Friendly', 'Expert', 'Bold', 'Minimal', 'Inspirational']),
  goals: z.array(z.string().trim().min(2).max(80)).max(5).default([]),
  topics: z.array(z.string().trim().min(2).max(120)).max(20).default([]),
  postsPerWeek: z.coerce.number().int().min(1).max(21),
  autoPublish: z.boolean(),
  autoGenerateImages: z.boolean(),
  timezone: z.string().min(3).max(60),
  preferredTimes: z.array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)).min(1).max(6),
});

router.get('/', requireAuth, requireBrand, asyncHandler(async (req, res) => {
  const [brand, instagram] = await Promise.all([
    Brand.findById(req.user.brandId),
    SocialAccount.findOne({ brandId: req.user.brandId, platform: 'instagram' }).select('username status tokenExpiresAt'),
  ]);
  res.json({ brand, instagram });
}));

router.patch('/', requireAuth, requireBrand, validate(updateSchema), asyncHandler(async (req, res) => {
  if (req.validatedBody.autoPublish && req.validatedBody.topics.length === 0) {
    return res.status(422).json({ error: { code: 'TOPICS_REQUIRED', message: 'Add at least one topic before turning on automatic publishing.' } });
  }
  if (req.validatedBody.autoPublish && !req.validatedBody.autoGenerateImages) {
    return res.status(422).json({ error: { code: 'INSTAGRAM_IMAGE_REQUIRED', message: 'Instagram automatic publishing needs an image for every post. Keep image generation on.' } });
  }
  if (req.validatedBody.autoPublish && !await SocialAccount.exists({ brandId: req.user.brandId, platform: 'instagram', status: 'connected' })) {
    return res.status(409).json({ error: { code: 'INSTAGRAM_NOT_CONNECTED', message: 'Connect Instagram before turning on automatic publishing.' } });
  }
  const brand = await Brand.findByIdAndUpdate(req.user.brandId, { $set: req.validatedBody }, { new: true, runValidators: true });
  res.json({ brand });
}));

export default router;
