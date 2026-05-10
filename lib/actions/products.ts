"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Product, Inventory, Branch } from "@/models";
import { ProductSchema } from "@/lib/validators";
import { getCurrentUser } from "@/lib/dal";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

function readForm(form: FormData) {
  return {
    name: String(form.get("name") ?? ""),
    sku: String(form.get("sku") ?? ""),
    barcode: String(form.get("barcode") ?? ""),
    categoryId: String(form.get("categoryId") ?? ""),
    brandId: String(form.get("brandId") ?? ""),
    hsnCode: String(form.get("hsnCode") ?? ""),
    gstRate: String(form.get("gstRate") ?? "0"),
    purchasePrice: String(form.get("purchasePrice") ?? "0"),
    sellingPrice: String(form.get("sellingPrice") ?? "0"),
    mrp: String(form.get("mrp") ?? ""),
    unit: String(form.get("unit") ?? "PCS"),
    images: String(form.get("images") ?? "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
    lowStockThreshold: String(form.get("lowStockThreshold") ?? "5"),
    hasExpiry: form.get("hasExpiry") === "on" || form.get("hasExpiry") === "true",
    isActive: form.get("isActive") !== "off" && form.get("isActive") !== "false",
    description: String(form.get("description") ?? ""),
  };
}

export async function createProduct(form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };

  const parsed = ProductSchema.safeParse(readForm(form));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectDB();
  try {
    const doc = await Product.create({
      shopId: user.shopId,
      ...parsed.data,
    });

    // Seed zero-quantity inventory rows for every active branch so the product
    // shows up in branch-wise stock views immediately.
    const branches = await Branch.find({ shopId: user.shopId, isActive: true })
      .select("_id")
      .lean<Array<{ _id: Types.ObjectId }>>();
    if (branches.length > 0) {
      await Inventory.bulkWrite(
        branches.map((b) => ({
          updateOne: {
            filter: { shopId: user.shopId, branchId: b._id, productId: doc._id },
            update: {
              $setOnInsert: {
                shopId: user.shopId,
                branchId: b._id,
                productId: doc._id,
                quantity: 0,
                batches: [],
              },
            },
            upsert: true,
          },
        })),
      );
    }

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/inventory");
    return { ok: true, id: String(doc._id) };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: number }).code === 11000) {
      return { ok: false, error: "SKU or barcode already exists" };
    }
    console.error(e);
    return { ok: false, error: "Failed to save product" };
  }
}

export async function updateProduct(id: string, form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };

  const parsed = ProductSchema.safeParse(readForm(form));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectDB();
  try {
    const updated = await Product.findOneAndUpdate(
      { _id: id, shopId: user.shopId },
      { $set: parsed.data },
      { returnDocument: "after" },
    );
    if (!updated) return { ok: false, error: "Product not found" };
    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/inventory");
    return { ok: true, id: String(updated._id) };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: number }).code === 11000) {
      return { ok: false, error: "SKU or barcode already exists" };
    }
    console.error(e);
    return { ok: false, error: "Failed to save product" };
  }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };

  await connectDB();
  await Product.deleteOne({ _id: id, shopId: user.shopId });
  await Inventory.deleteMany({ shopId: user.shopId, productId: id });
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  return { ok: true };
}

export async function toggleProductActive(id: string, active: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };
  await connectDB();
  await Product.findOneAndUpdate(
    { _id: id, shopId: user.shopId },
    { $set: { isActive: active } },
  );
  revalidatePath("/dashboard/products");
  return { ok: true };
}
