import { Schema, model } from 'mongoose';

/**
 * One row per issued refresh token. Rotation marks the old row `usedAt`;
 * presenting a used token again is treated as theft (reuse detection).
 */
const refreshSessionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jti: { type: String, required: true, unique: true },
    family: { type: String, required: true },
    usedAt: { type: Date, default: null },
    userAgent: { type: String, maxlength: 300 },
    ip: { type: String, maxlength: 64 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshSession = model('RefreshSession', refreshSessionSchema);
