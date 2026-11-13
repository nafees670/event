import { Schema, model, type InferSchemaType, type Types } from 'mongoose';
import { EVENT_TYPE_VALUES, SHORT_STATUSES } from '@video-lamhe/shared';

const shortSchema = new Schema(
  {
    operator: { type: Schema.Types.ObjectId, ref: 'Operator', required: true },
    droneModel: { type: Schema.Types.ObjectId, ref: 'DroneModel', default: null },
    city: { type: Schema.Types.ObjectId, ref: 'City', required: true },
    eventType: { type: String, enum: EVENT_TYPE_VALUES, required: true },
    title: { type: String, required: true, trim: true },
    caption: { type: String, default: null },
    /** null only for seeded sample shorts (they point at Cloudinary's public demo account). */
    cloudinaryPublicId: { type: String, default: null },
    videoUrl: { type: String, required: true },
    thumbnailUrl: { type: String, required: true },
    durationSec: { type: Number, default: 0 },
    status: { type: String, enum: SHORT_STATUSES, default: 'pending' },
    rejectionReason: { type: String, default: null },
    isFeatured: { type: Boolean, default: false },
    /** Denormalised from Operator.status === 'active' so the feed needs no join. */
    operatorActive: { type: Boolean, default: true },
    /** Likes live in ShortLike (an array here would grow without bound); this is the counter. */
    likeCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    publishedAt: { type: Date, default: null },
    isSample: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// Spec indexes (Section 6) + the feed's exact query/sort.
shortSchema.index({ status: 1, createdAt: -1 });
shortSchema.index({ city: 1, eventType: 1 });
shortSchema.index({ status: 1, operatorActive: 1, createdAt: -1, _id: -1 });
shortSchema.index({ operator: 1, status: 1, createdAt: -1 });
shortSchema.index({ status: 1, isFeatured: 1, createdAt: -1 });
shortSchema.index({ droneModel: 1, status: 1 });
shortSchema.index(
  { cloudinaryPublicId: 1 },
  { unique: true, partialFilterExpression: { cloudinaryPublicId: { $type: 'string' } } },
);

export type ShortRow = InferSchemaType<typeof shortSchema> & {
  _id: Types.ObjectId;
  createdAt: Date;
};
export const Short = model('Short', shortSchema);
