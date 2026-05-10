import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const CategorySchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    parent: { type: Schema.Types.ObjectId, ref: "Category", default: null },
  },
  { timestamps: true }
);

CategorySchema.index({ shopId: 1, slug: 1 }, { unique: true });

export type CategoryDoc = InferSchemaType<typeof CategorySchema> & { _id: Types.ObjectId };
export const Category = models.Category || model("Category", CategorySchema);
