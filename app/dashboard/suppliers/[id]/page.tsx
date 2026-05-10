import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Truck } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { getSupplierLedger } from "@/lib/queries/suppliers";
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
import { recordSupplierPayment } from "@/lib/actions/suppliers";
import { RecordPaymentDialog } from "@/components/dashboard/people/record-payment-dialog";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user.shopId) notFound();

  const { supplier, entries } = await getSupplierLedger(user.shopId, id);
  if (!supplier) notFound();

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <Link
            href="/dashboard/suppliers"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground gap-0.5"
          >
            <ChevronLeft className="h-3 w-3" />
            Suppliers
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{supplier.name}</h1>
          <p className="text-sm text-muted-foreground">
            {supplier.phone ?? "no phone"}
            {supplier.gstin ? ` · GSTIN ${supplier.gstin}` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/dashboard/purchases/new?supplier=${supplier.id}`}
            className="inline-flex items-center justify-center h-8 rounded-lg border bg-background px-2.5 text-sm font-medium hover:bg-muted gap-1.5"
          >
            New invoice
          </Link>
          <RecordPaymentDialog
            refId={supplier.id}
            label="Pay supplier"
            description={`Reduce ${supplier.name}'s outstanding balance.`}
            action={recordSupplierPayment}
          />
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              You owe
            </p>
            <p className="text-2xl font-semibold mt-1">
              {supplier.currentBalance > 0 ? (
                <span className="text-rose-600 dark:text-rose-400">
                  {formatINR(supplier.currentBalance)}
                </span>
              ) : (
                "—"
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Invoices
            </p>
            <p className="text-2xl font-semibold mt-1">
              {entries.filter((e) => e.type === "PURCHASE").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Payments
            </p>
            <p className="text-2xl font-semibold mt-1">
              {entries.filter((e) => e.type === "PAYMENT").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-12 text-center">
                  <Truck className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No transactions yet.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-muted-foreground">
                    {formatDateTime(e.date)}
                  </TableCell>
                  <TableCell>{e.description}</TableCell>
                  <TableCell className="text-right">
                    {e.debit > 0 ? formatINR(e.debit) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {e.credit > 0 ? formatINR(e.credit) : "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatINR(e.balance)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
