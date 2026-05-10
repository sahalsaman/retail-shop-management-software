import Link from "next/link";
import { Truck, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { listSuppliers } from "@/lib/queries/suppliers";
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
import { CustomerListToolbar } from "@/components/dashboard/people/customer-list-toolbar";
import { PersonFormSheet } from "@/components/dashboard/people/person-form-sheet";
import { createSupplier } from "@/lib/actions/suppliers";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function SuppliersPage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (!user.shopId) {
    return <p className="text-sm text-muted-foreground">No shop linked.</p>;
  }
  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q : undefined;
  const page = Number((typeof sp.page === "string" ? sp.page : "1") || "1");
  const list = await listSuppliers(user.shopId, { search, page, pageSize: 25 });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Suppliers</h1>
          <p className="text-sm text-muted-foreground">
            Vendors who stock your shop. Tracks dues from purchase invoices.
          </p>
        </div>
        <PersonFormSheet
          mode="create"
          kind="supplier"
          onSubmit={createSupplier}
          triggerLabel="Add supplier"
        />
      </header>

      <CustomerListToolbar />

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">You owe</TableHead>
              <TableHead className="text-right">Total purchased</TableHead>
              <TableHead>Last invoice</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <Truck className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm text-muted-foreground">No suppliers yet.</p>
                </TableCell>
              </TableRow>
            ) : (
              list.items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/suppliers/${s.id}`}
                      className="font-medium hover:underline"
                    >
                      {s.name}
                    </Link>
                    {!s.isActive && (
                      <Badge variant="outline" className="ml-2">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{s.phone ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {s.currentBalance > 0 ? (
                      <span className="font-medium text-rose-600 dark:text-rose-400">
                        {formatINR(s.currentBalance)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatINR(s.totalPurchased)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.lastInvoiceAt ? formatDate(s.lastInvoiceAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/suppliers/${s.id}`}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Open"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
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
