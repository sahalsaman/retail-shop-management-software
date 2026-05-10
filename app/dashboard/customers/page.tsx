import Link from "next/link";
import { Users, ChevronRight } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { listCustomers } from "@/lib/queries/customers";
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
import { createCustomer } from "@/lib/actions/customers";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function CustomersPage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (!user.shopId) {
    return <p className="text-sm text-muted-foreground">No shop linked.</p>;
  }
  const sp = await searchParams;
  const search = typeof sp.q === "string" ? sp.q : undefined;
  const page = Number((typeof sp.page === "string" ? sp.page : "1") || "1");

  const list = await listCustomers(user.shopId, { search, page, pageSize: 25 });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Track recurring shoppers and their credit balance.
          </p>
        </div>
        <PersonFormSheet mode="create" kind="customer" onSubmit={createCustomer} triggerLabel="Add customer" />
      </header>

      <CustomerListToolbar />

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead className="text-right">Credit due</TableHead>
              <TableHead className="text-right">Total spent</TableHead>
              <TableHead>Last bill</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <Users className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm text-muted-foreground">No customers yet.</p>
                </TableCell>
              </TableRow>
            ) : (
              list.items.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/dashboard/customers/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.name}
                    </Link>
                    {!c.isActive && (
                      <Badge variant="outline" className="ml-2">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.phone}</TableCell>
                  <TableCell className="text-right">
                    {c.creditBalance > 0 ? (
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        {formatINR(c.creditBalance)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{formatINR(c.totalSpent)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.lastBillAt ? formatDate(c.lastBillAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/dashboard/customers/${c.id}`}
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
