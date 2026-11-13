import { Schema, model } from 'mongoose';

/** Key/value admin settings, e.g. 'contact', 'hero'. */
const settingSchema = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export const Setting = model('Setting', settingSchema);
