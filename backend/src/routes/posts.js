import { Router } from 'express';
import { z } from 'zod';
import { Brand } from '../models/Brand.js';
import { ContentPost } from '../models/ContentPost.js';
import { SocialAccount } from '../models/SocialAccount.js';
import { requireAuth, requireBrand } from '../middleware/auth.js';
import { validate } from '../middleware/validators.js';
import { generateSocialCopy, generateSocialImage } from '../services/openai.js';
import { publishInstagramPost } from '../services/instagram.js';
import { asyncHandler } from '../utils/async-handler.js';
import { AppError } from '../utils/errors.js';
import { notifyN8n } from '../services/n8n.js';

const router = Router();
router.use(requireAuth, requireBrand);

const createSchema = z.object({
  title: z.string().trim().max(140).optional(),
  topic: z.string().trim().min(2).max(200).optional(),
  caption: z.string().trim().min(2).max(2200),
  hashtags: z.array(z.string().trim().max(80)).max(20).default([]),
  imageUrl: z.url().optional().or(z.literal('')),
});
const generateSchema = z.object({ topic: z.string().trim().min(3).max(200), withImage: z.boolean().default(false) });
const scheduleSchema = z.object({ scheduledAt: z.iso.datetime() });

router.get('/', asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const filter = { brandId: req.user.brandId };
  if (req.query.status && ['draft', 'scheduled', 'processing', 'published', 'failed'].includes(req.query.status)) filter.status = req.query.status;
  const [posts, total] = await Promise.all([
    ContentPost.find(filter).sort({ scheduledAt: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    ContentPost.countDocuments(filter),
  ]);
  res.json({ posts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

router.post('/generate', validate(generateSchema), asyncHandler(async (req, res) => {
  const brand = await Brand.findById(req.user.brandId);
  const generated = await generateSocialCopy({ brand, topic: req.validatedBody.topic, platform: 'Instagram' });
  const imageUrl = req.validatedBody.withImage ? await generateSocialImage({ brand, topic: req.validatedBody.topic }) : '';
  const post = await ContentPost.create({
    brandId: brand._id, createdBy: req.user._id, topic: req.validatedBody.topic,
    title: generated.title, caption: generated.caption, hashtags: generated.hashtags,
    imageUrl, generation: { provider: 'openai', model: generated.model, promptVersion: 'v1' },
  });
  notifyN8n('post.created', { brandId: String(brand._id), postId: String(post._id), topic: post.topic, status: post.status });
  res.status(201).json({ post });
}));

router.post('/', validate(createSchema), asyncHandler(async (req, res) => {
  const post = await ContentPost.create({ brandId: req.user.brandId, createdBy: req.user._id, ...req.validatedBody });
  notifyN8n('post.created', { brandId: String(req.user.brandId), postId: String(post._id), topic: post.topic, status: post.status });
  res.status(201).json({ post });
}));

router.patch('/:postId', asyncHandler(async (req, res) => {
  const body = createSchema.partial().extend({ scheduledAt: z.iso.datetime().nullable().optional() }).parse(req.body);
  const post = await ContentPost.findOne({ _id: req.params.postId, brandId: req.user.brandId });
  if (!post) throw new AppError('Post not found.', 404, 'POST_NOT_FOUND');
  if (post.status === 'processing' || post.status === 'published') throw new AppError('This post can no longer be edited.', 409, 'POST_LOCKED');
  Object.assign(post, body);
  if ('scheduledAt' in body) post.status = body.scheduledAt ? 'scheduled' : 'draft';
  await post.save();
  res.json({ post });
}));

router.post('/:postId/schedule', validate(scheduleSchema), asyncHandler(async (req, res) => {
  const scheduledAt = new Date(req.validatedBody.scheduledAt);
  if (scheduledAt <= new Date()) throw new AppError('Choose a time in the future.', 422, 'INVALID_SCHEDULE_TIME');
  const post = await ContentPost.findOneAndUpdate(
    { _id: req.params.postId, brandId: req.user.brandId, status: { $in: ['draft', 'failed', 'scheduled'] } },
    { $set: { scheduledAt, status: 'scheduled', errorMessage: '' } },
    { new: true, runValidators: true },
  );
  if (!post) throw new AppError('This post cannot be scheduled.', 409, 'POST_NOT_SCHEDULABLE');
  notifyN8n('post.scheduled', { brandId: String(req.user.brandId), postId: String(post._id), scheduledAt: post.scheduledAt });
  res.json({ post });
}));

router.post('/:postId/publish', asyncHandler(async (req, res) => {
  const post = await ContentPost.findOneAndUpdate(
    { _id: req.params.postId, brandId: req.user.brandId, status: { $in: ['draft', 'failed'] } },
    { $set: { status: 'processing', errorMessage: '' } },
    { new: true },
  );
  if (!post) throw new AppError('This post cannot be published now.', 409, 'POST_NOT_PUBLISHABLE');
  try {
    const brand = await Brand.findById(req.user.brandId);
    const account = brand.instagramAccountId ? await SocialAccount.findById(brand.instagramAccountId).select('+encryptedAccessToken') : null;
    if (!account) throw new AppError('Connect an Instagram account first.', 409, 'INSTAGRAM_NOT_CONNECTED');
    post.remoteMediaId = await publishInstagramPost({ post, account });
    post.status = 'published';
    post.publishedAt = new Date();
    await post.save();
    notifyN8n('post.published', { brandId: String(req.user.brandId), postId: String(post._id), publishedAt: post.publishedAt, remoteMediaId: post.remoteMediaId });
    res.json({ post });
  } catch (error) {
    post.status = 'failed';
    post.errorMessage = error.message.slice(0, 400);
    await post.save();
    notifyN8n('post.failed', { brandId: String(req.user.brandId), postId: String(post._id), error: post.errorMessage });
    throw error;
  }
}));

router.delete('/:postId', asyncHandler(async (req, res) => {
  const result = await ContentPost.deleteOne({ _id: req.params.postId, brandId: req.user.brandId, status: { $in: ['draft', 'failed'] } });
  if (!result.deletedCount) throw new AppError('Only draft or failed posts can be deleted.', 409, 'POST_NOT_DELETABLE');
  res.status(204).end();
}));

export default router;
