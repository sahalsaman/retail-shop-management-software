import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";
import { PAYMENT_METHODS, SALE_STATUS } from "@/lib/types";

const SaleItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    sku: { type: String, default: null },
    hsnCode: { type: String, default: null },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "PCS" },
    unitPrice: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    gstRate: { type: Number, default: 0, min: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, required: true },
  },
  { _id: false }
);

const SaleSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    billNumber: { type: String, required: true },
    customerId: { type: Schema.Types.ObjectId, ref: "Customer", default: null },
    cashierId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    items: { type: [SaleItemSchema], required: true, default: [] },
    subtotal: { type: Number, required: true, default: 0 },
    discount: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    total: { type: Number, required: true, default: 0 },
    paymentMethod: { type: String, enum: PAYMENT_METHODS, required: true, default: "CASH" },
    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
    status: { type: String, enum: SALE_STATUS, default: "COMPLETED" },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

SaleSchema.index({ shopId: 1, billNumber: 1 }, { unique: true });
SaleSchema.index({ shopId: 1, createdAt: -1 });
SaleSchema.index({ shopId: 1, branchId: 1, createdAt: -1 });
SaleSchema.index({ shopId: 1, customerId: 1, createdAt: -1 });

export type SaleDoc = InferSchemaType<typeof SaleSchema> & { _id: Types.ObjectId };
export const Sale = models.Sale || model("Sale", SaleSchema);
