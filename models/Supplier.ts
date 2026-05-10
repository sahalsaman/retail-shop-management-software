import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const SupplierSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: null, trim: true },
    email: { type: String, default: null, lowercase: true, trim: true },
    address: { type: String, default: null, trim: true },
    gstin: { type: String, default: null, trim: true, uppercase: true },
    openingBalance: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SupplierSchema.index({ shopId: 1, phone: 1 });
SupplierSchema.index({ shopId: 1, name: 1 });

export type SupplierDoc = InferSchemaType<typeof SupplierSchema> & { _id: Types.ObjectId };
export const Supplier = models.Supplier || model("Supplier", SupplierSchema);
