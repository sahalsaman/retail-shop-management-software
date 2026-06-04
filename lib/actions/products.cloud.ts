import "server-only";
import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectCloudDB } from "@/lib/mongoose";
import { Product, Inventory, Branch } from "@/models";
import { getCurrentUser } from "@/lib/dal";
import { ProductSchema, type ProductInput } from "@/lib/validators";
import {
  QuickAddSchema,
  readForm,
  type ActionResult,
  type QuickAddInput,
  type QuickAddResult,
} from "./products-shared";

// Cloud Mongo implementation of the product writes, used by the web build
// (no local SQLite, no offline outbox — cloud is the single source of truth).
// Mirrors the public contract of the SQLite actions in products.ts.

function toObjectId(v: string | null | undefined): Types.ObjectId | null {
  return v && Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
}

function docFromInput(shopId: Types.ObjectId, d: ProductInput) {
  return {
    shopId,
    name: d.name,
    sku: d.sku,
    barcode: d.barcode ?? null,
    categoryId: toObjectId(d.categoryId),
    brandId: toObjectId(d.brandId),
    hsnCode: d.hsnCode ?? null,
    gstRate: d.gstRate,
    purchasePrice: d.purchasePrice,
    sellingPrice: d.sellingPrice,
    mrp: d.mrp ?? null,
    unit: d.unit,
    images: d.images ?? [],
    lowStockThreshold: d.lowStockThreshold,
    hasExpiry: d.hasExpiry,
    isActive: d.isActive,
    description: d.description ?? null,
  };
}

export async function createProductCloud(form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };

  const parsed = ProductSchema.safeParse(readForm(form));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const conn = await connectCloudDB();
  if (!conn) return { ok: false, error: "No internet connection. Please try again." };

  const shopId = new Types.ObjectId(user.shopId);
  const existing = await Product.findOne({ shopId, sku: parsed.data.sku }).lean();
  if (existing) return { ok: false, error: "SKU already exists" };

  const doc = await Product.create(docFromInput(shopId, parsed.data));

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  return { ok: true, id: String(doc._id) };
}

export async function updateProductCloud(id: string, form: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Product not found" };

  const parsed = ProductSchema.safeParse(readForm(form));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const conn = await connectCloudDB();
  if (!conn) return { ok: false, error: "No internet connection. Please try again." };

  const shopId = new Types.ObjectId(user.shopId);
  const conflicting = await Product.findOne({
    shopId,
    sku: parsed.data.sku,
    _id: { $ne: new Types.ObjectId(id) },
  }).lean();
  if (conflicting) return { ok: false, error: "SKU already exists" };

  const updated = await Product.findOneAndUpdate(
    { _id: new Types.ObjectId(id), shopId },
    { $set: docFromInput(shopId, parsed.data) },
    { returnDocument: "after" },
  ).lean();
  if (!updated) return { ok: false, error: "Product not found" };

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  return { ok: true, id };
}

export async function deleteProductCloud(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Product not found" };

  const conn = await connectCloudDB();
  if (!conn) return { ok: false, error: "No internet connection. Please try again." };

  const shopId = new Types.ObjectId(user.shopId);
  const res = await Product.deleteOne({ _id: new Types.ObjectId(id), shopId });
  if (res.deletedCount === 0) return { ok: false, error: "Product not found" };
  await Inventory.deleteMany({ shopId, productId: new Types.ObjectId(id) });

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  return { ok: true };
}

export async function toggleProductActiveCloud(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Product not found" };

  const conn = await connectCloudDB();
  if (!conn) return { ok: false, error: "No internet connection. Please try again." };

  const shopId = new Types.ObjectId(user.shopId);
  await Product.updateOne(
    { _id: new Types.ObjectId(id), shopId },
    { $set: { isActive: active } },
  );

  revalidatePath("/dashboard/products");
  return { ok: true };
}

export async function quickAddProductCloud(input: QuickAddInput): Promise<QuickAddResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };

  const parsed = QuickAddSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const conn = await connectCloudDB();
  if (!conn) return { ok: false, error: "No internet connection. Please try again." };

  const shopId = new Types.ObjectId(user.shopId);
  if (!Types.ObjectId.isValid(data.branchId)) {
    return { ok: false, error: "Branch not found" };
  }
  const branchId = new Types.ObjectId(data.branchId);
  const branch = await Branch.findOne({ _id: branchId, shopId, isActive: true }).lean();
  if (!branch) return { ok: false, error: "Branch not found" };

  const sku = data.sku || `Q${Date.now().toString(36).toUpperCase()}`;
  const exists = await Product.findOne({ shopId, sku }).lean();
  if (exists) return { ok: false, error: "SKU already exists — try a different one" };

  const product = await Product.create({
    shopId,
    name: data.name,
    sku,
    unit: data.unit,
    sellingPrice: data.sellingPrice,
    purchasePrice: data.sellingPrice,
    gstRate: data.gstRate,
  });

  // Seed inventory in every active branch; opening stock only on the chosen one.
  const branches = await Branch.find({ shopId, isActive: true })
    .select("_id")
    .lean<Array<{ _id: Types.ObjectId }>>();
  if (branches.length) {
    await Inventory.insertMany(
      branches.map((b) => ({
        shopId,
        branchId: b._id,
        productId: product._id,
        quantity: String(b._id) === data.branchId ? data.openingStock : 0,
      })),
    );
  }

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/pos");

  return {
    ok: true,
    product: {
      id: String(product._id),
      name: data.name,
      sku,
      barcode: null,
      unit: data.unit,
      gstRate: data.gstRate,
      sellingPrice: Number(data.sellingPrice),
      mrp: null,
      stock: data.openingStock,
    },
  };
}
