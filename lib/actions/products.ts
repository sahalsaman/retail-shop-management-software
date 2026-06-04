"use server";

import { revalidatePath } from "next/cache";
import { getDb, newId, nowMs } from "@/lib/sqlite";
import { enqueueOutbox } from "@/lib/sync/outbox";
import { ProductSchema } from "@/lib/validators";
import { getCurrentUser } from "@/lib/dal";
import { isDesktop } from "@/lib/runtime";
import {
  QuickAddSchema,
  readForm,
  type ActionResult,
  type QuickAddInput,
  type QuickAddResult,
} from "./products-shared";
import {
  createProductCloud,
  deleteProductCloud,
  quickAddProductCloud,
  toggleProductActiveCloud,
  updateProductCloud,
} from "./products.cloud";

export type { ActionResult, QuickAddProduct, QuickAddResult } from "./products-shared";

// Maps the SQLite row back into the cloud Mongo shape that lib/sync/pull.ts and
// the existing Mongoose models expect. Outbox push uses this payload as-is.
function rowToCloudDoc(row: Record<string, unknown>): Record<string, unknown> {
  return {
    shopId: row.shop_id,
    name: row.name,
    sku: row.sku,
    barcode: row.barcode,
    categoryId: row.category_id,
    brandId: row.brand_id,
    hsnCode: row.hsn_code,
    gstRate: row.gst_rate,
    purchasePrice: row.purchase_price,
    sellingPrice: row.selling_price,
    mrp: row.mrp,
    unit: row.unit,
    images: JSON.parse((row.images as string) || "[]"),
    lowStockThreshold: row.low_stock_threshold,
    hasExpiry: !!row.has_expiry,
    isActive: !!row.is_active,
    description: row.description,
    createdAt: new Date(row.created_at as number),
    updatedAt: new Date(row.updated_at as number),
  };
}

function readById(id: string): Record<string, unknown> | undefined {
  return getDb()
    .prepare(`SELECT * FROM products WHERE id = ?`)
    .get(id) as Record<string, unknown> | undefined;
}

export async function createProduct(form: FormData): Promise<ActionResult> {
  if (!isDesktop()) return createProductCloud(form);

  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };

  const parsed = ProductSchema.safeParse(readForm(form));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  const db = getDb();

  const existing = db
    .prepare(`SELECT id FROM products WHERE shop_id = ? AND sku = ? AND deleted_at IS NULL`)
    .get(user.shopId, d.sku);
  if (existing) return { ok: false, error: "SKU already exists" };

  const id = newId();
  const now = nowMs();
  db.prepare(
    `INSERT INTO products (
       id, shop_id, name, sku, barcode, category_id, brand_id, hsn_code, gst_rate,
       purchase_price, selling_price, mrp, unit, images, low_stock_threshold,
       has_expiry, is_active, description, created_at, updated_at, dirty
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1)`,
  ).run(
    id,
    user.shopId,
    d.name,
    d.sku,
    d.barcode ?? null,
    d.categoryId ?? null,
    d.brandId ?? null,
    d.hsnCode ?? null,
    d.gstRate,
    d.purchasePrice,
    d.sellingPrice,
    d.mrp ?? null,
    d.unit,
    JSON.stringify(d.images ?? []),
    d.lowStockThreshold,
    d.hasExpiry ? 1 : 0,
    d.isActive ? 1 : 0,
    d.description ?? null,
    now,
    now,
  );

  const row = readById(id)!;
  enqueueOutbox("products", id, "upsert", rowToCloudDoc(row));

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  return { ok: true, id };
}

