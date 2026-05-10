import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Expense } from "@/models";

export type ExpenseListItem = {
  id: string;
  category: string;
  amount: number;
  paymentMethod: string;
  branchName: string | null;
  date: Date;
  note: string | null;
};

export async function listExpenses(
  shopIdStr: string,
  filters: {
    category?: string;
    from?: Date;
    to?: Date;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<{
  items: ExpenseListItem[];
  total: number;
  totalAmount: number;
  page: number;
  pageSize: number;
}> {
  await connectDB();
  const shopId = new Types.ObjectId(shopIdStr);
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, filters.pageSize ?? 25));

  const q: Record<string, unknown> = { shopId };
  if (filters.category && filters.category !== "all") q.category = filters.category;
  if (filters.from || filters.to) {
    q.date = {} as Record<string, Date>;
    if (filters.from) (q.date as Record<string, Date>).$gte = filters.from;
    if (filters.to) (q.date as Record<string, Date>).$lte = filters.to;
  }

  const [docs, total, sumAgg] = await Promise.all([
    Expense.find(q)
      .sort({ date: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate("branchId", "name")
      .lean<
        Array<{
          _id: Types.ObjectId;
          category: string;
          amount: number;
          paymentMethod: string;
          date: Date;
          note: string | null;
          branchId: { name: string } | null;
        }>
      >(),
    Expense.countDocuments(q),
    Expense.aggregate<{ total: number }>([
      { $match: q },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  return {
    items: docs.map((e) => ({
      id: String(e._id),
      category: e.category,
      amount: e.amount,
      paymentMethod: e.paymentMethod,
      branchName: e.branchId?.name ?? null,
      date: e.date,
      note: e.note,
    })),
    total,
    totalAmount: sumAgg[0]?.total ?? 0,
    page,
    pageSize,
  };
}
