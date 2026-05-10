import { Types } from "mongoose";
import { getCurrentUser } from "@/lib/dal";
import { connectDB } from "@/lib/mongoose";
import { Supplier } from "@/models";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user.shopId) return new Response("No shop", { status: 400 });
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return Response.json({ items: [] });

  await connectDB();
  const re = new RegExp(escapeRegex(q), "i");
  const docs = await Supplier.find({
    shopId: user.shopId,
    isActive: true,
    $or: [{ name: re }, { phone: re }],
  })
    .limit(10)
    .select("_id name phone gstin")
    .lean<
      Array<{
        _id: Types.ObjectId;
        name: string;
        phone: string | null;
        gstin: string | null;
      }>
    >();

  return Response.json({
    items: docs.map((s) => ({
      id: String(s._id),
      name: s.name,
      phone: s.phone,
      gstin: s.gstin,
    })),
  });
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
