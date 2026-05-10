import { Types } from "mongoose";
import { getCurrentUser } from "@/lib/dal";
import { connectDB } from "@/lib/mongoose";
import { Product, Customer } from "@/models";

export type SearchResult = {
  products: Array<{
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    sellingPrice: number;
  }>;
  customers: Array<{
    id: string;
    name: string;
    phone: string;
    creditBalance: number;
  }>;
};

export async function GET(req: Request): Promise<Response> {
  const user = await getCurrentUser();
  if (!user.shopId) return new Response("No shop", { status: 400 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const limit = Math.min(8, Math.max(1, Number(url.searchParams.get("limit") ?? "5")));
  if (!q) {
    return Response.json({ products: [], customers: [] } satisfies SearchResult);
  }

  await connectDB();
  const re = new RegExp(escapeRegex(q), "i");
  const shopId = new Types.ObjectId(user.shopId);

  const [products, customers] = await Promise.all([
    Product.find({
      shopId,
      isActive: true,
      $or: [{ name: re }, { sku: re }, { barcode: re }],
    })
      .limit(limit)
      .select("_id name sku barcode sellingPrice")
      .lean<
        Array<{
          _id: Types.ObjectId;
          name: string;
          sku: string;
          barcode: string | null;
          sellingPrice: number;
        }>
      >(),
    Customer.find({
      shopId,
      isActive: true,
      $or: [{ name: re }, { phone: re }],
    })
      .limit(limit)
      .select("_id name phone creditBalance")
      .lean<
        Array<{
          _id: Types.ObjectId;
          name: string;
          phone: string;
          creditBalance: number;
        }>
      >(),
  ]);

  return Response.json({
    products: products.map((p) => ({
      id: String(p._id),
      name: p.name,
      sku: p.sku,
      barcode: p.barcode,
      sellingPrice: p.sellingPrice,
    })),
    customers: customers.map((c) => ({
      id: String(c._id),
      name: c.name,
      phone: c.phone,
      creditBalance: c.creditBalance,
    })),
  } satisfies SearchResult);
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
