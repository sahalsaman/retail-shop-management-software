import Link from "next/link";
import {
  AlertTriangle,
  IndianRupee,
  Package,
  Receipt,
  ShoppingCart,
  TrendingUp,
} from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { getDashboardSummary } from "@/lib/queries/dashboard";
import { formatDateTime, formatINR, formatNumber } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user.shopId) {
    return (
      <div className="max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>No shop linked</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Your account isn&apos;t linked to a shop yet. Contact support.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = await getDashboardSummary(user.shopId);

  const stats: Array<{
    label: string;
    value: string;
    sub: string;
    icon: typeof IndianRupee;
    tone?: "warn";
  }> = [
    {
      label: "Today's Sales",
      value: formatINR(summary.todaySales),
      sub: `${summary.todayBills} bills`,
      icon: IndianRupee,
    },
    {
      label: "This Month",
      value: formatINR(summary.monthlySales),
      sub: "Revenue this month",
      icon: TrendingUp,
    },
    {
      label: "Total Products",
      value: formatNumber(summary.totalProducts),
      sub: "Active items",
      icon: Package,
    },
    {
      label: "Low Stock",
      value: formatNumber(summary.lowStockCount),
      sub: "Need restock",
      icon: AlertTriangle,
      tone: summary.lowStockCount > 0 ? "warn" : undefined,
    },
    {
      label: "Pending Payments",
      value: formatINR(summary.pendingPayments),
      sub: "From customers",
      icon: Receipt,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold">KC Bazar</h1>
          {/* <p className="text-sm text-muted-foreground">Here&apos;s what&apos;s happening today.</p> */}
        </div>
        <Button nativeButton={false} render={<Link href="/dashboard/pos" />}>
          <ShoppingCart className="h-4 w-4" />
          New Bill
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
                <Icon
                  className={`h-4 w-4 ${
                    s.tone === "warn" ? "text-amber-500" : "text-muted-foreground"
                  }`}
                />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{s.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Last 7 days revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueBars data={summary.revenue7d} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top products this month</CardTitle>
          </CardHeader>
          <CardContent>
            {summary.topProducts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No sales yet.</p>
            ) : (
              <ul className="space-y-3">
                {summary.topProducts.map((p, i) => (
                  <li key={p.id} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="secondary" className="shrink-0">
                        #{i + 1}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatNumber(p.quantity)} sold
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-medium">{formatINR(p.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent sales</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            nativeButton={false}
            render={<Link href="/dashboard/reports" />}
          >
            View all
          </Button>
        </CardHeader>
        <CardContent>
          {summary.recentSales.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sales yet — head to{" "}
              <Link className="underline" href="/dashboard/pos">
                POS
              </Link>{" "}
              to create your first bill.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground">
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Bill #</th>
                    <th className="text-left py-2 font-medium">Customer</th>
                    <th className="text-left py-2 font-medium">When</th>
                    <th className="text-right py-2 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentSales.map((s) => (
                    <tr key={s.id} className="border-b last:border-0">
                      <td className="py-2 font-medium">{s.billNumber}</td>
                      <td className="py-2 text-muted-foreground">
                        {s.customerName ?? "Walk-in"}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {formatDateTime(s.createdAt)}
                      </td>
                      <td className="py-2 text-right font-medium">{formatINR(s.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RevenueBars({ data }: { data: Array<{ date: string; total: number }> }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="flex items-end gap-2 h-40">
      {data.map((d) => {
        const h = Math.max(2, Math.round((d.total / max) * 100));
        const label = new Date(d.date).toLocaleDateString("en-IN", {
          weekday: "short",
        });
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-primary/80 rounded-sm"
              style={{ height: `${h}%` }}
              title={`${label}: ${formatINR(d.total)}`}
            />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
