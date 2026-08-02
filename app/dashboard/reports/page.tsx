import {
  TrendingUp,
  Receipt,
  Boxes,
  Coins,
} from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import {
  buildSalesReport,
  buildProfitReport,
  buildGstReport,
  buildStockReport,
  type DateRange,
} from "@/lib/queries/reports";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, formatNumber } from "@/lib/format";
import { ReportToolbar } from "@/components/dashboard/reports/report-toolbar";
import { isGstEnabled } from "@/lib/queries/shop";

type SP = Promise<Record<string, string | string[] | undefined>>;

function parseRange(sp: Record<string, string | string[] | undefined>): DateRange {
  const fromStr = typeof sp.from === "string" ? sp.from : null;
  const toStr = typeof sp.to === "string" ? sp.to : null;
  const to = toStr ? new Date(toStr + "T23:59:59") : new Date();
  const from = fromStr
    ? new Date(fromStr + "T00:00:00")
    : new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
  return { from, to };
}

export default async function ReportsPage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (!user.shopId) {
    return <p className="text-sm text-muted-foreground">No shop linked.</p>;
  }
  const sp = await searchParams;
  const range = parseRange(sp);
  const gstEnabled = await isGstEnabled(user.shopId);
  let type = (typeof sp.type === "string" ? sp.type : "sales") as
    | "sales"
    | "profit"
    | "gst"
    | "stock";
  if (type === "gst" && !gstEnabled) type = "sales";

  const exportParams = new URLSearchParams({
    type,
    from: range.from.toISOString().slice(0, 10),
    to: range.to.toISOString().slice(0, 10),
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">
            Sales, profit, GST and stock breakdowns over a date range.
          </p>
        </div>
        <a
          href={`/api/reports/export?${exportParams.toString()}`}
          className="inline-flex items-center justify-center h-8 rounded-lg border bg-background px-2.5 text-sm font-medium hover:bg-muted"
        >
          Export CSV
        </a>
      </header>

      <ReportToolbar gstEnabled={gstEnabled} />

      {type === "sales" && <SalesView shopId={user.shopId} range={range} />}
      {type === "profit" && <ProfitView shopId={user.shopId} range={range} />}
      {type === "gst" && gstEnabled && <GstView shopId={user.shopId} range={range} />}
      {type === "stock" && <StockView shopId={user.shopId} />}
    </div>
  );
}

