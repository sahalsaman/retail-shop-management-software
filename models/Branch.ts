import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const BranchSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: null, trim: true },
    phone: { type: String, default: null, trim: true },
    gstin: { type: String, default: null, trim: true, uppercase: true },
    isMain: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type BranchDoc = InferSchemaType<typeof BranchSchema> & { _id: Types.ObjectId };
export const Branch = models.Branch || model("Branch", BranchSchema);
