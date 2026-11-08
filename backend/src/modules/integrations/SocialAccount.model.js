import mongoose from 'mongoose';

const socialAccountSchema = new mongoose.Schema(
  {
    brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', required: true, index: true },
    platform: { type: String, enum: ['instagram'], required: true },
    accountId: { type: String, required: true },
    username: { type: String, required: true },
    encryptedAccessToken: { type: String, required: true, select: false },
    tokenExpiresAt: { type: Date },
    connectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['connected', 'expired', 'revoked'], default: 'connected' },
  },
  { timestamps: true },
);

socialAccountSchema.index({ brandId: 1, platform: 1 }, { unique: true });
export const SocialAccount = mongoose.model('SocialAccount', socialAccountSchema);
