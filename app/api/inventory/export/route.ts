import { getCurrentUser } from "@/lib/dal";
import { listInventoryForBranch } from "@/lib/queries/inventory";
import { getDefaultBranchId } from "@/lib/queries/branches";
import { csvResponse, toCSV } from "@/lib/csv";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user.shopId) return new Response("No shop", { status: 400 });

  const url = new URL(req.url);
  const sp = url.searchParams;
  const branchId =
    sp.get("branch") ?? (await getDefaultBranchId(user.shopId, user.branchId));
  if (!branchId) return new Response("No branch", { status: 400 });

  const list = await listInventoryForBranch(user.shopId, branchId, {
    search: sp.get("q") ?? undefined,
    view: (sp.get("view") as "all" | "low") ?? "all",
    page: 1,
    pageSize: 10000,
  });

  const csv = toCSV(
    list.items.map((r) => ({
      product: r.productName,
      sku: r.sku,
      category: r.category ?? "",
      brand: r.brand ?? "",
      quantity: r.quantity,
      unit: r.unit,
      reorderAt: r.lowStockThreshold,
      status: r.isLow ? "LOW" : "OK",
    })),
    [
      { key: "product", header: "Product" },
      { key: "sku", header: "SKU" },
      { key: "category", header: "Category" },
      { key: "brand", header: "Brand" },
      { key: "quantity", header: "Quantity" },
      { key: "unit", header: "Unit" },
      { key: "reorderAt", header: "Reorder At" },
      { key: "status", header: "Status" },
    ],
  );

  return csvResponse(`inventory-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
