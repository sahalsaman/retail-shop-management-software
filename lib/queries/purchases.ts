import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Purchase } from "@/models";

export type PurchaseListItem = {
  id: string;
  invoiceNumber: string;
  supplierName: string;
  total: number;
  paidAmount: number;
  dueAmount: number;
  status: "PENDING" | "PARTIAL" | "PAID" | "RETURNED";
  itemCount: number;
  createdAt: Date;
};

export async function listPurchases(
  shopIdStr: string,
  filters: {
    search?: string;
    status?: "all" | "PENDING" | "PARTIAL" | "PAID";
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{
  items: PurchaseListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  await connectDB();
  const shopId = new Types.ObjectId(shopIdStr);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 25));

  const q: Record<string, unknown> = { shopId };
  if (filters.status && filters.status !== "all") q.status = filters.status;
  if (filters.search?.trim()) {
    const re = new RegExp(escapeRegex(filters.search.trim()), "i");
    q.invoiceNumber = re;
  }

  const [docs, total] = await Promise.all([
    Purchase.find(q)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate("supplierId", "name")
      .lean<
        Array<{
          _id: Types.ObjectId;
          invoiceNumber: string;
          total: number;
          paidAmount: number;
          dueAmount: number;
          status: PurchaseListItem["status"];
          items: Array<unknown>;
          supplierId: { name: string } | null;
          createdAt: Date;
        }>
      >(),
    Purchase.countDocuments(q),
  ]);

  return {
    items: docs.map((p) => ({
      id: String(p._id),
      invoiceNumber: p.invoiceNumber,
      supplierName: p.supplierId?.name ?? "—",
      total: p.total,
      paidAmount: p.paidAmount,
      dueAmount: p.dueAmount,
      status: p.status,
      itemCount: p.items.length,
      createdAt: p.createdAt,
    })),
    total,
    page,
    pageSize,
  };
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
