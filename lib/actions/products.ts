"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/mongoose";
import { Product, Inventory, Branch, StockMovement } from "@/models";
import { ProductSchema } from "@/lib/validators";
import { getCurrentUser } from "@/lib/dal";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export type QuickAddProduct = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  unit: string;
  gstRate: number;
  sellingPrice: number;
  mrp: number | null;
  stock: number;
};

export type QuickAddResult =
  | { ok: true; product: QuickAddProduct }
  | { ok: false; error: string };

const QuickAddSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  sku: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Za-z0-9._-]*$/, "Letters, numbers, dot, dash, underscore only")
    .optional()
    .transform((s) => (s ? s.toUpperCase() : "")),
  unit: z
    .string()
    .trim()
    .min(1)
    .max(10)
    .default("PCS")
    .transform((s) => s.toUpperCase()),
  sellingPrice: z.coerce.number().min(0, "Cannot be negative"),
  gstRate: z.coerce.number().min(0).max(100).default(0),
  openingStock: z.coerce.number().int().min(0).default(0),
  branchId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid branch"),
});

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

export async function quickAddProductFromPos(input: {
  name: string;
  sku?: string;
  unit?: string;
  sellingPrice: number | string;
  gstRate?: number | string;
  openingStock?: number | string;
  branchId: string;
}): Promise<QuickAddResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };

  const parsed = QuickAddSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;

  await connectDB();

  if (!Types.ObjectId.isValid(data.branchId)) {
    return { ok: false, error: "Invalid branch" };
  }
  const branch = await Branch.findOne({
    _id: data.branchId,
    shopId: user.shopId,
    isActive: true,
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();
  if (!branch) return { ok: false, error: "Branch not found" };

  const sku = data.sku || `Q${Date.now().toString(36).toUpperCase()}`;

  try {
    const doc = await Product.create({
      shopId: user.shopId,
      name: data.name,
      sku,
      unit: data.unit,
      sellingPrice: data.sellingPrice,
      purchasePrice: data.sellingPrice,
      gstRate: data.gstRate,
    });

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

    if (data.openingStock > 0) {
      await Inventory.findOneAndUpdate(
        { shopId: user.shopId, branchId: data.branchId, productId: doc._id },
        { $set: { quantity: data.openingStock } },
        { returnDocument: "after", upsert: true },
      );
      await StockMovement.create({
        shopId: user.shopId,
        branchId: data.branchId,
        productId: doc._id,
        type: "OPENING",
        quantity: data.openingStock,
        note: "Quick-add from POS",
        createdBy: user.id,
      });
    }

    revalidatePath("/dashboard/products");
    revalidatePath("/dashboard/inventory");
    revalidatePath("/dashboard/pos");

    return {
      ok: true,
      product: {
        id: String(doc._id),
        name: doc.name,
        sku: doc.sku,
        barcode: doc.barcode ?? null,
        unit: doc.unit,
        gstRate: doc.gstRate,
        sellingPrice: doc.sellingPrice,
        mrp: doc.mrp ?? null,
        stock: data.openingStock,
      },
    };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: number }).code === 11000) {
      return { ok: false, error: "SKU already exists — try a different one" };
    }
    console.error(e);
    return { ok: false, error: "Failed to create product" };
  }
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
