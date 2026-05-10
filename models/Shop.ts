import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { SHOP_TYPES } from "@/lib/types";

const ShopSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: SHOP_TYPES, required: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    gstin: { type: String, default: null, trim: true, uppercase: true },
    address: { type: String, default: null, trim: true },
    phone: { type: String, default: null, trim: true },
    email: { type: String, default: null, lowercase: true, trim: true },
    currency: { type: String, default: "INR" },
    locale: { type: String, default: "en-IN" },
    gstEnabled: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    printerEnabled: { type: Boolean, default: false },
    printerPaperWidth: { type: String, enum: ["58mm", "80mm"], default: "80mm" },
    printerHeader: { type: String, default: null, trim: true },
    printerFooter: {
      type: String,
      default: "Thank you for your purchase. Goods once sold cannot be returned without bill.",
      trim: true,
    },
    printerCopies: { type: Number, default: 1, min: 1, max: 3 },
    printerAutoPrint: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export type ShopDoc = InferSchemaType<typeof ShopSchema> & { _id: Types.ObjectId };
export const Shop = models.Shop || model("Shop", ShopSchema);
