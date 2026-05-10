"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Inventory, Product, StockMovement } from "@/models";
import { StockAdjustmentSchema } from "@/lib/validators";
import { getCurrentUser } from "@/lib/dal";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function adjustStock(form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };

  const parsed = StockAdjustmentSchema.safeParse({
    productId: String(form.get("productId") ?? ""),
    branchId: String(form.get("branchId") ?? ""),
    delta: String(form.get("delta") ?? "0"),
    type: String(form.get("type") ?? "ADJUSTMENT"),
    note: String(form.get("note") ?? ""),
    batchNo: String(form.get("batchNo") ?? ""),
    expiryDate: String(form.get("expiryDate") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectDB();
  const { productId, branchId, delta, type, note, batchNo, expiryDate } = parsed.data;

  const product = await Product.findOne({ _id: productId, shopId: user.shopId })
    .select("_id shopId hasExpiry")
    .lean<{ _id: Types.ObjectId; hasExpiry: boolean } | null>();
  if (!product) return { ok: false, error: "Product not found" };

  const inv = await Inventory.findOneAndUpdate(
    { shopId: user.shopId, branchId, productId },
    {
      $setOnInsert: {
        shopId: user.shopId,
        branchId,
        productId,
        batches: [],
      },
      $inc: { quantity: delta },
    },
    { upsert: true, returnDocument: "after" },
  );

  if (inv && inv.quantity < 0) {
    await Inventory.updateOne(
      { _id: inv._id },
      { $inc: { quantity: -delta } },
    );
    return { ok: false, error: "Adjustment would make stock negative" };
  }

  // Batch handling: on stock-in, push or merge a batch when one is supplied
  // and the product tracks expiry. Stock-out from batches is best handled by
  // POS/Sale (FEFO) — manual adjustments don't decrement specific batches.
  if (product.hasExpiry && batchNo && delta > 0) {
    const existing = await Inventory.findOne({
      shopId: user.shopId,
      branchId,
      productId,
      "batches.batchNo": batchNo,
    });
    if (existing) {
      await Inventory.updateOne(
        {
          shopId: user.shopId,
          branchId,
          productId,
          "batches.batchNo": batchNo,
        },
        {
          $inc: { "batches.$.quantity": delta },
          ...(expiryDate
            ? { $set: { "batches.$.expiryDate": expiryDate } }
            : {}),
        },
      );
    } else {
      await Inventory.updateOne(
        { shopId: user.shopId, branchId, productId },
        {
          $push: {
            batches: { batchNo, expiryDate: expiryDate ?? null, quantity: delta },
          },
        },
      );
    }
  }

  await StockMovement.create({
    shopId: user.shopId,
    branchId,
    productId,
    type,
    quantity: delta,
    note,
    createdBy: user.id,
  });

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function listProductBatches(productId: string, branchId: string) {
  const user = await getCurrentUser();
  if (!user.shopId) return [];
  if (!Types.ObjectId.isValid(productId) || !Types.ObjectId.isValid(branchId))
    return [];
  await connectDB();
  const inv = await Inventory.findOne({
    shopId: user.shopId,
    branchId,
    productId,
  }).lean<{
    batches: Array<{ batchNo: string; expiryDate: Date | null; quantity: number }>;
  } | null>();
  return (inv?.batches ?? []).map((b) => ({
    batchNo: b.batchNo,
    expiryDate: b.expiryDate ?? null,
    quantity: b.quantity,
  }));
}
