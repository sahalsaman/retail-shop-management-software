import "server-only";
import { Types, type PipelineStage } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Sale } from "@/models";

export type SaleListItem = {
  id: string;
  billNumber: string;
  total: number;
  paidAmount: number;
  dueAmount: number;
  status: "COMPLETED" | "HELD" | "RETURNED" | "VOID";
  paymentMethod: string;
  customerName: string | null;
  itemCount: number;
  createdAt: Date;
};

export type SaleListFilters = {
  status?: "all" | "COMPLETED" | "HELD" | "RETURNED" | "VOID";
  branchId?: string;
  paymentMethod?: "all" | "CASH" | "UPI" | "CARD" | "CREDIT";
  search?: string;
  from?: Date;
  to?: Date;
  due?: "all" | "yes" | "no";
  page?: number;
  pageSize?: number;
};

export async function listSales(
  shopIdStr: string,
  filters: SaleListFilters = {},
): Promise<{
  items: SaleListItem[];
  total: number;
  totalRevenue: number;
  totalDue: number;
  page: number;
  pageSize: number;
}> {
  await connectDB();
  const shopId = new Types.ObjectId(shopIdStr);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 25));

  const matchStage: Record<string, unknown> = { shopId };
  if (filters.status && filters.status !== "all") matchStage.status = filters.status;
  if (filters.branchId)
    matchStage.branchId = new Types.ObjectId(filters.branchId);
  if (filters.paymentMethod && filters.paymentMethod !== "all")
    matchStage.paymentMethod = filters.paymentMethod;
  if (filters.due === "yes") matchStage.dueAmount = { $gt: 0 };
  if (filters.due === "no") matchStage.dueAmount = { $lte: 0 };
  if (filters.from || filters.to) {
    matchStage.createdAt = {} as Record<string, Date>;
    if (filters.from) (matchStage.createdAt as Record<string, Date>).$gte = filters.from;
    if (filters.to) (matchStage.createdAt as Record<string, Date>).$lte = filters.to;
  }

  const search = filters.search?.trim();
  const pipeline: PipelineStage[] = [
    { $match: matchStage },
    {
      $lookup: {
        from: "customers",
        localField: "customerId",
        foreignField: "_id",
        as: "customer",
      },
    },
    { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
  ];

  if (search) {
    const re = new RegExp(escapeRegex(search), "i");
    pipeline.push({
      $match: {
        $or: [
          { billNumber: re },
          { "customer.name": re },
          { "customer.phone": re },
        ],
      },
    });
  }

  pipeline.push({
    $facet: {
      items: [
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * pageSize },
        { $limit: pageSize },
        {
          $project: {
            _id: 1,
            billNumber: 1,
            total: 1,
            paidAmount: 1,
            dueAmount: 1,
            status: 1,
            paymentMethod: 1,
            createdAt: 1,
            itemCount: { $size: "$items" },
            customerName: "$customer.name",
          },
        },
      ],
      meta: [
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            totalRevenue: { $sum: "$total" },
            totalDue: { $sum: "$dueAmount" },
          },
        },
      ],
    },
  });

  const [agg] = await Sale.aggregate<{
    items: Array<{
      _id: Types.ObjectId;
      billNumber: string;
      total: number;
      paidAmount: number;
      dueAmount: number;
      status: SaleListItem["status"];
      paymentMethod: string;
      itemCount: number;
      customerName: string | null;
      createdAt: Date;
    }>;
    meta: Array<{ total: number; totalRevenue: number; totalDue: number }>;
  }>(pipeline);

  const meta = agg?.meta?.[0] ?? { total: 0, totalRevenue: 0, totalDue: 0 };
  return {
    items: (agg?.items ?? []).map((s) => ({
      id: String(s._id),
      billNumber: s.billNumber,
      total: s.total,
      paidAmount: s.paidAmount,
      dueAmount: s.dueAmount,
      status: s.status,
      paymentMethod: s.paymentMethod,
      customerName: s.customerName ?? null,
      itemCount: s.itemCount,
      createdAt: s.createdAt,
    })),
    total: meta.total,
    totalRevenue: meta.totalRevenue,
    totalDue: meta.totalDue,
    page,
    pageSize,
  };
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type HeldSale = {
  id: string;
  billNumber: string;
  total: number;
  itemCount: number;
  customerName: string | null;
  createdAt: Date;
  items: Array<{
    productId: string;
    name: string;
    sku: string | null;
    quantity: number;
    unit: string;
    unitPrice: number;
    discount: number;
    gstRate: number;
  }>;
  customerId: string | null;
};

export async function listHeldSales(
  shopIdStr: string,
  branchIdStr: string,
): Promise<HeldSale[]> {
  await connectDB();
  const docs = await Sale.find({
    shopId: shopIdStr,
    branchId: branchIdStr,
    status: "HELD",
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .populate("customerId", "name")
    .lean<
      Array<{
        _id: Types.ObjectId;
        billNumber: string;
        total: number;
        items: HeldSale["items"];
        customerId: { _id: Types.ObjectId; name: string } | null;
        createdAt: Date;
      }>
    >();
  return docs.map((s) => ({
    id: String(s._id),
    billNumber: s.billNumber,
    total: s.total,
    itemCount: s.items.length,
    customerName: s.customerId?.name ?? null,
    createdAt: s.createdAt,
    items: s.items.map((it) => ({
      productId: String(it.productId),
      name: it.name,
      sku: it.sku ?? null,
      quantity: it.quantity,
      unit: it.unit ?? "PCS",
      unitPrice: it.unitPrice,
      discount: it.discount ?? 0,
      gstRate: it.gstRate ?? 0,
    })),
    customerId: s.customerId ? String(s.customerId._id) : null,
  }));
}

export async function getSaleForPrint(
  shopIdStr: string,
  saleIdStr: string,
) {
  await connectDB();
  if (!Types.ObjectId.isValid(saleIdStr)) return null;
  const doc = await Sale.findOne({ _id: saleIdStr, shopId: shopIdStr })
    .populate("customerId", "name phone gstin address")
    .populate("branchId", "name address phone gstin")
    .populate("cashierId", "name")
    .lean<{
      _id: Types.ObjectId;
      billNumber: string;
      items: Array<{
        productId: Types.ObjectId;
        name: string;
        sku: string | null;
        hsnCode: string | null;
        quantity: number;
        unit: string;
        unitPrice: number;
        discount: number;
        gstRate: number;
        taxAmount: number;
        total: number;
      }>;
      subtotal: number;
      discount: number;
      cgst: number;
      sgst: number;
      igst: number;
      totalTax: number;
      roundOff: number;
      total: number;
      paymentMethod: string;
      paidAmount: number;
      dueAmount: number;
      status: string;
      notes: string | null;
      customerId: {
        _id: Types.ObjectId;
        name: string;
        phone: string;
        gstin: string | null;
        address: string | null;
      } | null;
      branchId: {
        _id: Types.ObjectId;
        name: string;
        address: string | null;
        phone: string | null;
        gstin: string | null;
      };
      cashierId: { _id: Types.ObjectId; name: string };
      createdAt: Date;
    } | null>();
  if (!doc) return null;
  return doc;
}
