import { Brand } from '../brands/Brand.model.js';
import { ContentPost } from './ContentPost.model.js';
import { generateSocialCopy, generateSocialImage } from './ai.service.js';
import { notifyN8n } from '../integrations/n8n.service.js';
import { AppError } from '../../utils/errors.js';
import { listSchema, postSchema } from './posts.schemas.js';

const scoped = (req) => ({ _id: req.params.postId, brandId: req.user.brandId });
const editable = { $in: ['draft', 'failed', 'scheduled'] };

export async function listPosts(req, res) {
  const { page, limit, status, search, from, to } = listSchema.parse(req.query);
  const filter = { brandId: req.user.brandId };
  if (status) filter.status = status;
  if (search) {
    const literal = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$or = ['title', 'topic', 'caption'].map((field) => ({
      [field]: { $regex: literal, $options: 'i' },
    }));
  }
  if (from || to)
    filter.scheduledAt = {
      ...(from ? { $gte: new Date(from) } : {}),
      ...(to ? { $lt: new Date(to) } : {}),
    };
  const [posts, total] = await Promise.all([
    ContentPost.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ContentPost.countDocuments(filter),
  ]);
  res.json({ posts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}
export async function getPost(req, res) {
  const post = await ContentPost.findOne(scoped(req));
  if (!post) throw new AppError('Post not found.', 404, 'POST_NOT_FOUND');
  res.json({ post });
}
export async function createPost(req, res) {
  const post = await ContentPost.create({
    brandId: req.user.brandId,
    createdBy: req.user._id,
    ...req.validatedBody,
  });
  notifyN8n('post.created', {
    brandId: String(post.brandId),
    postId: String(post._id),
    status: post.status,
  });
  res.status(201).json({ post });
}
export async function generatePost(req, res) {
  const brand = await Brand.findById(req.user.brandId);
  if (!brand) throw new AppError('Workspace not found.', 404, 'WORKSPACE_NOT_FOUND');
  const { topic, withImage } = req.validatedBody;
  const copy = await generateSocialCopy({ brand, topic, platform: 'Instagram' });
  const imageUrl = withImage ? await generateSocialImage({ brand, topic }) : '';
  const content = postSchema.parse({ ...copy, topic, imageUrl });
  const post = await ContentPost.create({
    ...content,
    brandId: brand._id,
    createdBy: req.user._id,
    generation: { provider: 'openai', model: copy.model, promptVersion: 'v2' },
  });
  notifyN8n('post.created', {
    brandId: String(brand._id),
    postId: String(post._id),
    status: post.status,
  });
  res.status(201).json({ post });
}
export async function updatePost(req, res) {
  const existing = await ContentPost.findOne(scoped(req));
  if (!existing) throw new AppError('Post not found.', 404, 'POST_NOT_FOUND');
  const content = postSchema.parse({ ...existing.toObject(), ...req.body });
  // Compare the version as well as state so an edit cannot overwrite a concurrent edit or publish.
  const post = await ContentPost.findOneAndUpdate(
    { ...scoped(req), status: editable, __v: existing.__v },
    {
      $set: { ...content, remoteContainerId: '' },
      $inc: { __v: 1 },
    },
    { new: true, runValidators: true },
  );
  if (!post)
    throw new AppError('Post changed or is locked. Reload before editing.', 409, 'POST_CONFLICT');
  res.json({ post });
}
export async function schedulePost(req, res) {
  const post = await ContentPost.findOneAndUpdate(
    { ...scoped(req), status: editable },
    {
      $set: {
        scheduledAt: new Date(req.validatedBody.scheduledAt),
        status: 'scheduled',
        errorMessage: '',
      },
      $inc: { __v: 1 },
    },
    { new: true, runValidators: true },
  );
  if (!post) throw new AppError('This post cannot be scheduled.', 409, 'POST_NOT_SCHEDULABLE');
  notifyN8n('post.scheduled', {
    brandId: String(post.brandId),
    postId: String(post._id),
    scheduledAt: post.scheduledAt,
  });
  res.json({ post });
}
export async function cancelSchedule(req, res) {
  const post = await ContentPost.findOneAndUpdate(
    { ...scoped(req), status: 'scheduled' },
    {
      $set: { status: 'draft', scheduledAt: null },
      $inc: { __v: 1 },
    },
    { new: true },
  );
  if (!post)
    throw new AppError(
      'Only scheduled posts can be returned to drafts.',
      409,
      'POST_NOT_SCHEDULED',
    );
  notifyN8n('post.unscheduled', { brandId: String(post.brandId), postId: String(post._id) });
  res.json({ post });
}
export async function duplicatePost(req, res) {
  const source = await ContentPost.findOne(scoped(req));
  if (!source) throw new AppError('Post not found.', 404, 'POST_NOT_FOUND');
  req.validatedBody = postSchema.parse(source.toObject());
  req.validatedBody.title = `${source.title || 'Untitled'} (copy)`.slice(0, 140);
  return createPost(req, res);
}
export async function publishPost(req, res) {
  const post = await ContentPost.findOneAndUpdate(
    { ...scoped(req), status: { $in: ['draft', 'failed'] } },
    {
      $set: { status: 'scheduled', scheduledAt: new Date(), errorMessage: '' },
      $inc: { __v: 1 },
    },
    { new: true },
  );
  if (!post)
    throw new AppError(
      'Return scheduled posts to drafts before publishing now.',
      409,
      'POST_NOT_PUBLISHABLE',
    );
  notifyN8n('post.scheduled', {
    brandId: String(post.brandId),
    postId: String(post._id),
    scheduledAt: post.scheduledAt,
  });
  res
    .status(202)
    .json({ post, message: 'Queued for publishing. Check the library for the result.' });
}
export async function deletePost(req, res) {
  const result = await ContentPost.deleteOne({
    ...scoped(req),
    status: { $in: ['draft', 'failed'] },
  });
  if (!result.deletedCount)
    throw new AppError('Only draft or failed posts can be deleted.', 409, 'POST_NOT_DELETABLE');
  res.status(204).end();
}
