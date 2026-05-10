import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { getCurrentUser } from "@/lib/dal";
import { connectDB } from "@/lib/mongoose";
import { Shop } from "@/models";
import { listBranches, getDefaultBranchId } from "@/lib/queries/branches";
import { listHeldSales } from "@/lib/queries/sales";
import { PosApp } from "@/components/dashboard/pos/pos-app";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PosPage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (!user.shopId) redirect("/dashboard");

  const sp = await searchParams;
  const branchParam = typeof sp.branch === "string" ? sp.branch : undefined;

  const [branches, shop] = await Promise.all([
    listBranches(user.shopId),
    (async () => {
      await connectDB();
      return Shop.findById(user.shopId)
        .select("gstin gstEnabled printerEnabled")
        .lean<{
          _id: Types.ObjectId;
          gstin: string | null;
          gstEnabled: boolean | null;
          printerEnabled: boolean | null;
        } | null>();
    })(),
  ]);

  if (branches.length === 0) {
    return (
      <div className="rounded-xl border bg-muted p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No active branches. Create one to start billing.
        </p>
      </div>
    );
  }

  const branchId =
    (branchParam && branches.find((b) => b.id === branchParam)?.id) ??
    (await getDefaultBranchId(user.shopId, user.branchId));

  if (!branchId) redirect("/dashboard");

  const held = await listHeldSales(user.shopId, branchId);

  return (
    <PosApp
      branches={branches}
      initialBranchId={branchId}
      shopGstin={shop?.gstin ?? null}
      shopStateCode={shop?.gstin ? shop.gstin.slice(0, 2) : null}
      gstEnabled={shop?.gstEnabled !== false}
      thermalPrint={!!shop?.printerEnabled}
      heldSales={held}
    />
  );
}
