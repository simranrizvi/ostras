import mongoose from 'mongoose';

const brandSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    niche: { type: String, required: true, trim: true, maxlength: 120 },
    audience: { type: String, default: '', maxlength: 500 },
    voice: {
      type: String,
      enum: ['Friendly', 'Expert', 'Bold', 'Minimal', 'Inspirational'],
      default: 'Friendly',
    },
    goals: { type: [String], default: ['Grow brand awareness'] },
    topics: { type: [String], default: [] },
    postsPerWeek: { type: Number, min: 1, max: 7, default: 5 },
    autoPublish: { type: Boolean, default: false },
    autoGenerateImages: { type: Boolean, default: true },
    automationLeaseUntil: { type: Date, default: null },
    automationLastQueuedAt: { type: Date, default: null },
    timezone: { type: String, default: 'Asia/Karachi' },
    preferredTimes: { type: [String], default: ['10:00', '19:00'] },
    instagramAccountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SocialAccount',
      default: null,
    },
  },
  { timestamps: true },
);

export const Brand = mongoose.model('Brand', brandSchema);
