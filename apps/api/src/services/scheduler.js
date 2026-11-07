import { Brand } from '../models/Brand.js';
import { ContentPost } from '../models/ContentPost.js';
import { SocialAccount } from '../models/SocialAccount.js';
import { publishInstagramPost } from './instagram.js';
import { generateSocialCopy, generateSocialImage } from './openai.js';

let timer;
let busy = false;

function localWeekday(date, timezone) {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' }).format(date);
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(day);
}

function localDateTime(base, time, timezone) {
  const [hours, minutes] = time.split(':').map(Number);
  const target = new Date(base);
  const y = Number(new Intl.DateTimeFormat('en', { timeZone: timezone, year: 'numeric' }).format(target));
  const m = Number(new Intl.DateTimeFormat('en', { timeZone: timezone, month: '2-digit' }).format(target));
  const d = Number(new Intl.DateTimeFormat('en', { timeZone: timezone, day: '2-digit' }).format(target));
  let guess = new Date(Date.UTC(y, m - 1, d, hours, minutes));
  for (let i = 0; i < 3; i += 1) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(guess);
    const actualHour = Number(parts.find((part) => part.type === 'hour').value);
    const actualMinute = Number(parts.find((part) => part.type === 'minute').value);
    guess = new Date(guess.getTime() + ((hours * 60 + minutes) - (actualHour * 60 + actualMinute)) * 60_000);
  }
  return guess;
}

async function fillAutomationQueue() {
  const brands = await Brand.find({ autoPublish: true, topics: { $exists: true, $ne: [] } });
  const now = new Date();
  for (const brand of brands) {
    if (brand.automationLastQueuedAt && now.getTime() - brand.automationLastQueuedAt.getTime() < 5 * 60_000) continue;
    try {
      const account = brand.instagramAccountId
        ? await SocialAccount.findOne({ _id: brand.instagramAccountId, status: 'connected' }).select('+encryptedAccessToken')
        : null;
      if (!account) continue;
      const pending = await ContentPost.countDocuments({ brandId: brand._id, status: 'scheduled', scheduledAt: { $gte: now } });
      let created = 0;
      const days = Math.min(7, brand.postsPerWeek || 5);
      const step = 7 / days;
      for (let dayOffset = 0; dayOffset < 21 && created < Math.max(0, 3 - pending); dayOffset += 1) {
        const date = new Date(now);
        date.setUTCDate(date.getUTCDate() + dayOffset);
        const weekday = localWeekday(date, brand.timezone || 'Asia/Karachi');
        const isPublishingDay = Array.from({ length: days }, (_, index) => Math.floor(index * step)).includes(weekday);
        if (!isPublishingDay) continue;
        const time = brand.preferredTimes[created % brand.preferredTimes.length] || '10:00';
        const scheduledAt = localDateTime(date, time, brand.timezone || 'Asia/Karachi');
        if (scheduledAt <= now) continue;
        const duplicate = await ContentPost.exists({ brandId: brand._id, scheduledAt: { $gte: new Date(scheduledAt.getTime() - 60_000), $lte: new Date(scheduledAt.getTime() + 60_000) } });
        if (duplicate) continue;
        const topic = brand.topics[(pending + created) % brand.topics.length];
        const copy = await generateSocialCopy({ brand, topic, platform: 'Instagram' });
        const imageUrl = brand.autoGenerateImages ? await generateSocialImage({ brand, topic }) : '';
        await ContentPost.create({
          brandId: brand._id, createdBy: brand.ownerId, topic,
          title: copy.title, caption: copy.caption, hashtags: copy.hashtags,
          imageUrl, status: 'scheduled', scheduledAt,
          generation: { provider: 'openai', model: copy.model, promptVersion: 'auto-v1' },
        });
        created += 1;
      }
      await Brand.updateOne({ _id: brand._id }, { $set: { automationLastQueuedAt: now } });
    } catch (error) {
      await Brand.updateOne({ _id: brand._id }, { $set: { automationLastQueuedAt: now } }).catch(() => null);
      console.error(`Could not fill the automatic content queue for ${brand._id}:`, error.message);
    }
  }
}

async function processScheduledPosts() {
  if (busy) return;
  busy = true;
  try {
    await fillAutomationQueue();
    const duePosts = await ContentPost.find({ status: 'scheduled', scheduledAt: { $lte: new Date() } }).limit(10);
    for (const due of duePosts) {
      const post = await ContentPost.findOneAndUpdate(
        { _id: due._id, status: 'scheduled' },
        { $set: { status: 'processing', errorMessage: '' } },
        { new: true },
      );
      if (!post) continue;
      try {
        const brand = await Brand.findById(post.brandId);
        const account = brand?.instagramAccountId
          ? await SocialAccount.findOne({ _id: brand.instagramAccountId, status: 'connected' }).select('+encryptedAccessToken')
          : null;
        if (!brand || !account) throw new Error('Connect an Instagram account before publishing scheduled posts.');
        const remoteMediaId = await publishInstagramPost({ post, account });
        await ContentPost.updateOne({ _id: post._id }, { $set: { status: 'published', publishedAt: new Date(), remoteMediaId } });
      } catch (error) {
        await ContentPost.updateOne({ _id: post._id }, { $set: { status: 'failed', errorMessage: error.message.slice(0, 400) } });
        console.error(`Scheduled post ${post._id} failed:`, error.message);
      }
    }
  } catch (error) {
    console.error('Scheduler error:', error);
  } finally { busy = false; }
}

export function startScheduler() {
  if (timer) return;
  timer = setInterval(processScheduledPosts, 30_000);
  timer.unref?.();
  void processScheduledPosts();
}
