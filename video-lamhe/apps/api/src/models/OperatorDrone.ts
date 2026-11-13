import { Schema, model, type InferSchemaType, type Types } from 'mongoose';

/** A drone an operator owns, with their price for it. */
const operatorDroneSchema = new Schema(
  {
    operator: { type: Schema.Types.ObjectId, ref: 'Operator', required: true },
    model: { type: Schema.Types.ObjectId, ref: 'DroneModel', required: true },
    pricePerEvent: { type: Number, default: null },
    pricePerHour: { type: Number, default: null },
    isAvailable: { type: Boolean, default: true },
  },
  { timestamps: true },
);
operatorDroneSchema.index({ operator: 1, model: 1 }, { unique: true });
operatorDroneSchema.index({ model: 1, isAvailable: 1, pricePerEvent: 1 });

export type OperatorDroneRow = InferSchemaType<typeof operatorDroneSchema> & {
  _id: Types.ObjectId;
};
export const OperatorDrone = model('OperatorDrone', operatorDroneSchema);
