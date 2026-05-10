import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { getSaleForPrint } from "@/lib/queries/sales";
import { isGstEnabled } from "@/lib/queries/shop";
import { formatDateTime, formatINR } from "@/lib/format";
import { PrintTrigger } from "@/components/dashboard/pos/print-trigger";

export default async function PrintInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user.shopId) notFound();

  const [sale, gstEnabled] = await Promise.all([
    getSaleForPrint(user.shopId, id),
    isGstEnabled(user.shopId),
  ]);
  if (!sale) notFound();

  return (
    <div className="min-h-screen bg-muted/30 print:bg-white">
      <PrintTrigger />
      <div className="mx-auto max-w-2xl bg-card shadow-sm p-8 print:shadow-none print:p-0 my-8 print:my-0 rounded-2xl print:rounded-none">
        <header className="border-b pb-4 mb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-semibold">{sale.branchId.name}</h1>
              {sale.branchId.address && (
                <p className="text-xs text-muted-foreground whitespace-pre-line">
                  {sale.branchId.address}
                </p>
              )}
              {sale.branchId.phone && (
                <p className="text-xs text-muted-foreground">
                  Tel: {sale.branchId.phone}
                </p>
              )}
              {sale.branchId.gstin && (
                <p className="text-xs text-muted-foreground font-mono">
                  GSTIN: {sale.branchId.gstin}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">
                {gstEnabled ? "Tax Invoice" : "Bill of Supply"}
              </p>
              <p className="text-lg font-semibold font-mono">{sale.billNumber}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(sale.createdAt)}
              </p>
            </div>
          </div>
        </header>

        <section className="mb-4 grid grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-muted-foreground">Customer</p>
            {sale.customerId ? (
              <>
                <p className="font-medium">{sale.customerId.name}</p>
                <p className="text-muted-foreground">{sale.customerId.phone}</p>
                {sale.customerId.gstin && (
                  <p className="font-mono">GSTIN: {sale.customerId.gstin}</p>
                )}
              </>
            ) : (
              <p className="font-medium">Walk-in</p>
            )}
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">Cashier</p>
            <p className="font-medium">{sale.cashierId.name}</p>
          </div>
        </section>

        <table className="w-full text-xs mb-4">
          <thead className="border-y">
            <tr>
              <th className="text-left py-1.5 font-medium">Item</th>
              {gstEnabled && (
                <th className="text-center py-1.5 font-medium">HSN</th>
              )}
              <th className="text-center py-1.5 font-medium">Qty</th>
              <th className="text-right py-1.5 font-medium">Price</th>
              {gstEnabled && (
                <th className="text-right py-1.5 font-medium">GST</th>
              )}
              <th className="text-right py-1.5 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((it, i) => (
              <tr key={i} className="border-b">
                <td className="py-1.5">{it.name}</td>
                {gstEnabled && (
                  <td className="text-center py-1.5 font-mono">{it.hsnCode ?? "—"}</td>
                )}
                <td className="text-center py-1.5">
                  {it.quantity} {it.unit}
                </td>
                <td className="text-right py-1.5">{formatINR(it.unitPrice)}</td>
                {gstEnabled && (
                  <td className="text-right py-1.5">{it.gstRate}%</td>
                )}
                <td className="text-right py-1.5 font-medium">
                  {formatINR(it.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <section className="ml-auto w-72 space-y-1 text-sm">
          <Row label="Subtotal">{formatINR(sale.subtotal)}</Row>
          {sale.discount > 0 && (
            <Row label="Discount">- {formatINR(sale.discount)}</Row>
          )}
          {gstEnabled &&
            (sale.igst > 0 ? (
              <Row label="IGST">{formatINR(sale.igst)}</Row>
            ) : (
              <>
                <Row label="CGST">{formatINR(sale.cgst)}</Row>
                <Row label="SGST">{formatINR(sale.sgst)}</Row>
              </>
            ))}
          {sale.roundOff !== 0 && (
            <Row label="Round-off">{formatINR(sale.roundOff)}</Row>
          )}
          <div className="flex justify-between border-t pt-2 mt-2 text-base font-semibold">
            <span>Grand total</span>
            <span>{formatINR(sale.total)}</span>
          </div>
          <Row label={`Paid (${sale.paymentMethod})`}>
            {formatINR(sale.paidAmount)}
          </Row>
          {sale.dueAmount > 0 && (
            <Row label="Balance due" emphasis>
              {formatINR(sale.dueAmount)}
            </Row>
          )}
        </section>

        <footer className="mt-8 pt-4 border-t text-center text-xs text-muted-foreground">
          Thank you for your purchase. Goods once sold cannot be returned without bill.
        </footer>
      </div>
    </div>
  );
}

function Row({
  label,
  children,
  emphasis,
}: {
  label: string;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={emphasis ? "font-semibold text-destructive" : "font-medium"}>
        {children}
      </span>
    </div>
  );
}
