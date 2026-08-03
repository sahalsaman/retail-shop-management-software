"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import {
  Purchase,
  Inventory,
  Product,
  Supplier,
  Payment,
  StockMovement,
} from "@/models";
import { PurchaseCreateSchema } from "@/lib/validators";
import { getCurrentUser } from "@/lib/dal";
import { getDefaultBranchId } from "@/lib/queries/branches";
import { z } from "zod";

export type ActionResult =
  | { ok: true; id: string; invoiceNumber: string }
  | { ok: false; error: string };

const ManualSupplierPurchaseSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  paidAmount: z.coerce.number().min(0, "Paid amount cannot be negative").default(0),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "CREDIT"]).default("CASH"),
  date: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(`${v}T00:00:00`) : new Date())),
  note: z
    .string()
    .trim()
    .max(240)
    .optional()
    .transform((v) => (v ? v : null)),
});

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export async function createPurchase(payload: unknown): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };

  const parsed = PurchaseCreateSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;
  await connectDB();
  const shopId = new Types.ObjectId(user.shopId);

  // Compute totals
  let subtotal = 0;
  let totalTax = 0;
  const computedItems = input.items.map((it) => {
    const gross = it.quantity * it.unitCost;
    const tax = (gross * it.gstRate) / 100;
    subtotal += gross;
    totalTax += tax;
    return {
      ...it,
      taxAmount: round2(tax),
      total: round2(gross + tax),
    };
  });
  const cgst = input.intraState ? round2(totalTax / 2) : 0;
  const sgst = input.intraState ? round2(totalTax / 2) : 0;
  const igst = !input.intraState ? round2(totalTax) : 0;
  const total = round2(subtotal + totalTax);
  const paidAmount = Math.min(input.paidAmount, total);
  const dueAmount = round2(total - paidAmount);
  const status =
    paidAmount >= total ? "PAID" : paidAmount > 0 ? "PARTIAL" : "PENDING";

  const supplier = await Supplier.findOne({ _id: input.supplierId, shopId });
  if (!supplier) return { ok: false, error: "Supplier not found" };

  // Create purchase invoice
  const purchase = await Purchase.create({
    shopId,
    branchId: input.branchId,
    invoiceNumber: input.invoiceNumber,
    supplierId: input.supplierId,
    items: computedItems,
    subtotal: round2(subtotal),
    cgst,
    sgst,
    igst,
    totalTax: round2(totalTax),
    total,
    paidAmount,
    dueAmount,
    status,
    notes: input.notes ?? null,
    createdBy: user.id,
  });

  // Increment stock + push batches
  for (const it of computedItems) {
    const product = await Product.findOne({ _id: it.productId, shopId })
      .select("hasExpiry")
      .lean<{ hasExpiry: boolean } | null>();

    await Inventory.findOneAndUpdate(
      { shopId, branchId: input.branchId, productId: it.productId },
      {
        $setOnInsert: {
          shopId,
          branchId: input.branchId,
          productId: it.productId,
          batches: [],
        },
        $inc: { quantity: it.quantity },
      },
      { upsert: true, returnDocument: "after" },
    );

    if (product?.hasExpiry && it.batchNo) {
      const existing = await Inventory.findOne({
        shopId,
        branchId: input.branchId,
        productId: it.productId,
        "batches.batchNo": it.batchNo,
      });
      if (existing) {
        await Inventory.updateOne(
          {
            shopId,
            branchId: input.branchId,
            productId: it.productId,
            "batches.batchNo": it.batchNo,
          },
          {
            $inc: { "batches.$.quantity": it.quantity },
            ...(it.expiryDate
              ? { $set: { "batches.$.expiryDate": it.expiryDate } }
              : {}),
          },
        );
      } else {
        await Inventory.updateOne(
          { shopId, branchId: input.branchId, productId: it.productId },
          {
            $push: {
              batches: {
                batchNo: it.batchNo,
                expiryDate: it.expiryDate ?? null,
                quantity: it.quantity,
              },
            },
          },
        );
      }
    }
  }

  // Audit stock-in
  await StockMovement.insertMany(
    computedItems.map((it) => ({
      shopId,
      branchId: input.branchId,
      productId: it.productId,
      type: "PURCHASE" as const,
      quantity: it.quantity,
      refType: "Purchase",
      refId: purchase._id,
      createdBy: user.id,
    })),
  );

  // Record payment & supplier balance
  if (paidAmount > 0) {
    await Payment.create({
      shopId,
      branchId: input.branchId,
      type: "PURCHASE_PAYMENT",
      refId: purchase._id,
      supplierId: input.supplierId,
      amount: paidAmount,
      method: input.paymentMethod,
      createdBy: user.id,
    });
  }
  if (dueAmount > 0) {
    await Supplier.updateOne(
      { _id: input.supplierId, shopId },
      { $inc: { currentBalance: dueAmount } },
    );
  }

  revalidatePath("/dashboard/purchases");
  revalidatePath("/dashboard/inventory");
  revalidatePath(`/dashboard/suppliers/${input.supplierId}`);

  return {
    ok: true,
    id: String(purchase._id),
    invoiceNumber: purchase.invoiceNumber,
  };
}

