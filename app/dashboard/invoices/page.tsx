import Link from "next/link";
import { Receipt, Download } from "lucide-react";
import { Types } from "mongoose";
import { getCurrentUser } from "@/lib/dal";
import { connectDB } from "@/lib/mongoose";
import { Shop } from "@/models";
import { listSales, type SaleListFilters } from "@/lib/queries/sales";
import { listBranches } from "@/lib/queries/branches";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, formatDateTime } from "@/lib/format";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { InvoicesToolbar } from "@/components/dashboard/invoices/invoices-toolbar";
import { PrintLink } from "@/components/dashboard/invoices/print-link";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function InvoicesPage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (!user.shopId) {
    return <p className="text-sm text-muted-foreground">No shop linked.</p>;
  }

  const sp = await searchParams;
  const pickStr = (k: string) =>
    typeof sp[k] === "string" ? (sp[k] as string) : undefined;

  const fromStr = pickStr("from");
  const toStr = pickStr("to");
  const filters: SaleListFilters = {
    search: pickStr("q"),
    status:
      (pickStr("status") as SaleListFilters["status"]) ?? "COMPLETED",
    branchId: pickStr("branch"),
    paymentMethod: (pickStr("method") as SaleListFilters["paymentMethod"]) ?? "all",
    due: (pickStr("due") as SaleListFilters["due"]) ?? "all",
    from: fromStr ? new Date(fromStr + "T00:00:00") : undefined,
    to: toStr ? new Date(toStr + "T23:59:59") : undefined,
    page: Number(pickStr("page") ?? "1") || 1,
    pageSize: 25,
  };

  const [list, branches, shop] = await Promise.all([
    listSales(user.shopId, filters),
    listBranches(user.shopId),
    (async () => {
      await connectDB();
      return Shop.findById(user.shopId)
        .select("printerEnabled")
        .lean<{ _id: Types.ObjectId; printerEnabled: boolean | null } | null>();
    })(),
  ]);
  const thermal = !!shop?.printerEnabled;

  const exportParams = new URLSearchParams();
  Object.entries({
    q: pickStr("q"),
    status: pickStr("status"),
    branch: pickStr("branch"),
    method: pickStr("method"),
    due: pickStr("due"),
    from: fromStr,
    to: toStr,
  }).forEach(([k, v]) => {
    if (v) exportParams.set(k, v);
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground">
            All sales bills generated from POS — search, filter, reprint.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/invoices/export?${exportParams.toString()}`}
            className="inline-flex items-center gap-1.5 justify-center h-10 rounded-lg border bg-background px-4 text-sm font-medium hover:bg-muted"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
          <Link
            href="/dashboard/pos"
            className="inline-flex items-center justify-center h-10 rounded-lg bg-primary text-primary-foreground px-4 text-sm font-medium hover:bg-primary/90"
          >
            New bill
          </Link>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Bills">{list.total.toLocaleString("en-IN")}</Stat>
        <Stat label="Total revenue">{formatINR(list.totalRevenue)}</Stat>
        <Stat label="Outstanding due" emphasize={list.totalDue > 0}>
          {formatINR(list.totalDue)}
        </Stat>
      </div>

      <InvoicesToolbar branches={branches} />

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill #</TableHead>
              <TableHead>When</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Due</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-12 text-center">
                  <Receipt className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No invoices match these filters.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              list.items.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">
                    <a
                      href={
                        thermal
                          ? `/dashboard/pos/thermal/${s.id}`
                          : `/dashboard/pos/print/${s.id}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:underline font-semibold text-foreground"
                    >
                      {s.billNumber}
                    </a>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(s.createdAt)}
                  </TableCell>
                  <TableCell>
                    {s.customerName ? (
                      <span className="font-medium">{s.customerName}</span>
                    ) : (
                      <span className="text-muted-foreground">Walk-in</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {s.itemCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {s.paymentMethod}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatINR(s.total)}
                  </TableCell>
                  <TableCell className="text-right">
                    {s.dueAmount > 0 ? (
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        {formatINR(s.dueAmount)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <SaleStatus status={s.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <PrintLink saleId={s.id} thermal={thermal} />
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

function Stat({
  label,
  children,
  emphasize,
}: {
  label: string;
  children: React.ReactNode;
  emphasize?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-xs text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
        <p
          className={`text-2xl font-semibold mt-1 ${
            emphasize ? "text-amber-600 dark:text-amber-400" : ""
          }`}
        >
          {children}
        </p>
      </CardContent>
    </Card>
  );
}

function SaleStatus({
  status,
}: {
  status: "COMPLETED" | "HELD" | "RETURNED" | "VOID";
}) {
  const map = {
    COMPLETED: <Badge variant="secondary">Completed</Badge>,
    HELD: (
      <Badge
        variant="outline"
        className="border-amber-500/40 text-amber-700 dark:text-amber-300"
      >
        Held
      </Badge>
    ),
    RETURNED: (
      <Badge
        variant="outline"
        className="border-rose-500/40 text-rose-700 dark:text-rose-300"
      >
        Returned
      </Badge>
    ),
    VOID: <Badge variant="outline">Void</Badge>,
  } as const;
  return map[status] ?? null;
}
