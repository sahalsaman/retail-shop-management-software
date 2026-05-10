import "server-only";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Branch } from "@/models";

export type BranchListItem = {
  id: string;
  name: string;
  isMain: boolean;
  isActive: boolean;
};

export async function listBranches(shopIdStr: string): Promise<BranchListItem[]> {
  await connectDB();
  const shopId = new Types.ObjectId(shopIdStr);
  const docs = await Branch.find({ shopId, isActive: true })
    .sort({ isMain: -1, name: 1 })
    .lean<
      Array<{ _id: Types.ObjectId; name: string; isMain: boolean; isActive: boolean }>
    >();
  return docs.map((b) => ({
    id: String(b._id),
    name: b.name,
    isMain: !!b.isMain,
    isActive: !!b.isActive,
  }));
}

export async function getDefaultBranchId(
  shopIdStr: string,
  preferredBranchIdStr: string | null,
): Promise<string | null> {
  await connectDB();
  const shopId = new Types.ObjectId(shopIdStr);

  if (preferredBranchIdStr) {
    const exists = await Branch.exists({ _id: preferredBranchIdStr, shopId });
    if (exists) return preferredBranchIdStr;
  }

  const main = await Branch.findOne({ shopId, isMain: true, isActive: true })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();
  if (main) return String(main._id);

  const any = await Branch.findOne({ shopId, isActive: true })
    .select("_id")
    .lean<{ _id: Types.ObjectId } | null>();
  return any ? String(any._id) : null;
}
