import { Schema, model } from 'mongoose';

/** One row per (short, user) like. Unique index makes like/unlike idempotent. */
const shortLikeSchema = new Schema(
  {
    short: { type: Schema.Types.ObjectId, ref: 'Short', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
shortLikeSchema.index({ short: 1, user: 1 }, { unique: true });
shortLikeSchema.index({ user: 1, short: 1 });

export const ShortLike = model('ShortLike', shortLikeSchema);

/** A customer's saved shorts (Account → Saved). */
const savedShortSchema = new Schema(
  {
    short: { type: Schema.Types.ObjectId, ref: 'Short', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
savedShortSchema.index({ short: 1, user: 1 }, { unique: true });
savedShortSchema.index({ user: 1, createdAt: -1 });

export const SavedShort = model('SavedShort', savedShortSchema);
