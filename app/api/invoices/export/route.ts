import { getCurrentUser } from "@/lib/dal";
import { listSales, type SaleListFilters } from "@/lib/queries/sales";
import { csvResponse, toCSV } from "@/lib/csv";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user.shopId) return new Response("No shop", { status: 400 });

  const url = new URL(req.url);
  const sp = url.searchParams;
  const fromStr = sp.get("from");
  const toStr = sp.get("to");

  const filters: SaleListFilters = {
    search: sp.get("q") ?? undefined,
    status: (sp.get("status") as SaleListFilters["status"]) ?? "COMPLETED",
    branchId: sp.get("branch") ?? undefined,
    paymentMethod:
      (sp.get("method") as SaleListFilters["paymentMethod"]) ?? "all",
    due: (sp.get("due") as SaleListFilters["due"]) ?? "all",
    from: fromStr ? new Date(fromStr + "T00:00:00") : undefined,
    to: toStr ? new Date(toStr + "T23:59:59") : undefined,
    page: 1,
    pageSize: 5000,
  };

  const list = await listSales(user.shopId, filters);
  const csv = toCSV(
    list.items.map((s) => ({
      bill: s.billNumber,
      date: s.createdAt,
      customer: s.customerName ?? "Walk-in",
      method: s.paymentMethod,
      items: s.itemCount,
      total: s.total,
      paid: s.paidAmount,
      due: s.dueAmount,
      status: s.status,
    })),
    [
      { key: "bill", header: "Bill #" },
      { key: "date", header: "Date" },
      { key: "customer", header: "Customer" },
      { key: "method", header: "Payment" },
      { key: "items", header: "Items" },
      { key: "total", header: "Total ₹" },
      { key: "paid", header: "Paid ₹" },
      { key: "due", header: "Due ₹" },
      { key: "status", header: "Status" },
    ],
  );

  return csvResponse(`invoices-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
