import { Types } from "mongoose";
import { getCurrentUser } from "@/lib/dal";
import { connectDB } from "@/lib/mongoose";
import { Product, Inventory } from "@/models";

// GET /api/products/search?q=...&branch=...&limit=20
// Looks up products by name / sku / barcode within the user's shop, and
// returns the available stock at the chosen branch so POS can prevent
// over-selling without an extra round trip.
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user.shopId) return new Response("No shop", { status: 400 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const branchId = url.searchParams.get("branch");
  const limit = Math.min(50, Number(url.searchParams.get("limit") ?? "15"));

  if (!q || !branchId || !Types.ObjectId.isValid(branchId)) {
    return Response.json({ items: [] });
  }

  await connectDB();
  const re = new RegExp(escapeRegex(q), "i");

  const products = await Product.find({
    shopId: user.shopId,
    isActive: true,
    $or: [{ sku: re }, { barcode: re }, { name: re }],
  })
    .limit(limit)
    .select("_id name sku barcode unit gstRate sellingPrice mrp")
    .lean<
      Array<{
        _id: Types.ObjectId;
        name: string;
        sku: string;
        barcode: string | null;
        unit: string;
        gstRate: number;
        sellingPrice: number;
        mrp: number | null;
      }>
    >();

  const ids = products.map((p) => p._id);
  const stocks = await Inventory.find({
    shopId: user.shopId,
    branchId,
    productId: { $in: ids },
  })
    .select("productId quantity")
    .lean<Array<{ productId: Types.ObjectId; quantity: number }>>();

  const stockMap = new Map<string, number>();
  for (const s of stocks) stockMap.set(String(s.productId), s.quantity);

  return Response.json({
    items: products.map((p) => ({
      id: String(p._id),
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      unit: p.unit,
      gstRate: p.gstRate,
      sellingPrice: p.sellingPrice,
      mrp: p.mrp,
      stock: stockMap.get(String(p._id)) ?? 0,
    })),
  });
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
