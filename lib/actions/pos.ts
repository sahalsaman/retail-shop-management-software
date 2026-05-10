"use server";

import { revalidatePath } from "next/cache";
import { Types, startSession } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongoose";
import { Sale, Inventory, Product, StockMovement, Payment, Customer, Shop } from "@/models";
import { getCurrentUser } from "@/lib/dal";

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

const CartItemSchema = z.object({
  productId: objectId,
  name: z.string().trim().min(1),
  sku: z.string().trim().nullable().optional(),
  hsnCode: z.string().trim().nullable().optional(),
  quantity: z.coerce.number().positive(),
  unit: z.string().trim().default("PCS"),
  unitPrice: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).default(0),
  gstRate: z.coerce.number().min(0).default(0),
});

const FinalizeSchema = z.object({
  branchId: objectId,
  customerId: z.union([objectId, z.literal("").transform(() => null)]).nullable().optional(),
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "CREDIT"]).default("CASH"),
  paidAmount: z.coerce.number().min(0).default(0),
  discount: z.coerce.number().min(0).default(0),
  intraState: z.coerce.boolean().default(true),
  notes: z.string().trim().max(240).optional().nullable(),
  items: z.array(CartItemSchema).min(1, "Cart is empty"),
  resumeFromId: z.string().optional().nullable(),
});

const HoldSchema = FinalizeSchema.extend({
  paymentMethod: z.enum(["CASH", "UPI", "CARD", "CREDIT"]).default("CASH"),
});

export type FinalizeResult =
  | { ok: true; saleId: string; billNumber: string }
  | { ok: false; error: string };

