import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Customer, Sale, Payment } from "@/models";

export type CustomerListItem = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  gstin: string | null;
  creditBalance: number;
  isActive: boolean;
  totalSpent: number;
  lastBillAt: Date | null;
};

export async function listCustomers(
  shopIdStr: string,
  filters: { search?: string; page?: number; pageSize?: number } = {},
): Promise<{
  items: CustomerListItem[];
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
    Customer.find(q)
      .sort({ updatedAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean<
        Array<{
          _id: Types.ObjectId;
          name: string;
          phone: string;
          email: string | null;
          gstin: string | null;
          creditBalance: number;
          isActive: boolean;
        }>
      >(),
    Customer.countDocuments(q),
  ]);

  const ids = docs.map((c) => c._id);
  const stats = await Sale.aggregate<{
    _id: Types.ObjectId;
    total: number;
    last: Date;
  }>([
    {
      $match: { shopId, customerId: { $in: ids }, status: "COMPLETED" },
    },
    {
      $group: {
        _id: "$customerId",
        total: { $sum: "$total" },
        last: { $max: "$createdAt" },
      },
    },
  ]);
  const statMap = new Map(stats.map((s) => [String(s._id), s]));

  return {
    items: docs.map((c) => {
      const s = statMap.get(String(c._id));
      return {
        id: String(c._id),
        name: c.name,
        phone: c.phone,
        email: c.email,
        gstin: c.gstin,
        creditBalance: c.creditBalance,
        isActive: c.isActive,
        totalSpent: s?.total ?? 0,
        lastBillAt: s?.last ?? null,
      };
    }),
    total,
    page,
    pageSize,
  };
}

export async function getCustomerLedger(
  shopIdStr: string,
  customerIdStr: string,
): Promise<{
  customer: {
    id: string;
    name: string;
    phone: string;
    email: string | null;
    gstin: string | null;
    address: string | null;
    creditBalance: number;
  } | null;
  entries: Array<{
    id: string;
    date: Date;
    type: "BILL" | "PAYMENT";
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
}> {
  await connectDB();
  if (!Types.ObjectId.isValid(customerIdStr))
    return { customer: null, entries: [] };

  const c = await Customer.findOne({ _id: customerIdStr, shopId: shopIdStr })
    .lean<{
      _id: Types.ObjectId;
      name: string;
      phone: string;
      email: string | null;
      gstin: string | null;
      address: string | null;
      creditBalance: number;
    } | null>();
  if (!c) return { customer: null, entries: [] };

  const [sales, payments] = await Promise.all([
    Sale.find({
      shopId: shopIdStr,
      customerId: customerIdStr,
      status: "COMPLETED",
    })
      .select("billNumber total createdAt paymentMethod paidAmount dueAmount")
      .lean<
        Array<{
          _id: Types.ObjectId;
          billNumber: string;
          total: number;
          createdAt: Date;
          paymentMethod: string;
          paidAmount: number;
          dueAmount: number;
        }>
      >(),
    Payment.find({
      shopId: shopIdStr,
      customerId: customerIdStr,
    })
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
    type: "BILL" | "PAYMENT";
    description: string;
    debit: number;
    credit: number;
    balance: number;
  };

  const merged: Array<Omit<Entry, "balance">> = [
    ...sales.map((s) => ({
      id: String(s._id),
      date: s.createdAt,
      type: "BILL" as const,
      description: `Bill ${s.billNumber} (${s.paymentMethod})`,
      debit: s.total,
      credit: s.paidAmount,
    })),
    ...payments.map((p) => ({
      id: String(p._id),
      date: p.date,
      type: "PAYMENT" as const,
      description: `Payment received (${p.method})${p.note ? ` — ${p.note}` : ""}`,
      debit: 0,
      credit: p.amount,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = 0;
  const entries: Entry[] = merged.map((m) => {
    balance += m.debit - m.credit;
    return { ...m, balance };
  });

  return {
    customer: {
      id: String(c._id),
      name: c.name,
      phone: c.phone,
      email: c.email,
      gstin: c.gstin,
      address: c.address,
      creditBalance: c.creditBalance,
    },
    entries: entries.reverse(),
  };
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
