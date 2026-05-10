import { getCurrentUser } from "@/lib/dal";
import { connectDB } from "@/lib/mongoose";
import { Customer } from "@/models";
import { Types } from "mongoose";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user.shopId) return new Response("No shop", { status: 400 });

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (!q) return Response.json({ items: [] });

  await connectDB();
  const re = new RegExp(escapeRegex(q), "i");
  const docs = await Customer.find({
    shopId: user.shopId,
    isActive: true,
    $or: [{ phone: re }, { name: re }],
  })
    .limit(10)
    .select("_id name phone email creditBalance")
    .lean<
      Array<{
        _id: Types.ObjectId;
        name: string;
        phone: string;
        email: string | null;
        creditBalance: number;
      }>
    >();

  return Response.json({
    items: docs.map((c) => ({
      id: String(c._id),
      name: c.name,
      phone: c.phone,
      email: c.email,
      creditBalance: c.creditBalance,
    })),
  });
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
