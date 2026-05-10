import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const BatchSchema = new Schema(
  {
    batchNo: { type: String, required: true, trim: true },
    expiryDate: { type: Date, default: null },
    quantity: { type: Number, required: true, default: 0, min: 0 },
  },
  { _id: false }
);

const InventorySchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    quantity: { type: Number, required: true, default: 0 },
    batches: { type: [BatchSchema], default: [] },
  },
  { timestamps: true }
);

InventorySchema.index({ shopId: 1, branchId: 1, productId: 1 }, { unique: true });

export type InventoryDoc = InferSchemaType<typeof InventorySchema> & { _id: Types.ObjectId };
export const Inventory = models.Inventory || model("Inventory", InventorySchema);
