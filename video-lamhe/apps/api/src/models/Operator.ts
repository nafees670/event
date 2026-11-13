import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { OPERATOR_STATUSES } from '@video-lamhe/shared';

/** Sort key for "price low → high" so operators without prices sort last. */
export const NO_PRICE_SORT = Number.MAX_SAFE_INTEGER;

const operatorSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    businessName: { type: String, required: true, trim: true },
    bio: { type: String, default: null },
    photoUrl: { type: String, default: null },
    baseCity: { type: Schema.Types.ObjectId, ref: 'City', required: true },
    serviceCities: { type: [{ type: Schema.Types.ObjectId, ref: 'City' }], default: [] },
    /** Normalised '923xxxxxxxxx'. Private — never in public responses. */
    phone: { type: String, required: true },
    whatsapp: { type: String, required: true },
    experienceYears: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    status: { type: String, enum: OPERATOR_STATUSES, default: 'pending' },
    isVerified: { type: Boolean, default: false },
    socialLinks: {
      instagram: String,
      facebook: String,
      youtube: String,
      tiktok: String,
      website: String,
    },
    /** Denormalised: lowest available per-event price (recomputed when drones change). */
    priceFrom: { type: Number, default: null },
    priceSort: { type: Number, default: NO_PRICE_SORT },
  },
  { timestamps: true },
);

operatorSchema.index({ baseCity: 1, status: 1 });
operatorSchema.index({ serviceCities: 1 });
operatorSchema.index({ status: 1, isVerified: -1, rating: -1 });
operatorSchema.index(
  { businessName: 'text', bio: 'text' },
  { weights: { businessName: 5, bio: 1 } },
);

export type OperatorDoc = HydratedDocument<InferSchemaType<typeof operatorSchema>>;
export const Operator = model('Operator', operatorSchema);
