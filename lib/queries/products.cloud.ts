import "server-only";
import { Types } from "mongoose";
import { connectCloudDB } from "@/lib/mongoose";
import { Product, Category, Brand } from "@/models";
import type {
  ProductDetail,
  ProductListFilters,
  ProductListItem,
  ProductListResult,
} from "./products";

// Cloud Mongo implementation of the product reads, used by the web build (no
// local SQLite). Mirrors the shapes returned by the SQLite path in products.ts.

type LeanProduct = {
  _id: Types.ObjectId;
  name: string;
  sku: string;
  barcode: string | null;
  hsnCode: string | null;
  gstRate: number;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number | null;
  unit: string;
  images: string[];
  lowStockThreshold: number;
  hasExpiry: boolean;
  isActive: boolean;
  description: string | null;
  categoryId: Types.ObjectId | null;
  brandId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
};

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function nameMaps(shopId: Types.ObjectId) {
  const [cats, brands] = await Promise.all([
    Category.find({ shopId })
      .select("_id name")
      .lean<Array<{ _id: Types.ObjectId; name: string }>>(),
    Brand.find({ shopId })
      .select("_id name")
      .lean<Array<{ _id: Types.ObjectId; name: string }>>(),
  ]);
  return {
    catMap: new Map(cats.map((c) => [String(c._id), c.name])),
    brandMap: new Map(brands.map((b) => [String(b._id), b.name])),
  };
}

function toItem(
  p: LeanProduct,
  catMap: Map<string, string>,
  brandMap: Map<string, string>,
): ProductListItem {
  const images = p.images ?? [];
  const categoryId = p.categoryId ? String(p.categoryId) : null;
  const brandId = p.brandId ? String(p.brandId) : null;
  const categoryName = categoryId ? catMap.get(categoryId) ?? null : null;
  const brandName = brandId ? brandMap.get(brandId) ?? null : null;
  return {
    id: String(p._id),
    name: p.name,
    sku: p.sku,
    barcode: p.barcode ?? null,
    hsnCode: p.hsnCode ?? null,
    gstRate: p.gstRate ?? 0,
    purchasePrice: p.purchasePrice ?? 0,
    sellingPrice: p.sellingPrice ?? 0,
    mrp: p.mrp ?? null,
    unit: p.unit ?? "PCS",
    lowStockThreshold: p.lowStockThreshold ?? 5,
    hasExpiry: !!p.hasExpiry,
    isActive: !!p.isActive,
    category: categoryId && categoryName ? { id: categoryId, name: categoryName } : null,
    brand: brandId && brandName ? { id: brandId, name: brandName } : null,
    imageUrl: images[0] ?? null,
    images,
    description: p.description ?? null,
    categoryId,
    brandId,
    updatedAt: p.updatedAt ?? new Date(0),
  };
}

export async function listProductsCloud(
  shopIdStr: string,
  filters: ProductListFilters = {},
): Promise<ProductListResult> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 20));
  await connectCloudDB();
  const shopId = new Types.ObjectId(shopIdStr);

  const query: Record<string, unknown> = { shopId };
  if (filters.status === "active") query.isActive = true;
  else if (filters.status === "inactive") query.isActive = false;
  if (filters.categoryId && Types.ObjectId.isValid(filters.categoryId)) {
    query.categoryId = new Types.ObjectId(filters.categoryId);
  }
  if (filters.brandId && Types.ObjectId.isValid(filters.brandId)) {
    query.brandId = new Types.ObjectId(filters.brandId);
  }
  if (filters.search?.trim()) {
    const re = new RegExp(escapeRegex(filters.search.trim()), "i");
    query.$or = [{ name: re }, { sku: re }, { barcode: re }];
  }

  const [total, docs, maps] = await Promise.all([
    Product.countDocuments(query),
    Product.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<LeanProduct[]>(),
    nameMaps(shopId),
  ]);

  return {
    items: docs.map((d) => toItem(d, maps.catMap, maps.brandMap)),
    total,
    page,
    pageSize,
  };
}

export async function getProductCloud(
  shopIdStr: string,
  productId: string,
): Promise<ProductDetail | null> {
  if (!Types.ObjectId.isValid(productId)) return null;
  await connectCloudDB();
  const shopId = new Types.ObjectId(shopIdStr);
  const doc = await Product.findOne({
    _id: new Types.ObjectId(productId),
    shopId,
  }).lean<LeanProduct | null>();
  if (!doc) return null;
  const maps = await nameMaps(shopId);
  return {
    ...toItem(doc, maps.catMap, maps.brandMap),
    createdAt: doc.createdAt ?? new Date(0),
  };
}
