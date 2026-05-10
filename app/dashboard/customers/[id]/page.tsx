import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { getCustomerLedger } from "@/lib/queries/customers";
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
import { recordCustomerPayment } from "@/lib/actions/customers";
import { RecordPaymentDialog } from "@/components/dashboard/people/record-payment-dialog";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user.shopId) notFound();

  const { customer, entries } = await getCustomerLedger(user.shopId, id);
  if (!customer) notFound();

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <Link
            href="/dashboard/customers"
            className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground gap-0.5"
          >
            <ChevronLeft className="h-3 w-3" />
            Customers
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">
            {customer.phone}
            {customer.email ? ` · ${customer.email}` : ""}
            {customer.gstin ? ` · GSTIN ${customer.gstin}` : ""}
          </p>
        </div>
        <RecordPaymentDialog
          refId={customer.id}
          label="Record payment"
          description={`Reduce ${customer.name}'s outstanding balance.`}
          action={recordCustomerPayment}
        />
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Outstanding
            </p>
            <p className="text-2xl font-semibold mt-1">
              {customer.creditBalance > 0 ? (
                <span className="text-amber-600 dark:text-amber-400">
                  {formatINR(customer.creditBalance)}
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
              Bills
            </p>
            <p className="text-2xl font-semibold mt-1">
              {entries.filter((e) => e.type === "BILL").length}
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
                  <Wallet className="mx-auto h-8 w-8 text-muted-foreground/60" />
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
