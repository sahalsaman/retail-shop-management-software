import { Types } from "mongoose";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { connectDB } from "@/lib/mongoose";
import { Shop, Branch } from "@/models";
import { getPrinterSettings, isGstEnabled } from "@/lib/queries/shop";
import { ThermalReceipt } from "@/components/dashboard/pos/thermal-receipt";

/**
 * Preview the thermal template using sample data and the current settings —
 * useful while a shop is calibrating paper width / header / footer without
 * needing to run a real sale through.
 */
export default async function ThermalPreviewPage() {
  const user = await getCurrentUser();
  if (!user.shopId) redirect("/dashboard");

  await connectDB();
  const [shop, branchDoc, printer, gstEnabled] = await Promise.all([
    Shop.findById(user.shopId)
      .select("name gstin")
      .lean<{ _id: Types.ObjectId; name: string; gstin: string | null } | null>(),
    Branch.findOne({ shopId: user.shopId, isActive: true })
      .sort({ isMain: -1, createdAt: 1 })
      .select("_id name address phone gstin")
      .lean<{
        _id: Types.ObjectId;
        name: string;
        address: string | null;
        phone: string | null;
        gstin: string | null;
      } | null>(),
    getPrinterSettings(user.shopId),
    isGstEnabled(user.shopId),
  ]);

  const sample = {
    _id: new Types.ObjectId(),
    billNumber: "INV-PREVIEW",
    items: [
      {
        productId: new Types.ObjectId(),
        name: "Basmati Rice 5kg",
        sku: "BSM-RIC-5KG",
        hsnCode: "1006",
        quantity: 1,
        unit: "PCS",
        unitPrice: 580,
        discount: 0,
        gstRate: 5,
        taxAmount: 27.62,
        total: 580,
      },
      {
        productId: new Types.ObjectId(),
        name: "Surf Excel 1kg",
        sku: "SRF-EXC-1KG",
        hsnCode: "3402",
        quantity: 2,
        unit: "PCS",
        unitPrice: 215,
        discount: 10,
        gstRate: 18,
        taxAmount: 75.6,
        total: 495.6,
      },
    ],
    subtotal: 1080,
    discount: 10,
    cgst: 51.6,
    sgst: 51.6,
    igst: 0,
    totalTax: 103.22,
    roundOff: 0.4,
    total: 1075.6,
    paymentMethod: "CASH",
    paidAmount: 1080,
    dueAmount: 0,
    status: "COMPLETED",
    notes: null,
    customerId: null,
    branchId: {
      _id: branchDoc?._id ?? new Types.ObjectId(),
      name: branchDoc?.name ?? shop?.name ?? "Main Branch",
      address: branchDoc?.address ?? null,
      phone: branchDoc?.phone ?? null,
      gstin: branchDoc?.gstin ?? shop?.gstin ?? null,
    },
    cashierId: { _id: new Types.ObjectId(), name: user.name },
    createdAt: new Date(),
  };

  return (
    <ThermalReceipt
      sale={sample}
      printer={printer}
      gstEnabled={gstEnabled}
      autoPrint={false}
      isPreview
    />
  );
}
