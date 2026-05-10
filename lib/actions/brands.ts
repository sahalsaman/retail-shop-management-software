"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Brand, Product } from "@/models";
import { BrandSchema } from "@/lib/validators";
import { getCurrentUser } from "@/lib/dal";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createBrand(form: FormData | { name: string }): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };

  const raw = form instanceof FormData ? { name: String(form.get("name") ?? "") } : form;
  const parsed = BrandSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectDB();
  try {
    const doc = await Brand.create({ shopId: user.shopId, name: parsed.data.name });
    revalidatePath("/dashboard/products");
    return { ok: true, id: String(doc._id) };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: number }).code === 11000) {
      return { ok: false, error: "Brand already exists" };
    }
    console.error(e);
    return { ok: false, error: "Failed to create brand" };
  }
}

export async function deleteBrand(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };
  await connectDB();
  const inUse = await Product.exists({ shopId: user.shopId, brandId: id });
  if (inUse) return { ok: false, error: "Brand is used by products" };
  await Brand.deleteOne({ _id: id, shopId: user.shopId });
  revalidatePath("/dashboard/products");
  return { ok: true };
}
