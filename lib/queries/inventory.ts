import "server-only";
import { Types, type PipelineStage } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Inventory } from "@/models";

export type InventoryRow = {
  inventoryId: string | null;
  productId: string;
  productName: string;
  sku: string;
  unit: string;
  category: string | null;
  brand: string | null;
  quantity: number;
  lowStockThreshold: number;
  isLow: boolean;
  hasExpiry: boolean;
  isActive: boolean;
  updatedAt: Date | null;
};

export type InventoryListResult = {
  items: InventoryRow[];
  total: number;
  page: number;
  pageSize: number;
  branchId: string;
};

export type InventoryListFilters = {
  search?: string;
  view?: "all" | "low";
  page?: number;
  pageSize?: number;
};

export async function listInventoryForBranch(
  shopIdStr: string,
  branchIdStr: string,
  filters: InventoryListFilters = {},
): Promise<InventoryListResult> {
  await connectDB();
  const shopId = new Types.ObjectId(shopIdStr);
  const branchId = new Types.ObjectId(branchIdStr);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 25));
  const search = filters.search?.trim();

  const pipeline: PipelineStage[] = [
    { $match: { shopId, branchId } },
    {
      $lookup: {
        from: "products",
        localField: "productId",
        foreignField: "_id",
        as: "product",
      },
    },
    { $unwind: "$product" },
    { $match: { "product.shopId": shopId, "product.isActive": true } },
    {
      $lookup: {
        from: "categories",
        localField: "product.categoryId",
        foreignField: "_id",
        as: "category",
      },
    },
    {
      $lookup: {
        from: "brands",
        localField: "product.brandId",
        foreignField: "_id",
        as: "brand",
      },
    },
    {
      $project: {
        _id: 1,
        branchId: 1,
        productId: 1,
        quantity: 1,
        updatedAt: 1,
        product: 1,
        categoryName: { $arrayElemAt: ["$category.name", 0] },
        brandName: { $arrayElemAt: ["$brand.name", 0] },
      },
    },
  ];

  if (search) {
    const re = new RegExp(escapeRegex(search), "i");
    pipeline.push({
      $match: {
        $or: [
          { "product.name": re },
          { "product.sku": re },
          { "product.barcode": re },
        ],
      },
    });
  }

  if (filters.view === "low") {
    pipeline.push({
      $match: {
        $expr: { $lte: ["$quantity", "$product.lowStockThreshold"] },
      },
    });
  }

  pipeline.push({
    $facet: {
      items: [
        { $sort: { "product.name": 1 } },
        { $skip: (page - 1) * pageSize },
        { $limit: pageSize },
      ],
      meta: [{ $count: "total" }],
    },
  });

  const [agg] = await Inventory.aggregate<{
    items: Array<{
      _id: Types.ObjectId;
      productId: Types.ObjectId;
      quantity: number;
      updatedAt: Date | null;
      product: {
        _id: Types.ObjectId;
        name: string;
        sku: string;
        unit: string;
        lowStockThreshold: number;
        hasExpiry: boolean;
        isActive: boolean;
      };
      categoryName: string | null;
      brandName: string | null;
    }>;
    meta: Array<{ total: number }>;
  }>(pipeline);

  const total = agg?.meta?.[0]?.total ?? 0;
  const items: InventoryRow[] = (agg?.items ?? []).map((r) => ({
    inventoryId: String(r._id),
    productId: String(r.productId),
    productName: r.product.name,
    sku: r.product.sku,
    unit: r.product.unit,
    category: r.categoryName ?? null,
    brand: r.brandName ?? null,
    quantity: r.quantity,
    lowStockThreshold: r.product.lowStockThreshold,
    isLow: r.quantity <= r.product.lowStockThreshold,
    hasExpiry: !!r.product.hasExpiry,
    isActive: !!r.product.isActive,
    updatedAt: r.updatedAt ?? null,
  }));

  return { items, total, page, pageSize, branchId: branchIdStr };
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
