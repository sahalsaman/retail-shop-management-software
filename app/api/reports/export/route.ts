import { getCurrentUser } from "@/lib/dal";
import {
  buildSalesReport,
  buildProfitReport,
  buildGstReport,
  buildStockReport,
} from "@/lib/queries/reports";
import { csvResponse, toCSV } from "@/lib/csv";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user.shopId) return new Response("No shop", { status: 400 });

  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "sales";
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const to = toStr ? new Date(toStr + "T23:59:59") : new Date();
  const from = fromStr
    ? new Date(fromStr + "T00:00:00")
    : new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  const range = { from, to };

  if (type === "sales") {
    const r = await buildSalesReport(user.shopId, range);
    const csv = toCSV(
      r.byDay.map((d) => ({
        date: d.date,
        bills: d.bills,
        billed: d.billed,
        manual: d.manual,
        total: d.total,
      })),
      [
        { key: "date", header: "Date" },
        { key: "bills", header: "Bills" },
        { key: "billed", header: "Billed Sales ₹" },
        { key: "manual", header: "Manual Sales ₹" },
        { key: "total", header: "Total ₹" },
      ],
    );
    return csvResponse(`sales-${dateTag(range)}.csv`, csv);
  }

  if (type === "gst") {
    const r = await buildGstReport(user.shopId, range);
    const csv = toCSV(
      r.byRate.map((row) => ({
        rate: `${row.rate}%`,
        taxable: row.taxableValue,
        tax: row.tax,
      })),
      [
        { key: "rate", header: "GST Rate" },
        { key: "taxable", header: "Taxable Value" },
        { key: "tax", header: "Tax Collected" },
      ],
    );
    return csvResponse(`gst-${dateTag(range)}.csv`, csv);
  }

  if (type === "profit") {
    const r = await buildProfitReport(user.shopId, range);
    const csv = toCSV(
      [
        { metric: "Revenue", value: r.revenue },
        { metric: "Cost of goods sold", value: r.cogs },
        { metric: "Gross profit", value: r.grossProfit },
        { metric: "Operating expenses", value: r.expenses },
        { metric: "Purchases", value: r.purchases },
        { metric: "Net profit", value: r.netProfit },
      ],
      [
        { key: "metric", header: "Metric" },
        { key: "value", header: "Amount ₹" },
      ],
    );
    return csvResponse(`profit-${dateTag(range)}.csv`, csv);
  }

  if (type === "stock") {
    const r = await buildStockReport(user.shopId);
    const csv = toCSV(
      r.branches.map((b) => ({
        branch: b.branchName,
        units: b.units,
        valueAtCost: b.valueAtCost,
        valueAtSelling: b.valueAtSelling,
      })),
      [
        { key: "branch", header: "Branch" },
        { key: "units", header: "Units" },
        { key: "valueAtCost", header: "Value at Cost ₹" },
        { key: "valueAtSelling", header: "Value at Selling ₹" },
      ],
    );
    return csvResponse(`stock-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  }

  return new Response("Unknown report", { status: 400 });
}

function dateTag(r: { from: Date; to: Date }) {
  return `${r.from.toISOString().slice(0, 10)}_${r.to.toISOString().slice(0, 10)}`;
}
