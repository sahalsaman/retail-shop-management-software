import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { PAYMENT_METHODS } from "@/lib/types";

const PAYMENT_TYPES = [
  "SALE_RECEIPT",
  "PURCHASE_PAYMENT",
  "CUSTOMER_DUE",
  "SUPPLIER_DUE",
] as const;

const PaymentSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", default: null },
    type: { type: String, enum: PAYMENT_TYPES, required: true },
    refId: { type: Schema.Types.ObjectId, default: null },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", default: null },
    amount: { type: Number, required: true, min: 0 },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    note: { type: String, default: null, trim: true },
    date: { type: Date, default: () => new Date(), required: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

PaymentSchema.index({ shopId: 1, date: -1 });
PaymentSchema.index({ shopId: 1, type: 1, date: -1 });
PaymentSchema.index({ shopId: 1, customerId: 1 }, { sparse: true });
PaymentSchema.index({ shopId: 1, supplierId: 1 }, { sparse: true });

export type PaymentDoc = InferSchemaType<typeof PaymentSchema> & { _id: Types.ObjectId };
export const Payment = models.Payment || model("Payment", PaymentSchema);
export { PAYMENT_TYPES };
