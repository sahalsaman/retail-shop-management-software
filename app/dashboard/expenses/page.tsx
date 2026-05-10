import { Wallet } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { listExpenses } from "@/lib/queries/expenses";
import { listBranches } from "@/lib/queries/branches";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { formatINR, formatDate } from "@/lib/format";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import { ExpenseFormDialog } from "@/components/dashboard/expenses/expense-form-dialog";
import { DeleteExpenseButton } from "@/components/dashboard/expenses/delete-expense-button";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ExpensesPage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (!user.shopId) {
    return <p className="text-sm text-muted-foreground">No shop linked.</p>;
  }
  const sp = await searchParams;
  const category = typeof sp.category === "string" ? sp.category : undefined;
  const fromStr = typeof sp.from === "string" ? sp.from : undefined;
  const toStr = typeof sp.to === "string" ? sp.to : undefined;
  const page = Number((typeof sp.page === "string" ? sp.page : "1") || "1");

  const [list, branches] = await Promise.all([
    listExpenses(user.shopId, {
      category,
      from: fromStr ? new Date(fromStr) : undefined,
      to: toStr ? new Date(toStr + "T23:59:59") : undefined,
      page,
      pageSize: 25,
    }),
    listBranches(user.shopId),
  ]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-sm text-muted-foreground">
            Operating costs and outflows that aren&apos;t supplier purchases.
          </p>
        </div>
        <ExpenseFormDialog branches={branches} />
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Total in period
            </p>
            <p className="text-2xl font-semibold mt-1">{formatINR(list.totalAmount)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Entries
            </p>
            <p className="text-2xl font-semibold mt-1">{list.total}</p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Note</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <Wallet className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm text-muted-foreground">No expenses recorded.</p>
                </TableCell>
              </TableRow>
            ) : (
              list.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-muted-foreground">
                    {formatDate(e.date)}
                  </TableCell>
                  <TableCell className="font-medium">{e.category}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.branchName ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {e.paymentMethod}
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-xs truncate">
                    {e.note ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatINR(e.amount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DeleteExpenseButton id={e.id} />
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
