import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Supplier, Purchase, Payment } from "@/models";

export type SupplierListItem = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  currentBalance: number;
  isActive: boolean;
  totalPurchased: number;
  lastInvoiceAt: Date | null;
};

export async function listSuppliers(
  shopIdStr: string,
  filters: { search?: string; page?: number; pageSize?: number } = {},
): Promise<{
  items: SupplierListItem[];
  total: number;
  page: number;
  pageSize: number;
}> {
  await connectDB();
  const shopId = new Types.ObjectId(shopIdStr);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 25));

  const q: Record<string, unknown> = { shopId };
  if (filters.search?.trim()) {
    const re = new RegExp(escapeRegex(filters.search.trim()), "i");
    q.$or = [{ name: re }, { phone: re }, { email: re }];
  }

  const [docs, total] = await Promise.all([
    Supplier.find(q)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<
        Array<{
          _id: Types.ObjectId;
          name: string;
          phone: string | null;
          email: string | null;
          gstin: string | null;
          currentBalance: number;
          isActive: boolean;
        }>
      >(),
    Supplier.countDocuments(q),
  ]);

  const ids = docs.map((c) => c._id);
  const stats = await Purchase.aggregate<{
    _id: Types.ObjectId;
    total: number;
    last: Date;
  }>([
    { $match: { shopId, supplierId: { $in: ids } } },
    {
      $group: {
        _id: "$supplierId",
        total: { $sum: "$total" },
        last: { $max: "$createdAt" },
      },
    },
  ]);
  const statMap = new Map(stats.map((s) => [String(s._id), s]));

  return {
    items: docs.map((s) => {
      const stat = statMap.get(String(s._id));
      return {
        id: String(s._id),
        name: s.name,
        phone: s.phone,
        email: s.email,
        gstin: s.gstin,
        currentBalance: s.currentBalance,
        isActive: s.isActive,
        totalPurchased: stat?.total ?? 0,
        lastInvoiceAt: stat?.last ?? null,
      };
    }),
    total,
    page,
    pageSize,
  };
}

export async function getSupplierLedger(
  shopIdStr: string,
  supplierIdStr: string,
) {
  await connectDB();
  if (!Types.ObjectId.isValid(supplierIdStr))
    return { supplier: null, entries: [] };

  const sup = await Supplier.findOne({
    _id: supplierIdStr,
    shopId: shopIdStr,
  }).lean<{
    _id: Types.ObjectId;
    name: string;
    phone: string | null;
    email: string | null;
    gstin: string | null;
    address: string | null;
    currentBalance: number;
  } | null>();
  if (!sup) return { supplier: null, entries: [] };

  const [purchases, payments] = await Promise.all([
    Purchase.find({ shopId: shopIdStr, supplierId: supplierIdStr })
      .select("invoiceNumber total paidAmount status createdAt")
      .lean<
        Array<{
          _id: Types.ObjectId;
          invoiceNumber: string;
          total: number;
          paidAmount: number;
          status: string;
          createdAt: Date;
        }>
      >(),
    Payment.find({ shopId: shopIdStr, supplierId: supplierIdStr })
      .lean<
        Array<{
          _id: Types.ObjectId;
          amount: number;
          method: string;
          date: Date;
          note: string | null;
          type: string;
        }>
      >(),
  ]);

  type Entry = {
    id: string;
    date: Date;
    type: "PURCHASE" | "PAYMENT";
    description: string;
    debit: number;
    credit: number;
    balance: number;
  };

  const merged: Array<Omit<Entry, "balance">> = [
    ...purchases.map((p) => ({
      id: String(p._id),
      date: p.createdAt,
      type: "PURCHASE" as const,
      description: `Invoice ${p.invoiceNumber}`,
      debit: 0,
      credit: p.total,
    })),
    ...payments.map((p) => ({
      id: String(p._id),
      date: p.date,
      type: "PAYMENT" as const,
      description: `Payment paid (${p.method})${p.note ? ` — ${p.note}` : ""}`,
      debit: p.amount,
      credit: 0,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = 0;
  const entries: Entry[] = merged.map((m) => {
    balance += m.credit - m.debit;
    return { ...m, balance };
  });

  return {
    supplier: {
      id: String(sup._id),
      name: sup.name,
      phone: sup.phone,
      email: sup.email,
      gstin: sup.gstin,
      address: sup.address,
      currentBalance: sup.currentBalance,
    },
    entries: entries.reverse(),
  };
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
