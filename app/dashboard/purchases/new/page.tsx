import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Types } from "mongoose";
import { getCurrentUser } from "@/lib/dal";
import { listBranches, getDefaultBranchId } from "@/lib/queries/branches";
import { isGstEnabled } from "@/lib/queries/shop";
import { connectDB } from "@/lib/mongoose";
import { Supplier } from "@/models";
import { PurchaseForm } from "@/components/dashboard/purchases/purchase-form";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function NewPurchasePage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (!user.shopId) redirect("/dashboard");

  const [branches, gstEnabled] = await Promise.all([
    listBranches(user.shopId),
    isGstEnabled(user.shopId),
  ]);
  if (branches.length === 0) {
    return (
      <div className="rounded-xl border bg-muted p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No active branches. Create one before recording purchases.
        </p>
      </div>
    );
  }
  const branchId = (await getDefaultBranchId(user.shopId, user.branchId))!;

  const sp = await searchParams;
  const supplierId = typeof sp.supplier === "string" ? sp.supplier : null;
  let initialSupplier: { id: string; name: string; phone: string | null; gstin: string | null } | null = null;
  if (supplierId && Types.ObjectId.isValid(supplierId)) {
    await connectDB();
    const s = await Supplier.findOne({ _id: supplierId, shopId: user.shopId })
      .select("_id name phone gstin")
      .lean<{ _id: Types.ObjectId; name: string; phone: string | null; gstin: string | null } | null>();
    if (s) {
      initialSupplier = { id: String(s._id), name: s.name, phone: s.phone, gstin: s.gstin };
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <Link
          href="/dashboard/purchases"
          className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground gap-0.5"
        >
          <ChevronLeft className="h-3 w-3" />
          Purchases
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New purchase invoice</h1>
        <p className="text-sm text-muted-foreground">
          Stocks up inventory automatically when saved.
        </p>
      </header>
      <PurchaseForm
        branches={branches}
        initialBranchId={branchId}
        initialSupplier={initialSupplier}
        gstEnabled={gstEnabled}
      />
    </div>
  );
}
