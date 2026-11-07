import mongoose from 'mongoose';

const contentPostSchema = new mongoose.Schema({
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  platform: { type: String, enum: ['instagram'], default: 'instagram' },
  title: { type: String, trim: true, maxlength: 140, default: '' },
  topic: { type: String, trim: true, maxlength: 200, default: '' },
  caption: { type: String, required: true, maxlength: 2200 },
  hashtags: { type: [String], default: [] },
  imageUrl: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'scheduled', 'processing', 'published', 'failed'], default: 'draft', index: true },
  scheduledAt: { type: Date, default: null, index: true },
  publishedAt: { type: Date, default: null },
  remoteMediaId: { type: String, default: '' },
  errorMessage: { type: String, default: '' },
  generation: { provider: String, model: String, promptVersion: String },
}, { timestamps: true });

contentPostSchema.index({ status: 1, scheduledAt: 1 });
contentPostSchema.index({ brandId: 1, scheduledAt: 1 }, { unique: true, partialFilterExpression: { scheduledAt: { $type: 'date' } } });
export const ContentPost = mongoose.model('ContentPost', contentPostSchema);
