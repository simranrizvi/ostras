import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['owner', 'admin', 'editor'], default: 'owner' },
  brandId: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand', index: true },
}, { timestamps: true });

export const User = mongoose.model('User', userSchema);