function readManualPurchaseForm(form: FormData) {
  return {
    amount: String(form.get("amount") ?? "0"),
    paidAmount: String(form.get("paidAmount") ?? "0"),
    paymentMethod: String(form.get("paymentMethod") ?? "CASH"),
    date: String(form.get("date") ?? ""),
    note: String(form.get("note") ?? ""),
  };
}

function dateKey(d: Date) {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
}

export async function createManualSupplierPurchase(
  supplierId: string,
  form: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (user.role !== "OWNER" && user.role !== "ADMIN") {
    return { ok: false, error: "Only owner can add manual purchase amount" };
  }
  if (!Types.ObjectId.isValid(supplierId)) {
    return { ok: false, error: "Invalid supplier" };
  }

  const parsed = ManualSupplierPurchaseSchema.safeParse(readManualPurchaseForm(form));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectDB();
  const shopId = new Types.ObjectId(user.shopId);
  const supplier = await Supplier.findOne({ _id: supplierId, shopId }).select("_id").lean();
  if (!supplier) return { ok: false, error: "Supplier not found" };

  const branchId = await getDefaultBranchId(user.shopId, user.branchId);
  if (!branchId) return { ok: false, error: "No branch found" };

  const input = parsed.data;
  const total = round2(input.amount);
  const paidAmount = Math.min(round2(input.paidAmount), total);
  const dueAmount = round2(total - paidAmount);
  const status =
    paidAmount >= total ? "PAID" : paidAmount > 0 ? "PARTIAL" : "PENDING";
  const invoiceNumber = `MANUAL-${dateKey(input.date)}-${Date.now().toString(36).toUpperCase()}`;

  const purchase = new Purchase({
    shopId,
    branchId,
    invoiceNumber,
    supplierId,
    items: [],
    subtotal: total,
    cgst: 0,
    sgst: 0,
    igst: 0,
    totalTax: 0,
    total,
    paidAmount,
    dueAmount,
    status,
    notes: input.note ?? "Manual purchase amount",
    createdBy: user.id,
  });
  purchase.createdAt = input.date;
  purchase.updatedAt = new Date();
  await purchase.save();

  if (paidAmount > 0) {
    await Payment.create({
      shopId,
      branchId,
      type: "PURCHASE_PAYMENT",
      refId: purchase._id,
      supplierId,
      amount: paidAmount,
      method: input.paymentMethod,
      date: input.date,
      note: input.note ?? "Manual purchase payment",
      createdBy: user.id,
    });
  }

  if (dueAmount > 0) {
    await Supplier.updateOne({ _id: supplierId, shopId }, { $inc: { currentBalance: dueAmount } });
  }

  revalidatePath("/dashboard/purchases");
  revalidatePath("/dashboard/reports");
  revalidatePath(`/dashboard/suppliers/${supplierId}`);

  return {
    ok: true,
    id: String(purchase._id),
    invoiceNumber: purchase.invoiceNumber,
  };
}
