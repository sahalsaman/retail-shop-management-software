import "server-only";
import { getDb } from "@/lib/sqlite";
import { isDesktop } from "@/lib/runtime";
import { getProductCloud, listProductsCloud } from "./products.cloud";

export type ProductListItem = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  hsnCode: string | null;
  gstRate: number;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number | null;
  unit: string;
  lowStockThreshold: number;
  hasExpiry: boolean;
  isActive: boolean;
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  imageUrl: string | null;
  images: string[];
  description: string | null;
  categoryId: string | null;
  brandId: string | null;
  updatedAt: Date;
};

export type ProductDetail = ProductListItem & { createdAt: Date };

export type ProductListResult = {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type ProductListFilters = {
  search?: string;
  categoryId?: string;
  brandId?: string;
  status?: "all" | "active" | "inactive";
  page?: number;
  pageSize?: number;
};

type RawRow = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  hsn_code: string | null;
  gst_rate: number;
  purchase_price: number;
  selling_price: number;
  mrp: number | null;
  unit: string;
  low_stock_threshold: number;
  has_expiry: number;
  is_active: number;
  images: string;
  description: string | null;
  category_id: string | null;
  brand_id: string | null;
  category_name: string | null;
  brand_name: string | null;
  updated_at: number;
  created_at: number;
};

function rowToItem(r: RawRow): ProductListItem {
  const images = JSON.parse(r.images || "[]") as string[];
  return {
    id: r.id,
    name: r.name,
    sku: r.sku,
    barcode: r.barcode,
    hsnCode: r.hsn_code,
    gstRate: r.gst_rate,
    purchasePrice: r.purchase_price,
    sellingPrice: r.selling_price,
    mrp: r.mrp,
    unit: r.unit,
    lowStockThreshold: r.low_stock_threshold,
    hasExpiry: !!r.has_expiry,
    isActive: !!r.is_active,
    category: r.category_id && r.category_name ? { id: r.category_id, name: r.category_name } : null,
    brand: r.brand_id && r.brand_name ? { id: r.brand_id, name: r.brand_name } : null,
    imageUrl: images[0] ?? null,
    images,
    description: r.description,
    categoryId: r.category_id,
    brandId: r.brand_id,
    updatedAt: new Date(r.updated_at),
  };
}

export async function listProducts(
  shopId: string,
  filters: ProductListFilters = {},
): Promise<ProductListResult> {
  // Web build has no local SQLite — read straight from cloud Mongo.
  if (!isDesktop()) return listProductsCloud(shopId, filters);

  const db = getDb();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 20));

  const where: string[] = ["p.shop_id = ?", "p.deleted_at IS NULL"];
  const params: Array<string | number> = [shopId];

  if (filters.status === "active") where.push("p.is_active = 1");
  else if (filters.status === "inactive") where.push("p.is_active = 0");
  if (filters.categoryId) {
    where.push("p.category_id = ?");
    params.push(filters.categoryId);
  }
  if (filters.brandId) {
    where.push("p.brand_id = ?");
    params.push(filters.brandId);
  }
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    where.push("(p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)");
    params.push(term, term, term);
  }

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const total = (db
    .prepare(`SELECT COUNT(*) AS n FROM products p ${whereSql}`)
    .get(...params) as { n: number }).n;

  const rows = db
    .prepare(
      `SELECT p.id, p.name, p.sku, p.barcode, p.hsn_code, p.gst_rate, p.purchase_price,
              p.selling_price, p.mrp, p.unit, p.low_stock_threshold, p.has_expiry,
              p.is_active, p.images, p.description, p.category_id, p.brand_id,
              p.updated_at, p.created_at,
              c.name AS category_name, b.name AS brand_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands b ON b.id = p.brand_id
       ${whereSql}
       ORDER BY p.updated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, pageSize, (page - 1) * pageSize) as RawRow[];

  return { items: rows.map(rowToItem), total, page, pageSize };
}

export async function getProduct(shopId: string, productId: string): Promise<ProductDetail | null> {
  if (!isDesktop()) return getProductCloud(shopId, productId);

  const db = getDb();
  const row = db
    .prepare(
      `SELECT p.id, p.name, p.sku, p.barcode, p.hsn_code, p.gst_rate, p.purchase_price,
              p.selling_price, p.mrp, p.unit, p.low_stock_threshold, p.has_expiry,
              p.is_active, p.images, p.description, p.category_id, p.brand_id,
              p.updated_at, p.created_at,
              c.name AS category_name, b.name AS brand_name
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands b ON b.id = p.brand_id
       WHERE p.id = ? AND p.shop_id = ? AND p.deleted_at IS NULL`,
    )
    .get(productId, shopId) as RawRow | undefined;
  if (!row) return null;
  return { ...rowToItem(row), createdAt: new Date(row.created_at) };
}
