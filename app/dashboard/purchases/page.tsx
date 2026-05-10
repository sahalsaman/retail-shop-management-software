import Link from "next/link";
import { Receipt, Plus } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { listPurchases } from "@/lib/queries/purchases";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, formatDate } from "@/lib/format";
import { PaginationControls } from "@/components/dashboard/pagination-controls";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function PurchasesPage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (!user.shopId) {
    return <p className="text-sm text-muted-foreground">No shop linked.</p>;
  }
  const sp = await searchParams;
  const list = await listPurchases(user.shopId, {
    search: typeof sp.q === "string" ? sp.q : undefined,
    status:
      (typeof sp.status === "string" ? sp.status : undefined) as
        | "all"
        | "PENDING"
        | "PARTIAL"
        | "PAID"
        | undefined ?? "all",
    page: Number((typeof sp.page === "string" ? sp.page : "1") || "1"),
    pageSize: 25,
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Purchases</h1>
          <p className="text-sm text-muted-foreground">
            Supplier invoices that stocked up your inventory.
          </p>
        </div>
        <Link
          href="/dashboard/purchases/new"
          className="inline-flex items-center justify-center h-8 rounded-lg bg-primary text-primary-foreground px-2.5 text-sm font-medium gap-1.5 hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New invoice
        </Link>
      </header>

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Items</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <Receipt className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No purchases recorded yet.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              list.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">
                    {p.invoiceNumber}
                  </TableCell>
                  <TableCell className="font-medium">{p.supplierName}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(p.createdAt)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatINR(p.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.dueAmount > 0 ? (
                      <span className="text-rose-600 dark:text-rose-400 font-medium">
                        {formatINR(p.dueAmount)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <PurchaseStatus status={p.status} />
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {p.itemCount}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls page={list.page} pageSize={list.pageSize} total={list.total} />
    </div>
  );
}

function PurchaseStatus({ status }: { status: "PENDING" | "PARTIAL" | "PAID" | "RETURNED" }) {
  const map = {
    PAID: <Badge variant="secondary">Paid</Badge>,
    PARTIAL: (
      <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
        Partial
      </Badge>
    ),
    PENDING: (
      <Badge variant="outline" className="border-rose-500/40 text-rose-700 dark:text-rose-300">
        Pending
      </Badge>
    ),
    RETURNED: <Badge variant="outline">Returned</Badge>,
  } as const;
  return map[status] ?? null;
}
