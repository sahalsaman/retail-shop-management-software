import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { STOCK_MOVEMENT_TYPES } from "@/lib/types";

const StockMovementSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    type: { type: String, enum: STOCK_MOVEMENT_TYPES, required: true },
    quantity: { type: Number, required: true },
    refType: { type: String, default: null },
    refId: { type: Schema.Types.ObjectId, default: null },
    note: { type: String, default: null, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

StockMovementSchema.index({ shopId: 1, productId: 1, createdAt: -1 });
StockMovementSchema.index({ shopId: 1, branchId: 1, createdAt: -1 });

export type StockMovementDoc = InferSchemaType<typeof StockMovementSchema> & {
  _id: Types.ObjectId;
};
export const StockMovement =
  models.StockMovement || model("StockMovement", StockMovementSchema);
