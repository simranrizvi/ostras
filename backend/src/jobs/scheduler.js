import { Brand } from '../modules/brands/Brand.model.js';
import { ContentPost } from '../modules/posts/ContentPost.model.js';
import { SocialAccount } from '../modules/integrations/SocialAccount.model.js';
import { generateSocialCopy, generateSocialImage } from '../modules/posts/ai.service.js';
import { notifyN8n } from '../modules/integrations/n8n.service.js';
import { claimPost, publishClaimedPost } from '../modules/posts/publishing.service.js';
import { postSchema } from '../modules/posts/posts.schemas.js';
import { upcomingSlots } from './schedule-time.js';

let timer;
let inFlight;
let generationInFlight;
let stopping = false;

async function fillAutomationQueue() {
  const now = new Date();
  const brands = await Brand.find({
    autoPublish: true,
    topics: { $exists: true, $ne: [] },
    $or: [
      { automationLastQueuedAt: null },
      { automationLastQueuedAt: { $lt: new Date(now - 300_000) } },
    ],
  }).limit(25);
  for (const candidate of brands) {
    if (stopping) break;
    // A durable lease stops multiple workers generating the same brand queue.
    const brand = await Brand.findOneAndUpdate(
      {
        _id: candidate._id,
        autoPublish: true,
        $or: [{ automationLeaseUntil: null }, { automationLeaseUntil: { $lte: now } }],
      },
      {
        $set: {
          automationLeaseUntil: new Date(Date.now() + 15 * 60_000),
          automationLastQueuedAt: now,
        },
      },
      { new: true },
    );
    if (!brand) continue;
    try {
      if (
        !(await SocialAccount.exists({
          _id: brand.instagramAccountId,
          brandId: brand._id,
          status: 'connected',
        }))
      )
        continue;
      const pending = await ContentPost.countDocuments({
        brandId: brand._id,
        status: 'scheduled',
        scheduledAt: { $gte: now },
      });
      let created = 0;
      for (const scheduledAt of upcomingSlots(brand, now)) {
        if (stopping || created >= Math.max(0, 3 - pending)) break;
        if (await ContentPost.exists({ brandId: brand._id, scheduledAt })) continue;
        const topic = brand.topics[(pending + created) % brand.topics.length];
        const copy = await generateSocialCopy({ brand, topic, platform: 'Instagram' });
        const imageUrl = await generateSocialImage({ brand, topic });
        // Re-check owner intent after slow provider calls (disconnect / automation off).
        if (
          !(await Brand.exists({
            _id: brand._id,
            autoPublish: true,
            instagramAccountId: brand.instagramAccountId,
          }))
        )
          break;
        const content = postSchema.parse({ ...copy, topic, imageUrl });
        const post = await ContentPost.create({
          ...content,
          brandId: brand._id,
          createdBy: brand.ownerId,
          status: 'scheduled',
          scheduledAt,
          generation: { provider: 'openai', model: copy.model, promptVersion: 'auto-v2' },
        });
        notifyN8n('post.scheduled', {
          brandId: String(brand._id),
          postId: String(post._id),
          scheduledAt,
        });
        created += 1;
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          level: 'error',
          job: 'fill-queue',
          brandId: brand._id,
          message: error.message,
        }),
      );
    } finally {
      await Brand.updateOne({ _id: brand._id }, { $set: { automationLeaseUntil: null } });
    }
  }
}
async function tick() {
  // An interrupted publication is ambiguous: require human review rather than duplicate it.
  await ContentPost.updateMany(
    {
      status: 'processing',
      $or: [
        { processingStartedAt: { $lt: new Date(Date.now() - 15 * 60_000) } },
        { processingStartedAt: null, updatedAt: { $lt: new Date(Date.now() - 15 * 60_000) } },
      ],
    },
    {
      $set: {
        status: 'failed',
        processingStartedAt: null,
        errorMessage:
          'Publishing was interrupted. Check Instagram before retrying to avoid a duplicate.',
      },
    },
  );
  for (let i = 0; i < 10 && !stopping; i += 1) {
    const post = await claimPost({ status: 'scheduled', scheduledAt: { $lte: new Date() } });
    if (!post) break;
    try {
      await publishClaimedPost(post);
    } catch (error) {
      console.error(JSON.stringify({ job: 'publish', postId: post._id, message: error.message }));
    }
  }
}
export function runSchedulerTick() {
  if (inFlight) return inFlight;
  inFlight = tick()
    .catch((error) => console.error('Scheduler error:', error.message))
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
export function runGenerationTick() {
  if (generationInFlight) return generationInFlight;
  generationInFlight = fillAutomationQueue()
    .catch((error) => console.error('Generation error:', error.message))
    .finally(() => {
      generationInFlight = null;
    });
  return generationInFlight;
}
export function startScheduler() {
  if (timer) return;
  stopping = false;
  const run = () => {
    void runSchedulerTick();
    void runGenerationTick();
  };
  timer = setInterval(run, 30_000);
  run();
}
export async function stopScheduler() {
  stopping = true;
  clearInterval(timer);
  timer = undefined;
  await Promise.all([inFlight, generationInFlight]);
}
