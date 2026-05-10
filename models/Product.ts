import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const ProductSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true, uppercase: true },
    barcode: { type: String, default: null, trim: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "Category", default: null },
    brandId: { type: Schema.Types.ObjectId, ref: "Brand", default: null },
    hsnCode: { type: String, default: null, trim: true },
    gstRate: { type: Number, default: 0, min: 0, max: 100 },
    purchasePrice: { type: Number, required: true, min: 0 },
    sellingPrice: { type: Number, required: true, min: 0 },
    mrp: { type: Number, default: null, min: 0 },
    unit: { type: String, default: "PCS", trim: true, uppercase: true },
    images: { type: [String], default: [] },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    hasExpiry: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    description: { type: String, default: null, trim: true },
  },
  { timestamps: true }
);

ProductSchema.index({ shopId: 1, sku: 1 }, { unique: true });
ProductSchema.index({ shopId: 1, barcode: 1 }, { sparse: true });
ProductSchema.index({ shopId: 1, name: "text" });

export type ProductDoc = InferSchemaType<typeof ProductSchema> & { _id: Types.ObjectId };
export const Product = models.Product || model("Product", ProductSchema);
