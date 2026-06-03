import "server-only";
import { Types } from "mongoose";
import { getDb, getMeta } from "@/lib/sqlite";
import { connectCloudDB } from "@/lib/mongoose";

// Last-write-wins pull, scoped to the logged-in user's shop. Pull state's
// high-water mark is per-collection — when a different shop logs in we wipe
// all sync state alongside the data (see lib/sqlite.ts:wipeTenantData).
//
// Only collections actually migrated to SQLite belong here. Adding one
// before its writer is migrated will silently drop fields.

type Mapper = (cloudDoc: Record<string, unknown>) => {
  table: string;
  id: string;
  row: Record<string, unknown>;
  updatedAt: number;
};

function mapProduct(d: Record<string, unknown>): ReturnType<Mapper> {
  const updatedAt = new Date(
    (d.updatedAt as string | Date | undefined) ?? Date.now(),
  ).getTime();
  return {
    table: "products",
    id: String(d._id),
    row: {
      id: String(d._id),
      shop_id: String(d.shopId ?? ""),
      name: String(d.name ?? ""),
      sku: String(d.sku ?? ""),
      barcode: (d.barcode as string | null) ?? null,
      category_id: d.categoryId ? String(d.categoryId) : null,
      brand_id: d.brandId ? String(d.brandId) : null,
      hsn_code: (d.hsnCode as string | null) ?? null,
      gst_rate: Number(d.gstRate ?? 0),
      purchase_price: Number(d.purchasePrice ?? 0),
      selling_price: Number(d.sellingPrice ?? 0),
      mrp: d.mrp == null ? null : Number(d.mrp),
      unit: String(d.unit ?? "PCS"),
      images: JSON.stringify(Array.isArray(d.images) ? d.images : []),
      low_stock_threshold: Number(d.lowStockThreshold ?? 5),
      has_expiry: d.hasExpiry ? 1 : 0,
      is_active: d.isActive === false ? 0 : 1,
      description: (d.description as string | null) ?? null,
      created_at: new Date(
        (d.createdAt as string | Date | undefined) ?? Date.now(),
      ).getTime(),
      updated_at: updatedAt,
      deleted_at: null,
    },
    updatedAt,
  };
}

const COLLECTIONS: Record<string, { cloudName: string; map: Mapper }> = {
  products: { cloudName: "products", map: mapProduct },
};

// Cloud `shopId` may be an ObjectId (server-created) or a string (desktop-created).
// Match both shapes so the desktop sees its own writes coming back.
function shopFilter(activeShopId: string): Record<string, unknown> {
  const ors: unknown[] = [{ shopId: activeShopId }];
  if (Types.ObjectId.isValid(activeShopId)) {
    ors.push({ shopId: new Types.ObjectId(activeShopId) });
  }
  return { $or: ors };
}

export async function pullAll(): Promise<{ pulled: number; skipped?: string }> {
  const activeShopId = getMeta("active_shop_id");
  if (!activeShopId) return { pulled: 0, skipped: "no active shop" };

  const conn = await connectCloudDB();
  if (!conn) return { pulled: 0, skipped: "cloud unreachable" };
  const cloudDb = conn.connection.db;
  if (!cloudDb) return { pulled: 0, skipped: "no db handle" };

  const db = getDb();
  let pulled = 0;

  for (const [key, { cloudName, map }] of Object.entries(COLLECTIONS)) {
    const stateRow = db
      .prepare(`SELECT last_pulled_at FROM sync_pull_state WHERE collection = ?`)
      .get(key) as { last_pulled_at: number } | undefined;
    const since = stateRow?.last_pulled_at ?? 0;

    const filter = {
      ...shopFilter(activeShopId),
      updatedAt: { $gt: new Date(since) },
    };
    const cursor = cloudDb
      .collection(cloudName)
      .find(filter)
      .sort({ updatedAt: 1 })
      .limit(500);

    const docs = (await cursor.toArray()) as Array<Record<string, unknown>>;
    let high = since;

    const writeTxn = db.transaction((rows: Array<{ row: Record<string, unknown>; updatedAt: number }>) => {
      for (const { row, updatedAt } of rows) {
        const cols = Object.keys(row);
        const placeholders = cols.map(() => "?").join(", ");
        const updates = cols
          .filter((c) => c !== "id")
          .map((c) => `${c} = excluded.${c}`)
          .join(", ");
        const sql = `INSERT INTO products (${cols.join(", ")}, dirty)
                     VALUES (${placeholders}, 0)
                     ON CONFLICT(id) DO UPDATE SET ${updates}, dirty = 0
                     WHERE products.updated_at <= excluded.updated_at AND products.dirty = 0`;
        const values = cols.map((c) => row[c]);
        db.prepare(sql).run(...values);
        if (updatedAt > high) high = updatedAt;
      }
    });

    const mapped = docs.map((d) => map(d));
    if (mapped.length > 0) writeTxn(mapped);
    pulled += mapped.length;

    db.prepare(
      `INSERT INTO sync_pull_state (collection, last_pulled_at)
       VALUES (?, ?)
       ON CONFLICT(collection) DO UPDATE SET last_pulled_at = excluded.last_pulled_at`,
    ).run(key, high);
  }

  return { pulled };
}
