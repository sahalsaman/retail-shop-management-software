import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { getSaleForPrint } from "@/lib/queries/sales";
import { getPrinterSettings, isGstEnabled } from "@/lib/queries/shop";
import { ThermalReceipt } from "@/components/dashboard/pos/thermal-receipt";

export default async function ThermalPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user.shopId) notFound();

  const [sale, printer, gstEnabled] = await Promise.all([
    getSaleForPrint(user.shopId, id),
    getPrinterSettings(user.shopId),
    isGstEnabled(user.shopId),
  ]);
  if (!sale) notFound();

  return (
    <ThermalReceipt
      sale={sale}
      printer={printer}
      gstEnabled={gstEnabled}
      autoPrint={printer.autoPrint}
    />
  );
}
