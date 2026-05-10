import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Product } from "@/models";

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

export type ProductDetail = ProductListItem & {
  createdAt: Date;
};

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

type RawListDoc = {
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
  lowStockThreshold: number;
  hasExpiry: boolean;
  isActive: boolean;
  images: string[];
  description: string | null;
  categoryId: { _id: Types.ObjectId; name: string } | null;
  brandId: { _id: Types.ObjectId; name: string } | null;
  updatedAt: Date;
};

function toListItem(p: RawListDoc): ProductListItem {
  return {
    id: String(p._id),
    name: p.name,
    sku: p.sku,
    barcode: p.barcode ?? null,
    hsnCode: p.hsnCode ?? null,
    gstRate: p.gstRate ?? 0,
    purchasePrice: p.purchasePrice,
    sellingPrice: p.sellingPrice,
    mrp: p.mrp ?? null,
    unit: p.unit,
    lowStockThreshold: p.lowStockThreshold,
    hasExpiry: !!p.hasExpiry,
    isActive: !!p.isActive,
    category: p.categoryId
      ? { id: String(p.categoryId._id), name: p.categoryId.name }
      : null,
    brand: p.brandId ? { id: String(p.brandId._id), name: p.brandId.name } : null,
    imageUrl: p.images?.[0] ?? null,
    images: p.images ?? [],
    description: p.description ?? null,
    categoryId: p.categoryId ? String(p.categoryId._id) : null,
    brandId: p.brandId ? String(p.brandId._id) : null,
    updatedAt: p.updatedAt,
  };
}

export async function listProducts(
  shopIdStr: string,
  filters: ProductListFilters = {},
): Promise<ProductListResult> {
  await connectDB();
  const shopId = new Types.ObjectId(shopIdStr);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 20));

  const query: Record<string, unknown> = { shopId };
  if (filters.status === "active") query.isActive = true;
  else if (filters.status === "inactive") query.isActive = false;
  if (filters.categoryId) query.categoryId = new Types.ObjectId(filters.categoryId);
  if (filters.brandId) query.brandId = new Types.ObjectId(filters.brandId);
  if (filters.search?.trim()) {
    const re = new RegExp(escapeRegex(filters.search.trim()), "i");
    query.$or = [{ name: re }, { sku: re }, { barcode: re }];
  }

  const [docs, total] = await Promise.all([
    Product.find(query)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate("categoryId", "name")
      .populate("brandId", "name")
      .lean<RawListDoc[]>(),
    Product.countDocuments(query),
  ]);

  return {
    items: docs.map(toListItem),
    total,
    page,
    pageSize,
  };
}

export async function getProduct(
  shopIdStr: string,
  productIdStr: string,
): Promise<ProductDetail | null> {
  await connectDB();
  if (!Types.ObjectId.isValid(productIdStr)) return null;
  const shopId = new Types.ObjectId(shopIdStr);
  const doc = await Product.findOne({ _id: productIdStr, shopId })
    .populate("categoryId", "name")
    .populate("brandId", "name")
    .lean<RawListDoc & { createdAt: Date }>();
  if (!doc) return null;
  return { ...toListItem(doc), createdAt: doc.createdAt };
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
