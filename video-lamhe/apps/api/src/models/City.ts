import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const citySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    province: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);
citySchema.index({ isActive: 1, name: 1 });

export type CityDoc = HydratedDocument<InferSchemaType<typeof citySchema>>;
export const City = model('City', citySchema);
