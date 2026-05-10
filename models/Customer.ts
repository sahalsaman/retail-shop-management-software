import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const CustomerSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, default: null, lowercase: true, trim: true },
    address: { type: String, default: null, trim: true },
    gstin: { type: String, default: null, trim: true, uppercase: true },
    creditBalance: { type: Number, default: 0 },
    loyaltyPoints: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CustomerSchema.index({ shopId: 1, phone: 1 }, { unique: true });

export type CustomerDoc = InferSchemaType<typeof CustomerSchema> & { _id: Types.ObjectId };
export const Customer = models.Customer || model("Customer", CustomerSchema);
