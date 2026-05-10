import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Brand } from "@/models";

export type BrandListItem = { id: string; name: string };

export async function listBrands(shopIdStr: string): Promise<BrandListItem[]> {
  await connectDB();
  const shopId = new Types.ObjectId(shopIdStr);
  const docs = await Brand.find({ shopId })
    .sort({ name: 1 })
    .lean<Array<{ _id: Types.ObjectId; name: string }>>();
  return docs.map((b) => ({ id: String(b._id), name: b.name }));
}
