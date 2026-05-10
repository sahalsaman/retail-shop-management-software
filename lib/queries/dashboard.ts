import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Sale, Product, Inventory, Payment } from "@/models";

function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d = new Date()) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return x;
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
};

export async function getDashboardSummary(shopIdStr: string): Promise<DashboardSummary> {
  await connectDB();
  const shopId = new Types.ObjectId(shopIdStr);
  const today = startOfDay();
  const month = startOfMonth();
  const sevenDaysAgo = startOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

  const [
    todayAgg,
    monthAgg,
    totalProducts,
    lowStockAgg,
    pendingAgg,
    recent,
    topAgg,
    revenueAgg,
  ] = await Promise.all([
    Sale.aggregate<{ total: number; count: number }>([
      { $match: { shopId, status: "COMPLETED", createdAt: { $gte: today } } },
      { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
    ]),
    Sale.aggregate<{ total: number }>([
      { $match: { shopId, status: "COMPLETED", createdAt: { $gte: month } } },
      { $group: { _id: null, total: { $sum: "$total" } } },
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
  ]);

  // build 7-day series with zero-fill
  const series: Array<{ date: string; total: number }> = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const hit = revenueAgg.find((r) => r._id === key);
    series.push({ date: key, total: hit?.total ?? 0 });
  }

  return {
    todaySales: todayAgg[0]?.total ?? 0,
    todayBills: todayAgg[0]?.count ?? 0,
    monthlySales: monthAgg[0]?.total ?? 0,
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
  };
}

void Payment;
