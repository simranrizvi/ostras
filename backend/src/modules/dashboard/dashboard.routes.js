import { Router } from 'express';
import { Brand } from '../brands/Brand.model.js';
import { ContentPost } from '../posts/ContentPost.model.js';
import { SocialAccount } from '../integrations/SocialAccount.model.js';
import { requireAuth, requireBrand } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/async-handler.js';

const router = Router();
router.get(
  '/',
  requireAuth,
  requireBrand,
  asyncHandler(async (req, res) => {
    const brandId = req.user.brandId;
    const now = new Date();
    const [brand, counts, upcoming, recent, instagram] = await Promise.all([
      Brand.findById(brandId),
      ContentPost.aggregate([
        { $match: { brandId } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      ContentPost.find({ brandId, status: 'scheduled', scheduledAt: { $gte: now } })
        .sort({ scheduledAt: 1 })
        .limit(5)
        .lean(),
      ContentPost.find({ brandId }).sort({ createdAt: -1 }).limit(6).lean(),
      SocialAccount.findOne({ brandId, platform: 'instagram' }).select(
        'username status tokenExpiresAt',
      ),
    ]);
    const stats = Object.fromEntries(counts.map(({ _id, count }) => [_id, count]));
    res.json({
      brand,
      instagram,
      stats: {
        total: Object.values(stats).reduce((sum, value) => sum + value, 0),
        drafts: stats.draft || 0,
        scheduled: stats.scheduled || 0,
        published: stats.published || 0,
        failed: stats.failed || 0,
      },
      upcoming,
      recent,
    });
  }),
);

export default router;