export async function updateProduct(id: string, form: FormData): Promise<ActionResult> {
  if (!isDesktop()) return updateProductCloud(id, form);

  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };

  const parsed = ProductSchema.safeParse(readForm(form));
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const d = parsed.data;
  const db = getDb();

  const conflicting = db
    .prepare(`SELECT id FROM products WHERE shop_id = ? AND sku = ? AND id != ? AND deleted_at IS NULL`)
    .get(user.shopId, d.sku, id);
  if (conflicting) return { ok: false, error: "SKU already exists" };

  const now = nowMs();
  const result = db
    .prepare(
      `UPDATE products SET
         name = ?, sku = ?, barcode = ?, category_id = ?, brand_id = ?, hsn_code = ?,
         gst_rate = ?, purchase_price = ?, selling_price = ?, mrp = ?, unit = ?,
         images = ?, low_stock_threshold = ?, has_expiry = ?, is_active = ?,
         description = ?, updated_at = ?, dirty = 1
       WHERE id = ? AND shop_id = ? AND deleted_at IS NULL`,
    )
    .run(
      d.name,
      d.sku,
      d.barcode ?? null,
      d.categoryId ?? null,
      d.brandId ?? null,
      d.hsnCode ?? null,
      d.gstRate,
      d.purchasePrice,
      d.sellingPrice,
      d.mrp ?? null,
      d.unit,
      JSON.stringify(d.images ?? []),
      d.lowStockThreshold,
      d.hasExpiry ? 1 : 0,
      d.isActive ? 1 : 0,
      d.description ?? null,
      now,
      id,
      user.shopId,
    );

  if (result.changes === 0) return { ok: false, error: "Product not found" };

  const row = readById(id);
  if (row) enqueueOutbox("products", id, "upsert", rowToCloudDoc(row));

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  return { ok: true, id };
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  if (!isDesktop()) return deleteProductCloud(id);

  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  const db = getDb();
  const now = nowMs();
  const result = db
    .prepare(
      `UPDATE products SET deleted_at = ?, updated_at = ?, dirty = 1
       WHERE id = ? AND shop_id = ? AND deleted_at IS NULL`,
    )
    .run(now, now, id, user.shopId);
  if (result.changes === 0) return { ok: false, error: "Product not found" };
  enqueueOutbox("products", id, "delete", {});
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  return { ok: true };
}

export async function toggleProductActive(id: string, active: boolean): Promise<ActionResult> {
  if (!isDesktop()) return toggleProductActiveCloud(id, active);

  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  const db = getDb();
  const now = nowMs();
  db.prepare(
    `UPDATE products SET is_active = ?, updated_at = ?, dirty = 1
     WHERE id = ? AND shop_id = ?`,
  ).run(active ? 1 : 0, now, id, user.shopId);
  const row = readById(id);
  if (row) enqueueOutbox("products", id, "upsert", rowToCloudDoc(row));
  revalidatePath("/dashboard/products");
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
  if (!isDesktop()) return quickAddProductCloud(input as QuickAddInput);

  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };

  const parsed = QuickAddSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const data = parsed.data;
  const db = getDb();

  const branch = db
    .prepare(`SELECT id FROM branches WHERE id = ? AND shop_id = ? AND is_active = 1`)
    .get(data.branchId, user.shopId);
  if (!branch) return { ok: false, error: "Branch not found" };

  const sku = data.sku || `Q${Date.now().toString(36).toUpperCase()}`;
  const exists = db
    .prepare(`SELECT id FROM products WHERE shop_id = ? AND sku = ? AND deleted_at IS NULL`)
    .get(user.shopId, sku);
  if (exists) return { ok: false, error: "SKU already exists — try a different one" };

  const id = newId();
  const now = nowMs();
  db.prepare(
    `INSERT INTO products (
       id, shop_id, name, sku, unit, selling_price, purchase_price, gst_rate,
       created_at, updated_at, dirty
     ) VALUES (?,?,?,?,?,?,?,?,?,?,1)`,
  ).run(
    id,
    user.shopId,
    data.name,
    sku,
    data.unit,
    data.sellingPrice,
    data.sellingPrice,
    data.gstRate,
    now,
    now,
  );

  // Seed inventory row in every active branch; opening stock only on the chosen one.
  const branches = db
    .prepare(`SELECT id FROM branches WHERE shop_id = ? AND is_active = 1`)
    .all(user.shopId) as Array<{ id: string }>;
  const insertInv = db.prepare(
    `INSERT INTO inventory (id, shop_id, branch_id, product_id, quantity, updated_at, dirty)
     VALUES (?, ?, ?, ?, ?, ?, 1)
     ON CONFLICT(shop_id, branch_id, product_id) DO UPDATE SET
       quantity = excluded.quantity, updated_at = excluded.updated_at, dirty = 1`,
  );
  const invTx = db.transaction(() => {
    for (const b of branches) {
      const qty = b.id === data.branchId ? data.openingStock : 0;
      insertInv.run(newId(), user.shopId, b.id, id, qty, now);
    }
  });
  invTx();

  const row = readById(id)!;
  enqueueOutbox("products", id, "upsert", rowToCloudDoc(row));

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/pos");

  return {
    ok: true,
    product: {
      id,
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
