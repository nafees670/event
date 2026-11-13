import { Schema, model, type HydratedDocument, type InferSchemaType } from 'mongoose';

const droneModelSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    /** Short highlight, e.g. "Most booked". */
    tag: { type: String, default: null },
    bestFor: { type: String, default: null },
    specs: {
      camera: { type: String, default: '' },
      video: { type: String, default: '' },
      flightTime: { type: String, default: '' },
      range: { type: String, default: '' },
    },
    images: { type: [String], default: [] },
    /** Display order on the drone selector (ascending). */
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true },
);
droneModelSchema.index({ sortOrder: 1, name: 1 });

export type DroneModelDoc = HydratedDocument<InferSchemaType<typeof droneModelSchema>>;
export const DroneModel = model('DroneModel', droneModelSchema);
