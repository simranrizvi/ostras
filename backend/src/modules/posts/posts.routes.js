import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireAuth, requireBrand } from '../../middleware/auth.js';
import { validate, validateId } from '../../middleware/validators.js';
import { asyncHandler } from '../../utils/async-handler.js';
import { postSchema, generateSchema, scheduleSchema } from './posts.schemas.js';
import * as controller from './posts.controller.js';

const router = Router();
router.use(requireAuth, requireBrand);
router.param('postId', validateId);
router.get('/', asyncHandler(controller.listPosts));
router.post(
  '/generate',
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 20,
    keyGenerator: (req) => String(req.user._id),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
  validate(generateSchema),
  asyncHandler(controller.generatePost),
);
router.post('/', validate(postSchema), asyncHandler(controller.createPost));
router.get('/:postId', asyncHandler(controller.getPost));
router.patch('/:postId', asyncHandler(controller.updatePost));
router.post('/:postId/schedule', validate(scheduleSchema), asyncHandler(controller.schedulePost));
router.post('/:postId/unschedule', asyncHandler(controller.cancelSchedule));
router.post('/:postId/duplicate', asyncHandler(controller.duplicatePost));
router.post('/:postId/publish', asyncHandler(controller.publishPost));
router.delete('/:postId', asyncHandler(controller.deletePost));
export default router;
