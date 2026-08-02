import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Sale, Product, Inventory, Payment, ManualDailySale, Expense } from "@/models";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return x;
}

function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function endOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export type DashboardSummary = {
  todaySales: number;
  todayBills: number;
  monthlySales: number;
  totalProducts: number;
  lowStockCount: number;
  pendingPayments: number;
  recentSales: Array<{
    id: string;
    billNumber: string;
    total: number;
    createdAt: Date;
    customerName: string | null;
  }>;
  topProducts: Array<{ id: string; name: string; quantity: number; revenue: number }>;
  revenue7d: Array<{ date: string; total: number }>;
  calendar: {
    monthKey: string;
    average: number;
    days: Array<{
      date: string;
      day: number;
      billed: number;
      manual: number;
      total: number;
      manualNote: string | null;
      totalExpenses: number;
      expenses: Array<{
        id: string;
        category: string;
        amount: number;
        paymentMethod: string;
        note: string | null;
        branchName: string | null;
      }>;
    }>;
  };
};

export async function getDashboardSummary(
  shopIdStr: string,
  monthKey?: string,
): Promise<DashboardSummary> {
  await connectDB();
  const shopId = new Types.ObjectId(shopIdStr);
  const today = startOfDay();
  const month = startOfMonth();
  const selectedMonth = parseMonthKey(monthKey);
  const selectedMonthStart = startOfMonth(selectedMonth);
  const selectedMonthEnd = endOfMonth(selectedMonth);
  const selectedMonthEndExclusive = new Date(
    selectedMonthEnd.getFullYear(),
    selectedMonthEnd.getMonth(),
    selectedMonthEnd.getDate() + 1,
  );
  const sevenDaysAgo = startOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
  const todayKey = dateKey(today);
  const monthStartKey = dateKey(month);
  const selectedMonthStartKey = dateKey(selectedMonthStart);
  const selectedMonthEndKey = dateKey(selectedMonthEnd);

  const [
    todayAgg,
    todayManualAgg,
    monthAgg,
    monthManualAgg,
    totalProducts,
    lowStockAgg,
    pendingAgg,
    recent,
    topAgg,
    revenueAgg,
    manualRevenueAgg,
    calendarBilledAgg,
    calendarManualDocs,
    calendarExpenseDocs,
  ] = await Promise.all([
    Sale.aggregate<{ total: number; count: number }>([
      { $match: { shopId, status: "COMPLETED", createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
    ]),
    ManualDailySale.aggregate<{ total: number }>([
      { $match: { shopId, dateKey: todayKey } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Sale.aggregate<{ total: number }>([
      { $match: { shopId, status: "COMPLETED", createdAt: { $gte: month } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
    ManualDailySale.aggregate<{ total: number }>([
      { $match: { shopId, dateKey: { $gte: monthStartKey } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Product.countDocuments({ shopId, isActive: true }),
    Inventory.aggregate<{ count: number }>([
      { $match: { shopId } },
      {
        $lookup: {
          from: "products",
          localField: "productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      { $match: { $expr: { $lte: ["$quantity", "$product.lowStockThreshold"] } } },
      { $count: "count" },
    ]),
    Sale.aggregate<{ total: number }>([
      { $match: { shopId, dueAmount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$dueAmount" } } },
    ]),
    Sale.find({ shopId })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("customerId", "name")
      .lean(),
    Sale.aggregate([
      { $match: { shopId, status: "COMPLETED", createdAt: { $gte: month } } },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.productId",
          name: { $first: "$items.name" },
          quantity: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.total" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 5 },
    ]),
    Sale.aggregate<{ _id: string; total: number }>([
      { $match: { shopId, status: "COMPLETED", createdAt: { $gte: sevenDaysAgo } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
          total: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    ManualDailySale.aggregate<{ _id: string; total: number }>([
      { $match: { shopId, dateKey: { $gte: dateKey(sevenDaysAgo) } } },
      { $group: { _id: "$dateKey", total: { $sum: "$amount" } } },
      { $sort: { _id: 1 } },
    ]),
    Sale.aggregate<{ _id: string; total: number }>([
      {
        $match: {
          shopId,
          status: "COMPLETED",
          createdAt: { $gte: selectedMonthStart, $lt: selectedMonthEndExclusive },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" } },
          total: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    ManualDailySale.find({
      shopId,
      dateKey: { $gte: selectedMonthStartKey, $lte: selectedMonthEndKey },
    })
      .sort({ dateKey: 1 })
      .lean<Array<{ dateKey: string; amount: number; note: string | null }>>(),
    Expense.find({
      shopId,
      date: { $gte: selectedMonthStart, $lt: selectedMonthEndExclusive },
    })
      .sort({ date: 1, createdAt: 1 })
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
  ]);

  // build 7-day series with zero-fill
  const series: Array<{ date: string; total: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = dateKey(d);
    const hit = revenueAgg.find((r) => r._id === key);
    const manualHit = manualRevenueAgg.find((r) => r._id === key);
    series.push({ date: key, total: (hit?.total ?? 0) + (manualHit?.total ?? 0) });
  }

  const manualMap = new Map(calendarManualDocs.map((d) => [d.dateKey, d]));
  const expenseMap = new Map<
    string,
    Array<{
      id: string;
      category: string;
      amount: number;
      paymentMethod: string;
      note: string | null;
      branchName: string | null;
    }>
  >();
  calendarExpenseDocs.forEach((e) => {
    const key = dateKey(e.date);
    const list = expenseMap.get(key) ?? [];
    list.push({
      id: String(e._id),
      category: e.category,
      amount: e.amount,
      paymentMethod: e.paymentMethod,
      note: e.note,
      branchName: e.branchId?.name ?? null,
    });
    expenseMap.set(key, list);
  });
  const calendarDays: DashboardSummary["calendar"]["days"] = [];
  for (let day = 1; day <= selectedMonthEnd.getDate(); day++) {
    const d = new Date(selectedMonthStart.getFullYear(), selectedMonthStart.getMonth(), day);
    const key = dateKey(d);
    const billed = calendarBilledAgg.find((r) => r._id === key)?.total ?? 0;
    const manual = manualMap.get(key)?.amount ?? 0;
    const expenses = expenseMap.get(key) ?? [];
    calendarDays.push({
      date: key,
      day,
      billed,
      manual,
      total: billed + manual,
      manualNote: manualMap.get(key)?.note ?? null,
      totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
      expenses,
    });
  }
  const activeDays = calendarDays.filter((d) => d.total > 0);
  const calendarAverage = activeDays.length
    ? activeDays.reduce((sum, d) => sum + d.total, 0) / activeDays.length
    : 0;

  return {
    todaySales: (todayAgg[0]?.total ?? 0) + (todayManualAgg[0]?.total ?? 0),
    todayBills: todayAgg[0]?.count ?? 0,
    monthlySales: (monthAgg[0]?.total ?? 0) + (monthManualAgg[0]?.total ?? 0),
    totalProducts,
    lowStockCount: lowStockAgg[0]?.count ?? 0,
    pendingPayments: pendingAgg[0]?.total ?? 0,
    recentSales: recent.map((s) => ({
      id: String(s._id),
      billNumber: s.billNumber,
      total: s.total,
      createdAt: s.createdAt as Date,
      customerName:
        s.customerId && typeof s.customerId === "object" && "name" in s.customerId
          ? (s.customerId as { name: string }).name
          : null,
    })),
    topProducts: topAgg.map((t: { _id: unknown; name: string; quantity: number; revenue: number }) => ({
      id: String(t._id),
      name: t.name,
      quantity: t.quantity,
      revenue: t.revenue,
    })),
    revenue7d: series,
    calendar: {
      monthKey: `${selectedMonthStart.getFullYear()}-${String(selectedMonthStart.getMonth() + 1).padStart(2, "0")}`,
      average: calendarAverage,
      days: calendarDays,
    },
  };
}

void Payment;

function parseMonthKey(monthKey?: string) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return new Date();
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}
