import { getCurrentUser } from "@/lib/dal";
import { listProducts, type ProductListFilters } from "@/lib/queries/products";
import { csvResponse, toCSV } from "@/lib/csv";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user.shopId) return new Response("No shop", { status: 400 });

  const url = new URL(req.url);
  const sp = url.searchParams;
  const filters: ProductListFilters = {
    search: sp.get("search") ?? undefined,
    categoryId: sp.get("categoryId") ?? undefined,
    brandId: sp.get("brandId") ?? undefined,
    status: (sp.get("status") as ProductListFilters["status"]) ?? "all",
    page: 1,
    pageSize: 5000,
  };

  const list = await listProducts(user.shopId, filters);
  const csv = toCSV(
    list.items.map((p) => ({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode ?? "",
      category: p.category?.name ?? "",
      brand: p.brand?.name ?? "",
      hsnCode: p.hsnCode ?? "",
      gstRate: p.gstRate,
      purchasePrice: p.purchasePrice,
      sellingPrice: p.sellingPrice,
      mrp: p.mrp ?? "",
      unit: p.unit,
      lowStockThreshold: p.lowStockThreshold,
      hasExpiry: p.hasExpiry ? "yes" : "no",
      isActive: p.isActive ? "yes" : "no",
    })),
    [
      { key: "name", header: "Name" },
      { key: "sku", header: "SKU" },
      { key: "barcode", header: "Barcode" },
      { key: "category", header: "Category" },
      { key: "brand", header: "Brand" },
      { key: "hsnCode", header: "HSN" },
      { key: "gstRate", header: "GST %" },
      { key: "purchasePrice", header: "Purchase ₹" },
      { key: "sellingPrice", header: "Selling ₹" },
      { key: "mrp", header: "MRP ₹" },
      { key: "unit", header: "Unit" },
      { key: "lowStockThreshold", header: "Reorder At" },
      { key: "hasExpiry", header: "Tracks Expiry" },
      { key: "isActive", header: "Active" },
    ],
  );

  return csvResponse(`products-${new Date().toISOString().slice(0, 10)}.csv`, csv);
}
