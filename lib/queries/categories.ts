import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Category } from "@/models";

export type CategoryListItem = {
  id: string;
  name: string;
  slug: string;
  parent: string | null;
};

export async function listCategories(shopIdStr: string): Promise<CategoryListItem[]> {
  await connectDB();
  const shopId = new Types.ObjectId(shopIdStr);
  const docs = await Category.find({ shopId })
    .sort({ name: 1 })
    .lean<
      Array<{
        _id: Types.ObjectId;
        name: string;
        slug: string;
        parent: Types.ObjectId | null;
      }>
    >();
  return docs.map((c) => ({
    id: String(c._id),
    name: c.name,
    slug: c.slug,
    parent: c.parent ? String(c.parent) : null,
  }));
}