function calcTotals(input: z.infer<typeof FinalizeSchema>) {
  let subtotal = 0;
  let totalTax = 0;
  const items = input.items.map((it) => {
    const gross = it.quantity * it.unitPrice;
    const afterDisc = Math.max(0, gross - it.discount);
    const tax = (afterDisc * it.gstRate) / 100;
    const total = afterDisc + tax;
    subtotal += afterDisc;
    totalTax += tax;
    return {
      ...it,
      taxAmount: round2(tax),
      total: round2(total),
    };
  });

  const cgst = input.intraState ? round2(totalTax / 2) : 0;
  const sgst = input.intraState ? round2(totalTax / 2) : 0;
  const igst = !input.intraState ? round2(totalTax) : 0;

  const grand = subtotal + totalTax - input.discount;
  const rounded = Math.round(grand);
  const roundOff = round2(rounded - grand);
  const total = round2(grand + roundOff);

  return {
    items,
    subtotal: round2(subtotal),
    cgst,
    sgst,
    igst,
    totalTax: round2(totalTax),
    discount: round2(input.discount),
    roundOff,
    total,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function nextBillNumber(shopId: Types.ObjectId): Promise<string> {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const count = await Sale.countDocuments({
    shopId,
    createdAt: { $gte: monthStart },
  });
  return `INV${yy}${mm}${String(count + 1).padStart(4, "0")}`;
}

export async function finalizeSale(payload: unknown): Promise<FinalizeResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };

  const parsed = FinalizeSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  await connectDB();
  const shopId = new Types.ObjectId(user.shopId);
  const totals = calcTotals(input);

  if (totals.total <= 0) {
    return { ok: false, error: "Total must be greater than zero" };
  }
  if (
    input.paymentMethod !== "CREDIT" &&
    Math.abs(input.paidAmount - totals.total) > 0.01 &&
    input.paidAmount < totals.total
  ) {
    // partial payment but not credit-mode → record as partial credit only if customer attached
    if (!input.customerId) {
      return {
        ok: false,
        error: "Partial payment requires a customer (credit must be tracked)",
      };
    }
  }

  // Try in a transaction; if Mongo isn't a replica set (local dev) it'll throw
  // and we fall back to sequential ops.
  const session = await startSession().catch(() => null);
  let saleId: Types.ObjectId | null = null;
  let billNumber = "";
  try {
    if (session) session.startTransaction();

    const billNumberCandidate = await nextBillNumber(shopId);

    // Decrement stock for each item; abort if insufficient.
    for (const it of totals.items) {
      const upd = await Inventory.findOneAndUpdate(
        {
          shopId,
          branchId: input.branchId,
          productId: it.productId,
          quantity: { $gte: it.quantity },
        },
        { $inc: { quantity: -it.quantity } },
        { returnDocument: "after", session: session ?? undefined },
      );
      if (!upd) {
        throw new Error(`Insufficient stock for ${it.name}`);
      }
    }

    const sale = await Sale.create(
      [
        {
          shopId,
          branchId: input.branchId,
          billNumber: billNumberCandidate,
          customerId: input.customerId || null,
          cashierId: user.id,
          items: totals.items,
          subtotal: totals.subtotal,
          discount: totals.discount,
          cgst: totals.cgst,
          sgst: totals.sgst,
          igst: totals.igst,
          totalTax: totals.totalTax,
          roundOff: totals.roundOff,
          total: totals.total,
          paymentMethod: input.paymentMethod,
          paidAmount: input.paidAmount,
          dueAmount: round2(totals.total - input.paidAmount),
          status: "COMPLETED",
          notes: input.notes ?? null,
        },
      ],
      session ? { session } : undefined,
    );

    saleId = sale[0]._id as Types.ObjectId;
    billNumber = billNumberCandidate;

    // Audit stock decrement
    await StockMovement.insertMany(
      totals.items.map((it) => ({
        shopId,
        branchId: input.branchId,
        productId: it.productId,
        type: "SALE" as const,
        quantity: -it.quantity,
        refType: "Sale",
        refId: saleId,
        createdBy: user.id,
      })),
      session ? { session } : {},
    );

    // Record payment if any cash collected
    if (input.paidAmount > 0) {
      await Payment.create(
        [
          {
            shopId,
            branchId: input.branchId,
            type: "SALE_RECEIPT",
            refId: saleId,
            customerId: input.customerId || null,
            amount: input.paidAmount,
            method: input.paymentMethod,
            createdBy: user.id,
          },
        ],
        session ? { session } : undefined,
      );
    }

    // If a customer is attached and there's a balance due, bump their credit
    if (input.customerId && input.paidAmount < totals.total) {
      await Customer.updateOne(
        { _id: input.customerId, shopId },
        { $inc: { creditBalance: totals.total - input.paidAmount } },
        session ? { session } : undefined,
      );
    }

    // If resuming a held bill, remove the held draft.
    if (input.resumeFromId && Types.ObjectId.isValid(input.resumeFromId)) {
      await Sale.deleteOne(
        { _id: input.resumeFromId, shopId, status: "HELD" },
        session ? { session } : undefined,
      );
    }

    if (session) await session.commitTransaction();
  } catch (e: unknown) {
    if (session) await session.abortTransaction().catch(() => {});
    if (session) session.endSession();
    const msg = e instanceof Error ? e.message : "Failed to finalize sale";
    return { ok: false, error: msg };
  } finally {
    if (session) session.endSession();
  }

  // Outside the txn so caching invalidation always runs
  void Shop;
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pos");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/customers");

  return { ok: true, saleId: String(saleId), billNumber };
}

export async function holdSale(payload: unknown): Promise<FinalizeResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };

  const parsed = HoldSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const input = parsed.data;

  await connectDB();
  const shopId = new Types.ObjectId(user.shopId);
  const totals = calcTotals(input);

  const billNumberCandidate = `HELD-${Date.now().toString(36).toUpperCase()}`;

  const sale = await Sale.create({
    shopId,
    branchId: input.branchId,
    billNumber: billNumberCandidate,
    customerId: input.customerId || null,
    cashierId: user.id,
    items: totals.items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    cgst: totals.cgst,
    sgst: totals.sgst,
    igst: totals.igst,
    totalTax: totals.totalTax,
    roundOff: totals.roundOff,
    total: totals.total,
    paymentMethod: input.paymentMethod,
    paidAmount: 0,
    dueAmount: totals.total,
    status: "HELD",
    notes: input.notes ?? null,
  });

  revalidatePath("/dashboard/pos");
  return {
    ok: true,
    saleId: String(sale._id),
    billNumber: billNumberCandidate,
  };
}

export async function discardHeldSale(id: string) {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };
  await connectDB();
  await Sale.deleteOne({ _id: id, shopId: user.shopId, status: "HELD" });
  revalidatePath("/dashboard/pos");
  return { ok: true };
}
