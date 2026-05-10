import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const BrandSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

BrandSchema.index({ shopId: 1, name: 1 }, { unique: true });

export type BrandDoc = InferSchemaType<typeof BrandSchema> & { _id: Types.ObjectId };
export const Brand = models.Brand || model("Brand", BrandSchema);
