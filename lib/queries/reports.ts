import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Sale, Expense, Inventory, Purchase, ManualDailySale } from "@/models";

export type DateRange = { from: Date; to: Date };

export type SalesReport = {
  totalRevenue: number;
  totalTax: number;
  totalDiscount: number;
  totalBills: number;
  byMethod: Array<{ method: string; total: number; count: number }>;
  byDay: Array<{ date: string; billed: number; manual: number; total: number; bills: number }>;
};

function dateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function buildSalesReport(
  shopIdStr: string,
  range: DateRange,
): Promise<SalesReport> {
  await connectDB();
  const shopId = new Types.ObjectId(shopIdStr);
  const match = {
    shopId,
    status: "COMPLETED",
    createdAt: { $gte: range.from, $lte: range.to },
  };
  const fromKey = dateKey(range.from);
  const toKey = dateKey(range.to);

  const [headline, byMethod, manualHeadline, byDay, manualByDay] = await Promise.all([
    Sale.aggregate<{
      revenue: number;
      tax: number;
      discount: number;
      bills: number;
    }>([
      { $match: match },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$total" },
          tax: { $sum: "$totalTax" },
          discount: { $sum: "$discount" },
          bills: { $sum: 1 },
        },
      },
    ]),
    Sale.aggregate<{ _id: string; total: number; count: number }>([
      { $match: match },
      { $group: { _id: "$paymentMethod", total: { $sum: "$total" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]),
    ManualDailySale.aggregate<{ total: number; count: number }>([
      { $match: { shopId, dateKey: { $gte: fromKey, $lte: toKey } } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Sale.aggregate<{ _id: string; total: number; bills: number }>([
      { $match: match },
      {
        $group: {
          _id: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$createdAt",
              timezone: "Asia/Kolkata",
            },
          },
          total: { $sum: "$total" },
          bills: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    ManualDailySale.aggregate<{ _id: string; total: number }>([
      { $match: { shopId, dateKey: { $gte: fromKey, $lte: toKey } } },
      { $group: { _id: "$dateKey", total: { $sum: "$amount" } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const daily = new Map<string, { date: string; billed: number; manual: number; total: number; bills: number }>();
  byDay.forEach((d) => {
    daily.set(d._id, {
      date: d._id,
      billed: d.total,
      manual: 0,
      total: d.total,
      bills: d.bills,
    });
  });
  manualByDay.forEach((d) => {
    const existing = daily.get(d._id) ?? {
      date: d._id,
      billed: 0,
      manual: 0,
      total: 0,
      bills: 0,
    };
    existing.manual += d.total;
    existing.total = existing.billed + existing.manual;
    daily.set(d._id, existing);
  });

  const manualTotal = manualHeadline[0]?.total ?? 0;
  const manualCount = manualHeadline[0]?.count ?? 0;

  return {
    totalRevenue: (headline[0]?.revenue ?? 0) + manualTotal,
    totalTax: headline[0]?.tax ?? 0,
    totalDiscount: headline[0]?.discount ?? 0,
    totalBills: headline[0]?.bills ?? 0,
    byMethod: [
      ...byMethod.map((m) => ({
        method: m._id,
        total: m.total,
        count: m.count,
      })),
      ...(manualCount > 0 ? [{ method: "MANUAL", total: manualTotal, count: manualCount }] : []),
    ],
    byDay: Array.from(daily.values()).sort((a, b) => a.date.localeCompare(b.date)),
  };
}

export type ProfitReport = {
  revenue: number;
  cogs: number;
  expenses: number;
  purchases: number;
  grossProfit: number;
  netProfit: number;
};

export async function buildProfitReport(
  shopIdStr: string,
  range: DateRange,
): Promise<ProfitReport> {
  await connectDB();
  const shopId = new Types.ObjectId(shopIdStr);

  const fromKey = dateKey(range.from);
  const toKey = dateKey(range.to);

  const [salesAgg, manualSalesAgg, expenseAgg, purchaseAgg] = await Promise.all([
    Sale.aggregate<{ revenue: number; cogs: number }>([
      {
        $match: {
          shopId,
          status: "COMPLETED",
          createdAt: { $gte: range.from, $lte: range.to },
        },
      },
      { $unwind: "$items" },
      {
        $lookup: {
          from: "products",
          localField: "items.productId",
          foreignField: "_id",
          as: "product",
        },
      },
      { $unwind: "$product" },
      {
        $group: {
          _id: null,
          revenue: { $sum: "$items.total" },
          cogs: {
            $sum: {
              $multiply: ["$items.quantity", "$product.purchasePrice"],
            },
          },
        },
      },
    ]),
    ManualDailySale.aggregate<{ total: number }>([
      { $match: { shopId, dateKey: { $gte: fromKey, $lte: toKey } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Expense.aggregate<{ total: number }>([
      {
        $match: {
          shopId,
          date: { $gte: range.from, $lte: range.to },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    Purchase.aggregate<{ total: number }>([
      {
        $match: {
          shopId,
          createdAt: { $gte: range.from, $lte: range.to },
        },
      },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
  ]);

  const revenue = (salesAgg[0]?.revenue ?? 0) + (manualSalesAgg[0]?.total ?? 0);
  const cogs = salesAgg[0]?.cogs ?? 0;
  const expenses = expenseAgg[0]?.total ?? 0;
  const purchases = purchaseAgg[0]?.total ?? 0;
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - expenses;
  return { revenue, cogs, expenses, purchases, grossProfit, netProfit };
}

export type GstReport = {
  totalTax: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  byRate: Array<{
    rate: number;
    taxableValue: number;
    tax: number;
  }>;
};

export async function buildGstReport(
  shopIdStr: string,
  range: DateRange,
): Promise<GstReport> {
  await connectDB();
  const shopId = new Types.ObjectId(shopIdStr);
  const match = {
    shopId,
    status: "COMPLETED",
    createdAt: { $gte: range.from, $lte: range.to },
  };

  const [headline, byRate] = await Promise.all([
    Sale.aggregate<{
      totalTax: number;
      totalCgst: number;
      totalSgst: number;
      totalIgst: number;
    }>([
      { $match: match },
      {
        $group: {
          _id: null,
          totalTax: { $sum: "$totalTax" },
          totalCgst: { $sum: "$cgst" },
          totalSgst: { $sum: "$sgst" },
          totalIgst: { $sum: "$igst" },
        },
      },
    ]),
    Sale.aggregate<{ _id: number; taxableValue: number; tax: number }>([
      { $match: match },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.gstRate",
          taxableValue: {
            $sum: {
              $subtract: [
                { $multiply: ["$items.quantity", "$items.unitPrice"] },
                "$items.discount",
              ],
            },
          },
          tax: { $sum: "$items.taxAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  return {
    totalTax: headline[0]?.totalTax ?? 0,
    totalCgst: headline[0]?.totalCgst ?? 0,
    totalSgst: headline[0]?.totalSgst ?? 0,
    totalIgst: headline[0]?.totalIgst ?? 0,
    byRate: byRate.map((r) => ({
      rate: r._id,
      taxableValue: r.taxableValue,
      tax: r.tax,
    })),
  };
}

export type StockValuationReport = {
  branches: Array<{
    branchId: string;
    branchName: string;
    units: number;
    valueAtCost: number;
    valueAtSelling: number;
  }>;
  totalUnits: number;
  totalValueAtCost: number;
  totalValueAtSelling: number;
};

export async function buildStockReport(
  shopIdStr: string,
): Promise<StockValuationReport> {
  await connectDB();
  const shopId = new Types.ObjectId(shopIdStr);
  const agg = await Inventory.aggregate<{
    _id: Types.ObjectId;
    branchName: string;
    units: number;
    valueAtCost: number;
    valueAtSelling: number;
  }>([
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
    {
      $lookup: {
        from: "branches",
        localField: "branchId",
        foreignField: "_id",
        as: "branch",
      },
    },
    { $unwind: "$branch" },
    {
      $group: {
        _id: "$branchId",
        branchName: { $first: "$branch.name" },
        units: { $sum: "$quantity" },
        valueAtCost: {
          $sum: { $multiply: ["$quantity", "$product.purchasePrice"] },
        },
        valueAtSelling: {
          $sum: { $multiply: ["$quantity", "$product.sellingPrice"] },
        },
      },
    },
    { $sort: { branchName: 1 } },
  ]);

  return {
    branches: agg.map((b) => ({
      branchId: String(b._id),
      branchName: b.branchName,
      units: b.units,
      valueAtCost: b.valueAtCost,
      valueAtSelling: b.valueAtSelling,
    })),
    totalUnits: agg.reduce((acc, b) => acc + b.units, 0),
    totalValueAtCost: agg.reduce((acc, b) => acc + b.valueAtCost, 0),
    totalValueAtSelling: agg.reduce((acc, b) => acc + b.valueAtSelling, 0),
  };
}
