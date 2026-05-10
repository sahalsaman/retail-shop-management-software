"use server";

import { revalidatePath } from "next/cache";
import { Types } from "mongoose";
import { connectDB } from "@/lib/mongoose";
import { Category, Product } from "@/models";
import { CategorySchema } from "@/lib/validators";
import { getCurrentUser } from "@/lib/dal";

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function createCategory(form: FormData | { name: string; parent?: string | null }): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };

  const raw =
    form instanceof FormData
      ? { name: String(form.get("name") ?? ""), parent: String(form.get("parent") ?? "") }
      : { name: form.name, parent: form.parent ?? "" };
  const parsed = CategorySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  await connectDB();
  try {
    const doc = await Category.create({
      shopId: user.shopId,
      name: parsed.data.name,
      slug: slugify(parsed.data.name),
      parent: parsed.data.parent ?? null,
    });
    revalidatePath("/dashboard/products");
    return { ok: true, id: String(doc._id) };
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: number }).code === 11000) {
      return { ok: false, error: "Category already exists" };
    }
    console.error(e);
    return { ok: false, error: "Failed to create category" };
  }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user.shopId) return { ok: false, error: "No shop" };
  if (!Types.ObjectId.isValid(id)) return { ok: false, error: "Invalid id" };
  await connectDB();
  const inUse = await Product.exists({ shopId: user.shopId, categoryId: id });
  if (inUse) return { ok: false, error: "Category is used by products" };
  await Category.deleteOne({ _id: id, shopId: user.shopId });
  revalidatePath("/dashboard/products");
  return { ok: true };
}
