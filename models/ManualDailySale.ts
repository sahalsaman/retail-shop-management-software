import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const ManualDailySaleSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    dateKey: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0, default: 0 },
    note: { type: String, default: null, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true },
);

ManualDailySaleSchema.index({ shopId: 1, dateKey: 1 }, { unique: true });

export type ManualDailySaleDoc = InferSchemaType<typeof ManualDailySaleSchema> & {
  _id: Types.ObjectId;
};

export const ManualDailySale =
  models.ManualDailySale || model("ManualDailySale", ManualDailySaleSchema);
