import { Brand } from '../brands/Brand.model.js';
import { ContentPost } from './ContentPost.model.js';
import { SocialAccount } from '../integrations/SocialAccount.model.js';
import { publishInstagramPost } from '../integrations/instagram.service.js';
import { notifyN8n } from '../integrations/n8n.service.js';
import { AppError } from '../../utils/errors.js';

// Workers claim a queued post atomically before doing any provider work.
export async function publishClaimedPost(post) {
  try {
    const brand = await Brand.findById(post.brandId);
    const account = brand?.instagramAccountId
      ? await SocialAccount.findOne({
          _id: brand.instagramAccountId,
          brandId: post.brandId,
          status: 'connected',
        }).select('+encryptedAccessToken')
      : null;
    if (!account)
      throw new AppError('Connect an Instagram account first.', 409, 'INSTAGRAM_NOT_CONNECTED');
    const remoteMediaId = await publishInstagramPost({ post, account });
    const published = await ContentPost.findOneAndUpdate(
      { _id: post._id, status: 'processing' },
      {
        $set: {
          remoteMediaId,
          status: 'published',
          publishedAt: new Date(),
          processingStartedAt: null,
          errorMessage: '',
        },
      },
      { new: true },
    );
    notifyN8n('post.published', {
      brandId: String(post.brandId),
      postId: String(post._id),
      remoteMediaId,
    });
    return published;
  } catch (error) {
    await ContentPost.updateOne(
      { _id: post._id, status: 'processing' },
      {
        $set: {
          status: 'failed',
          processingStartedAt: null,
          errorMessage: error.message.slice(0, 400),
        },
      },
    );
    notifyN8n('post.failed', {
      brandId: String(post.brandId),
      postId: String(post._id),
      error: error.message.slice(0, 400),
    });
    throw error;
  }
}
export function claimPost(filter) {
  return ContentPost.findOneAndUpdate(
    filter,
    {
      $set: { status: 'processing', processingStartedAt: new Date(), errorMessage: '' },
      $inc: { publishAttempts: 1 },
    },
    { new: true, sort: { scheduledAt: 1 } },
  );
}
