import type { Types } from "mongoose";
import { formatINR, formatDateTime } from "@/lib/format";
import type { PrinterSettings } from "@/lib/queries/shop";
import { PrintTrigger } from "@/components/dashboard/pos/print-trigger";

type Sale = {
  _id: Types.ObjectId;
  billNumber: string;
  items: Array<{
    name: string;
    sku: string | null;
    hsnCode: string | null;
    quantity: number;
    unit: string;
    unitPrice: number;
    discount: number;
    gstRate: number;
    taxAmount: number;
    total: number;
  }>;
  subtotal: number;
  discount: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  roundOff: number;
  total: number;
  paymentMethod: string;
  paidAmount: number;
  dueAmount: number;
  notes: string | null;
  customerId:
    | { _id: Types.ObjectId; name: string; phone: string; gstin: string | null }
    | null;
  branchId: {
    _id: Types.ObjectId;
    name: string;
    address: string | null;
    phone: string | null;
    gstin: string | null;
  };
  cashierId: { _id: Types.ObjectId; name: string };
  createdAt: Date;
};

export function ThermalReceipt({
  sale,
  printer,
  gstEnabled,
  autoPrint,
  isPreview = false,
}: {
  sale: Sale;
  printer: PrinterSettings;
  gstEnabled: boolean;
  autoPrint: boolean;
  isPreview?: boolean;
}) {
  const widthMm = printer.paperWidth === "58mm" ? 58 : 80;
  const charWidth = printer.paperWidth === "58mm" ? "10px" : "11px";
  const copies = Math.max(1, Math.min(3, printer.copies));
  const copyLabels = (() => {
    if (copies === 1) return [null];
    if (copies === 2) return ["Customer copy", "Shop copy"];
    return ["Customer copy", "Shop copy", "Accounts copy"];
  })();

  return (
    <div className="bg-muted/30 print:bg-white min-h-screen py-6 print:py-0">
      {autoPrint && !isPreview && <PrintTrigger />}
      <style>{`
        @page {
          size: ${widthMm}mm auto;
          margin: 4mm;
        }
        @media print {
          html, body { background: white !important; }
          .thermal-page-break { page-break-after: always; }
          .thermal-page-break:last-child { page-break-after: auto; }
          .no-print { display: none !important; }
        }
        .thermal-receipt {
          width: ${widthMm}mm;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: ${charWidth};
          line-height: 1.35;
          color: #000;
          background: #fff;
        }
      `}</style>

      {isPreview && (
        <div className="no-print mx-auto mb-4 max-w-md rounded-lg border bg-card px-4 py-2 text-xs text-muted-foreground text-center">
          Preview using sample data · Save settings and reload to refresh
        </div>
      )}

      <div className="mx-auto flex flex-col items-center gap-6 print:gap-0">
        {copyLabels.map((label, idx) => (
          <article
            key={idx}
            className="thermal-receipt thermal-page-break shadow print:shadow-none"
            style={{ padding: "4mm" }}
          >
            <header style={{ textAlign: "center", marginBottom: "2mm" }}>
              <div style={{ fontSize: "13px", fontWeight: 700 }}>
                {sale.branchId.name}
              </div>
              {sale.branchId.address && (
                <div style={{ whiteSpace: "pre-line" }}>{sale.branchId.address}</div>
              )}
              {sale.branchId.phone && <div>Tel: {sale.branchId.phone}</div>}
              {gstEnabled && sale.branchId.gstin && (
                <div>GSTIN: {sale.branchId.gstin}</div>
              )}
              {printer.header && (
                <div style={{ marginTop: "1mm", whiteSpace: "pre-line" }}>
                  {printer.header}
                </div>
              )}
              {label && (
                <div
                  style={{
                    marginTop: "1mm",
                    fontWeight: 700,
                    fontSize: "11px",
                    textTransform: "uppercase",
                  }}
                >
                  *** {label} ***
                </div>
              )}
            </header>

            <Divider />

            <section style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700 }}>{sale.billNumber}</span>
              <span>{formatDateTime(sale.createdAt)}</span>
            </section>
            <section style={{ display: "flex", justifyContent: "space-between" }}>
              <span>
                {sale.customerId ? sale.customerId.name : "Walk-in"}
                {sale.customerId?.phone ? ` · ${sale.customerId.phone}` : ""}
              </span>
              <span>{sale.cashierId.name}</span>
            </section>
            <div style={{ fontWeight: 700, marginTop: "1mm" }}>
              {gstEnabled ? "Tax Invoice" : "Bill of Supply"}
            </div>

            <Divider />

            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", padding: "1px 0" }}>Item</th>
                  <th style={{ textAlign: "right", padding: "1px 0", width: "12mm" }}>
                    Qty
                  </th>
                  <th style={{ textAlign: "right", padding: "1px 0", width: "16mm" }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ padding: "1px 0" }}>
                      <div>{it.name}</div>
                      <div style={{ color: "#444" }}>
                        {it.unit && it.quantity > 0 && (
                          <>
                            {formatINR(it.unitPrice)} × {it.quantity} {it.unit}
                          </>
                        )}
                        {gstEnabled && it.gstRate > 0 ? ` · GST ${it.gstRate}%` : ""}
                        {it.discount > 0 ? ` · -${formatINR(it.discount)}` : ""}
                      </div>
                    </td>
                    <td style={{ textAlign: "right", padding: "1px 0", verticalAlign: "top" }}>
                      {it.quantity}
                    </td>
                    <td style={{ textAlign: "right", padding: "1px 0", verticalAlign: "top" }}>
                      {formatINR(it.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <Divider />

            <Row label="Subtotal">{formatINR(sale.subtotal)}</Row>
            {sale.discount > 0 && (
              <Row label="Discount">-{formatINR(sale.discount)}</Row>
            )}
            {gstEnabled && sale.igst > 0 && (
              <Row label="IGST">{formatINR(sale.igst)}</Row>
            )}
            {gstEnabled && sale.cgst > 0 && (
              <>
                <Row label="CGST">{formatINR(sale.cgst)}</Row>
                <Row label="SGST">{formatINR(sale.sgst)}</Row>
              </>
            )}
            {sale.roundOff !== 0 && (
              <Row label="Round-off">{formatINR(sale.roundOff)}</Row>
            )}

            <Divider />

            <Row label="TOTAL" emphasize>
              {formatINR(sale.total)}
            </Row>
            <Row label={`Paid (${sale.paymentMethod})`}>
              {formatINR(sale.paidAmount)}
            </Row>
            {sale.dueAmount > 0 && (
              <Row label="Balance due" emphasize>
                {formatINR(sale.dueAmount)}
              </Row>
            )}

            <Divider />

            {printer.footer && (
              <div
                style={{
                  marginTop: "1mm",
                  textAlign: "center",
                  whiteSpace: "pre-line",
                }}
              >
                {printer.footer}
              </div>
            )}
            <div style={{ textAlign: "center", marginTop: "2mm", color: "#444" }}>
              Powered by RSMS
            </div>
          </article>
        ))}
      </div>

      {isPreview && (
        <div className="no-print mx-auto mt-6 max-w-md text-center">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center h-9 rounded-lg bg-primary text-primary-foreground px-3 text-sm font-medium"
          >
            Print preview
          </button>
        </div>
      )}
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        borderTop: "1px dashed #000",
        margin: "1mm 0",
      }}
    />
  );
}

function Row({
  label,
  children,
  emphasize,
}: {
  label: string;
  children: React.ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontWeight: emphasize ? 700 : 400,
        fontSize: emphasize ? "12px" : undefined,
        padding: "0.5mm 0",
      }}
    >
      <span>{label}</span>
      <span>{children}</span>
    </div>
  );
}
