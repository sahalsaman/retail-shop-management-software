import { Schema, model, models, type InferSchemaType, type Types } from "mongoose";

const PurchaseItemSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true },
    sku: { type: String, default: null },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "PCS" },
    unitCost: { type: Number, required: true, min: 0 },
    gstRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    batchNo: { type: String, default: null },
    expiryDate: { type: Date, default: null },
  },
  { _id: false }
);

const PurchaseSchema = new Schema(
  {
    shopId: { type: Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: "Branch", required: true },
    invoiceNumber: { type: String, required: true, trim: true },
    supplierId: { type: Schema.Types.ObjectId, ref: "Supplier", required: true },
    items: { type: [PurchaseItemSchema], required: true, default: [] },
    subtotal: { type: Number, default: 0 },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    totalTax: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    dueAmount: { type: Number, default: 0 },
    status: { type: String, enum: ["PENDING", "PARTIAL", "PAID", "RETURNED"], default: "PENDING" },
    notes: { type: String, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

PurchaseSchema.index({ shopId: 1, supplierId: 1, createdAt: -1 });
PurchaseSchema.index({ shopId: 1, invoiceNumber: 1 });

export type PurchaseDoc = InferSchemaType<typeof PurchaseSchema> & { _id: Types.ObjectId };
export const Purchase = models.Purchase || model("Purchase", PurchaseSchema);