async function SalesView({ shopId, range }: { shopId: string; range: DateRange }) {
  const r = await buildSalesReport(shopId, range);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={TrendingUp} label="Revenue">
          {formatINR(r.totalRevenue)}
        </Stat>
        <Stat icon={Receipt} label="Bills">
          {formatNumber(r.totalBills)}
        </Stat>
        <Stat icon={Coins} label="Tax collected">
          {formatINR(r.totalTax)}
        </Stat>
        <Stat icon={Coins} label="Discounts">
          {formatINR(r.totalDiscount)}
        </Stat>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <h2 className="text-base font-medium mb-3">By payment method</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Bills</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.byMethod.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                      No data.
                    </TableCell>
                  </TableRow>
                ) : (
                  r.byMethod.map((m) => (
                    <TableRow key={m.method}>
                      <TableCell className="font-medium">{m.method}</TableCell>
                      <TableCell className="text-right">{m.count}</TableCell>
                      <TableCell className="text-right">{formatINR(m.total)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <h2 className="text-base font-medium mb-3">Daily revenue</h2>
            <DailyBars data={r.byDay} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

async function ProfitView({ shopId, range }: { shopId: string; range: DateRange }) {
  const r = await buildProfitReport(shopId, range);
  const margin = r.revenue > 0 ? (r.netProfit / r.revenue) * 100 : 0;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Stat icon={TrendingUp} label="Revenue">
        {formatINR(r.revenue)}
      </Stat>
      <Stat icon={Boxes} label="Cost of goods">
        {formatINR(r.cogs)}
      </Stat>
      <Stat icon={Coins} label="Gross profit">
        {formatINR(r.grossProfit)}
      </Stat>
      <Stat icon={Receipt} label="Operating expenses">
        {formatINR(r.expenses)}
      </Stat>
      <Stat icon={Receipt} label="Purchases (cash out)">
        {formatINR(r.purchases)}
      </Stat>
      <Stat icon={Coins} label={`Net profit · ${margin.toFixed(1)}%`}>
        <span className={r.netProfit >= 0 ? "text-emerald-600" : "text-rose-600"}>
          {formatINR(r.netProfit)}
        </span>
      </Stat>
    </div>
  );
}

async function GstView({ shopId, range }: { shopId: string; range: DateRange }) {
  const r = await buildGstReport(shopId, range);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat icon={Coins} label="Total tax">
          {formatINR(r.totalTax)}
        </Stat>
        <Stat icon={Coins} label="CGST">
          {formatINR(r.totalCgst)}
        </Stat>
        <Stat icon={Coins} label="SGST">
          {formatINR(r.totalSgst)}
        </Stat>
        <Stat icon={Coins} label="IGST">
          {formatINR(r.totalIgst)}
        </Stat>
      </div>
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-base font-medium mb-3">Tax by rate slab</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rate</TableHead>
                <TableHead className="text-right">Taxable value</TableHead>
                <TableHead className="text-right">Tax collected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.byRate.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                    No taxable sales in range.
                  </TableCell>
                </TableRow>
              ) : (
                r.byRate.map((row) => (
                  <TableRow key={row.rate}>
                    <TableCell className="font-medium">{row.rate}%</TableCell>
                    <TableCell className="text-right">{formatINR(row.taxableValue)}</TableCell>
                    <TableCell className="text-right">{formatINR(row.tax)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

async function StockView({ shopId }: { shopId: string }) {
  const r = await buildStockReport(shopId);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat icon={Boxes} label="Units in stock">
          {formatNumber(r.totalUnits)}
        </Stat>
        <Stat icon={Coins} label="Value at cost">
          {formatINR(r.totalValueAtCost)}
        </Stat>
        <Stat icon={Coins} label="Value at selling">
          {formatINR(r.totalValueAtSelling)}
        </Stat>
      </div>
      <Card>
        <CardContent className="pt-6">
          <h2 className="text-base font-medium mb-3">By branch</h2>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead className="text-right">Value at cost</TableHead>
                <TableHead className="text-right">Value at selling</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.branches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                    No stock recorded.
                  </TableCell>
                </TableRow>
              ) : (
                r.branches.map((b) => (
                  <TableRow key={b.branchId}>
                    <TableCell className="font-medium">{b.branchName}</TableCell>
                    <TableCell className="text-right">{formatNumber(b.units)}</TableCell>
                    <TableCell className="text-right">{formatINR(b.valueAtCost)}</TableCell>
                    <TableCell className="text-right">{formatINR(b.valueAtSelling)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof TrendingUp;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6 flex items-start gap-3">
        <span className="grid place-items-center h-9 w-9 rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <p className="text-xl font-semibold mt-0.5">{children}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function DailyBars({
  data,
}: {
  data: Array<{ date: string; billed: number; manual: number; total: number; bills: number }>;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">No sales in range.</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.total));
  return (
    <div className="flex items-end gap-1 h-40">
      {data.map((d) => {
        const h = Math.max(2, Math.round((d.total / max) * 100));
        const date = new Date(d.date);
        const label = date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
        return (
          <div key={d.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div
              className="w-full bg-primary/80 rounded-sm"
              style={{ height: `${h}%` }}
              title={`${label}: ${formatINR(d.total)} (${d.bills} bills, ${formatINR(d.manual)} manual)`}
            />
            <span className="text-[10px] text-muted-foreground truncate">{label}</span>
          </div>
        );
      })}
    </div>
  );
}
