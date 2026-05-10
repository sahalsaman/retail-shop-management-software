import { Boxes, AlertTriangle } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { listBranches, getDefaultBranchId } from "@/lib/queries/branches";
import { listInventoryForBranch, type InventoryListFilters } from "@/lib/queries/inventory";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/format";
import { BranchSwitcher } from "@/components/dashboard/inventory/branch-switcher";
import { AdjustStockDialog } from "@/components/dashboard/inventory/adjust-stock-dialog";
import { InventoryToolbar } from "@/components/dashboard/inventory/inventory-toolbar";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function InventoryPage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (!user.shopId) {
    return <p className="text-sm text-muted-foreground">No shop linked.</p>;
  }

  const sp = await searchParams;
  const pickStr = (k: string) =>
    typeof sp[k] === "string" ? (sp[k] as string) : undefined;

  const branches = await listBranches(user.shopId);
  if (branches.length === 0) {
    return (
      <div className="rounded-xl border bg-muted p-8 text-center">
        <Boxes className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          No active branches. Create one to start tracking stock.
        </p>
      </div>
    );
  }

  const branchParam = pickStr("branch");
  const branchId =
    (branchParam && branches.find((b) => b.id === branchParam)?.id) ??
    (await getDefaultBranchId(user.shopId, user.branchId));
  if (!branchId) redirect("/dashboard");

  const filters: InventoryListFilters = {
    search: pickStr("q"),
    view: (pickStr("view") as InventoryListFilters["view"]) ?? "all",
    page: Number(pickStr("page") ?? "1") || 1,
    pageSize: 25,
  };

  const list = await listInventoryForBranch(user.shopId, branchId, filters);

  const exportParams = new URLSearchParams();
  exportParams.set("branch", branchId);
  if (filters.view) exportParams.set("view", filters.view);
  if (filters.search) exportParams.set("q", filters.search);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Inventory</h1>
          <p className="text-sm text-muted-foreground">
            Branch-wise stock view. Adjust quantities with an audit trail.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BranchSwitcher branches={branches} value={branchId} />
          <a
            href={`/api/inventory/export?${exportParams.toString()}`}
            className="inline-flex items-center justify-center h-8 rounded-lg border bg-background px-2.5 text-sm font-medium hover:bg-muted"
          >
            Export CSV
          </a>
        </div>
      </header>

      <InventoryToolbar />

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Reorder at</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right w-32">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <Boxes className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    {filters.view === "low"
                      ? "Nothing low on stock here. Nice."
                      : "No inventory rows yet."}
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              list.items.map((row) => (
                <TableRow key={row.inventoryId ?? row.productId}>
                  <TableCell>
                    <div className="font-medium">{row.productName}</div>
                    {row.brand && (
                      <div className="text-xs text-muted-foreground">
                        {row.brand}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{row.sku}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {row.category ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={
                        row.isLow
                          ? "font-semibold text-amber-600 dark:text-amber-400"
                          : "font-medium"
                      }
                    >
                      {formatNumber(row.quantity)} {row.unit}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatNumber(row.lowStockThreshold)}
                  </TableCell>
                  <TableCell>
                    {row.isLow ? (
                      <Badge
                        variant="outline"
                        className="border-amber-500/40 text-amber-700 dark:text-amber-300"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Low
                      </Badge>
                    ) : (
                      <Badge variant="secondary">OK</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <AdjustStockDialog
                      productId={row.productId}
                      productName={row.productName}
                      branchId={branchId}
                      currentQty={row.quantity}
                      unit={row.unit}
                      hasExpiry={row.hasExpiry}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
      />
    </div>
  );
}
