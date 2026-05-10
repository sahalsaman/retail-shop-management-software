/* eslint-disable no-console */
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { connectDB } from "../lib/mongoose";
import {
  User,
  Shop,
  Branch,
  Category,
  Brand,
  Product,
  Inventory,
  StockMovement,
  Customer,
  Supplier,
  Sale,
  Purchase,
  Expense,
  Payment,
} from "../models";

const RESET = process.argv.includes("--reset");

const DEMO = {
  owner: {
    name: "Sahal Hassan",
    email: "owner@demo.in",
    phone: "9876543210",
    password: "demo1234",
  },
  shop: {
    name: "Sahal Super Market",
    type: "GROCERY" as const,
    gstin: "32ABCDE1234F1Z5",
    address: "MG Road, Kozhikode, Kerala 673001",
    email: "shop@demo.in",
  },
  branches: [
    { name: "Kozhikode (Main)", address: "MG Road, Kozhikode 673001", isMain: true },
    { name: "Thrissur Branch", address: "Round South, Thrissur 680001", isMain: false },
  ],
  cashier: {
    name: "Anu Cashier",
    email: "cashier@demo.in",
    phone: "9876543200",
    password: "demo1234",
  },
};

const CATEGORIES = [
  { name: "Staples", slug: "staples" },
  { name: "Beverages", slug: "beverages" },
  { name: "Dairy & Bakery", slug: "dairy-bakery" },
  { name: "Snacks", slug: "snacks" },
  { name: "Personal Care", slug: "personal-care" },
  { name: "Household", slug: "household" },
  { name: "Stationery", slug: "stationery" },
];

const BRANDS = ["Amul", "Britannia", "Tata", "Parle", "Nestle", "Hindustan Unilever", "Patanjali"];

type ProductSeed = {
  name: string;
  category: string;
  brand?: string;
  hsn: string;
  gst: number;
  purchase: number;
  selling: number;
  mrp: number;
  unit?: string;
  barcode?: string;
  hasExpiry?: boolean;
  lowStock?: number;
};

const PRODUCTS: ProductSeed[] = [
  // Staples
  { name: "Toor Dal 1kg", category: "staples", brand: "Tata", hsn: "0713", gst: 0, purchase: 130, selling: 155, mrp: 165, unit: "KG", hasExpiry: true },
  { name: "Basmati Rice 5kg", category: "staples", brand: "Tata", hsn: "1006", gst: 5, purchase: 480, selling: 560, mrp: 599, hasExpiry: true },
  { name: "Sona Masoori Rice 10kg", category: "staples", hsn: "1006", gst: 5, purchase: 520, selling: 620, mrp: 650, hasExpiry: true },
  { name: "Sugar 1kg", category: "staples", hsn: "1701", gst: 5, purchase: 42, selling: 48, mrp: 50, unit: "KG", hasExpiry: true },
  { name: "Salt 1kg", category: "staples", brand: "Tata", hsn: "2501", gst: 5, purchase: 18, selling: 24, mrp: 26, unit: "KG" },
  { name: "Sunflower Oil 1L", category: "staples", brand: "Patanjali", hsn: "1512", gst: 5, purchase: 130, selling: 145, mrp: 155, unit: "LTR", hasExpiry: true },

  // Beverages
  { name: "Tata Tea 250g", category: "beverages", brand: "Tata", hsn: "0902", gst: 5, purchase: 110, selling: 135, mrp: 140, hasExpiry: true },
  { name: "Nescafe 200g", category: "beverages", brand: "Nestle", hsn: "0901", gst: 5, purchase: 380, selling: 449, mrp: 470, hasExpiry: true },
  { name: "Coca Cola 750ml", category: "beverages", hsn: "2202", gst: 28, purchase: 32, selling: 40, mrp: 45, hasExpiry: true },
  { name: "Bisleri 1L", category: "beverages", hsn: "2201", gst: 18, purchase: 12, selling: 20, mrp: 20 },

  // Dairy & Bakery
  { name: "Amul Milk 1L", category: "dairy-bakery", brand: "Amul", hsn: "0401", gst: 0, purchase: 56, selling: 60, mrp: 60, unit: "LTR", hasExpiry: true, lowStock: 10 },
  { name: "Amul Butter 100g", category: "dairy-bakery", brand: "Amul", hsn: "0405", gst: 12, purchase: 52, selling: 62, mrp: 64, hasExpiry: true },
  { name: "Curd 500g", category: "dairy-bakery", brand: "Amul", hsn: "0403", gst: 5, purchase: 28, selling: 35, mrp: 38, hasExpiry: true },
  { name: "Britannia Bread 400g", category: "dairy-bakery", brand: "Britannia", hsn: "1905", gst: 5, purchase: 38, selling: 50, mrp: 55, hasExpiry: true, lowStock: 8 },

  // Snacks
  { name: "Parle-G Biscuit", category: "snacks", brand: "Parle", hsn: "1905", gst: 18, purchase: 8, selling: 10, mrp: 10, hasExpiry: true },
  { name: "Lays Chips 52g", category: "snacks", hsn: "1905", gst: 12, purchase: 14, selling: 20, mrp: 20, hasExpiry: true },
  { name: "Dairy Milk 50g", category: "snacks", hsn: "1806", gst: 18, purchase: 28, selling: 40, mrp: 45, hasExpiry: true },
  { name: "Maggi 70g", category: "snacks", brand: "Nestle", hsn: "1902", gst: 18, purchase: 11, selling: 14, mrp: 14, hasExpiry: true },

  // Personal Care
  { name: "Lifebuoy Soap 100g", category: "personal-care", brand: "Hindustan Unilever", hsn: "3401", gst: 18, purchase: 22, selling: 30, mrp: 32 },
  { name: "Colgate 100g", category: "personal-care", hsn: "3306", gst: 18, purchase: 55, selling: 75, mrp: 80 },
  { name: "Clinic Plus Shampoo 175ml", category: "personal-care", brand: "Hindustan Unilever", hsn: "3305", gst: 18, purchase: 95, selling: 120, mrp: 130 },

  // Household
  { name: "Surf Excel 1kg", category: "household", brand: "Hindustan Unilever", hsn: "3402", gst: 18, purchase: 145, selling: 175, mrp: 185, lowStock: 6 },
  { name: "Vim Bar 200g", category: "household", brand: "Hindustan Unilever", hsn: "3402", gst: 18, purchase: 18, selling: 24, mrp: 25 },

  // Stationery
  { name: "Classmate Notebook 200pg", category: "stationery", hsn: "4820", gst: 12, purchase: 55, selling: 75, mrp: 80 },
  { name: "Reynolds Pen Blue", category: "stationery", hsn: "9608", gst: 12, purchase: 6, selling: 10, mrp: 10 },
];

const CUSTOMERS = [
  { name: "Anaswara P", phone: "9888777666", email: "anaswara@example.in" },
  { name: "Raghav Menon", phone: "9123456789", email: null },
  { name: "Priya Nair", phone: "9988776655", email: "priya@example.in" },
  { name: "Hareesh K", phone: "9544332211", email: null },
];

const SUPPLIERS = [
  { name: "Kerala Wholesalers", phone: "7012345678", gstin: "32WHOLE1234F1Z5", address: "Cochin Port, Kochi" },
  { name: "Spice Coast Distributors", phone: "9234567812", gstin: "32SPICE1234F1Z5", address: "Mattancherry, Kochi" },
];

function billNumber(seq: number) {
  const yy = String(new Date().getFullYear()).slice(2);
  return `INV${yy}${String(seq).padStart(5, "0")}`;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  console.log("→ Connecting…");
  await connectDB();

  if (RESET) {
    console.log("⚠️  --reset: dropping collections");
    const collections = await mongoose.connection.db!.collections();
    for (const c of collections) {
      await c.deleteMany({});
    }
  }

  console.log("→ Creating owner & shop…");
  const passwordHash = await bcrypt.hash(DEMO.owner.password, 10);

  let owner = await User.findOne({ email: DEMO.owner.email });
  if (!owner) {
    owner = await User.create({
      name: DEMO.owner.name,
      email: DEMO.owner.email,
      phone: DEMO.owner.phone,
      passwordHash,
      role: "OWNER",
    });
  }

  let shop = await Shop.findOne({ ownerId: owner._id });
  if (!shop) {
    shop = await Shop.create({
      name: DEMO.shop.name,
      type: DEMO.shop.type,
      ownerId: owner._id,
      gstin: DEMO.shop.gstin,
      address: DEMO.shop.address,
      phone: DEMO.owner.phone,
      email: DEMO.shop.email,
    });
  }

  const branchDocs = [];
  for (const b of DEMO.branches) {
    let branch = await Branch.findOne({ shopId: shop._id, name: b.name });
    if (!branch) {
      branch = await Branch.create({ shopId: shop._id, ...b });
    }
    branchDocs.push(branch);
  }
  const mainBranch = branchDocs[0];

  if (!owner.shopId) {
    owner.shopId = shop._id;
    owner.branchId = mainBranch._id;
    await owner.save();
  }

  // Cashier
  let cashier = await User.findOne({ email: DEMO.cashier.email });
  if (!cashier) {
    cashier = await User.create({
      name: DEMO.cashier.name,
      email: DEMO.cashier.email,
      phone: DEMO.cashier.phone,
      passwordHash: await bcrypt.hash(DEMO.cashier.password, 10),
      role: "CASHIER",
      shopId: shop._id,
      branchId: mainBranch._id,
    });
  }

  console.log("→ Categories & brands…");
  const catMap = new Map<string, mongoose.Types.ObjectId>();
  for (const c of CATEGORIES) {
    const doc = await Category.findOneAndUpdate(
      { shopId: shop._id, slug: c.slug },
      { $setOnInsert: { name: c.name } },
      { upsert: true, returnDocument: "after" }
    );
    catMap.set(c.slug, doc._id);
  }
  const brandMap = new Map<string, mongoose.Types.ObjectId>();
  for (const name of BRANDS) {
    const doc = await Brand.findOneAndUpdate(
      { shopId: shop._id, name },
      {},
      { upsert: true, returnDocument: "after" }
    );
    brandMap.set(name, doc._id);
  }

  console.log(`→ Products (${PRODUCTS.length})…`);
  const productDocs: Array<{ _id: mongoose.Types.ObjectId; name: string; sku: string; hsn: string; gst: number; selling: number; lowStock: number }> = [];
  for (let i = 0; i < PRODUCTS.length; i++) {
    const p = PRODUCTS[i];
    const sku = `SKU${String(i + 1).padStart(4, "0")}`;
    const doc = await Product.findOneAndUpdate(
      { shopId: shop._id, sku },
      {
        $set: {
          name: p.name,
          categoryId: catMap.get(p.category)!,
          brandId: p.brand ? brandMap.get(p.brand)! : null,
          hsnCode: p.hsn,
          gstRate: p.gst,
          purchasePrice: p.purchase,
          sellingPrice: p.selling,
          mrp: p.mrp,
          unit: p.unit ?? "PCS",
          barcode: p.barcode ?? `890${String(1000000 + i)}`,
          hasExpiry: p.hasExpiry ?? false,
          lowStockThreshold: p.lowStock ?? 5,
          isActive: true,
        },
      },
      { upsert: true, returnDocument: "after" }
    );
    productDocs.push({
      _id: doc._id,
      name: doc.name,
      sku,
      hsn: p.hsn,
      gst: p.gst,
      selling: p.selling,
      lowStock: p.lowStock ?? 5,
    });
  }

  console.log("→ Inventory…");
  for (const p of productDocs) {
    for (const branch of branchDocs) {
      // main branch gets more, second branch gets less; some products are intentionally low.
      const base = branch.isMain ? rand(15, 80) : rand(0, 30);
      const lowOnPurpose = ["Amul Milk 1L", "Britannia Bread 400g", "Surf Excel 1kg"].includes(p.name);
      const qty = lowOnPurpose && branch.isMain ? rand(0, 4) : base;
      await Inventory.findOneAndUpdate(
        { shopId: shop._id, branchId: branch._id, productId: p._id },
        { $set: { quantity: qty } },
        { upsert: true, returnDocument: "after" }
      );
      if (qty > 0) {
        await StockMovement.create({
          shopId: shop._id,
          branchId: branch._id,
          productId: p._id,
          type: "OPENING",
          quantity: qty,
          createdBy: owner._id,
          note: "Opening stock from seed",
        });
      }
    }
  }

  console.log("→ Customers…");
  const customerDocs = [];
  for (const c of CUSTOMERS) {
    const doc = await Customer.findOneAndUpdate(
      { shopId: shop._id, phone: c.phone },
      { $set: { name: c.name, email: c.email } },
      { upsert: true, returnDocument: "after" }
    );
    customerDocs.push(doc);
  }

  console.log("→ Suppliers…");
  const supplierDocs = [];
  for (const s of SUPPLIERS) {
    const doc = await Supplier.findOneAndUpdate(
      { shopId: shop._id, name: s.name },
      { $set: { phone: s.phone, gstin: s.gstin, address: s.address } },
      { upsert: true, returnDocument: "after" }
    );
    supplierDocs.push(doc);
  }

  console.log("→ Sample sales (last 7 days)…");
  // Wipe prior demo sales/payments so re-seeding stays sensible
  await Sale.deleteMany({ shopId: shop._id });
  await Payment.deleteMany({ shopId: shop._id, type: "SALE_RECEIPT" });

  let billSeq = 1;
  for (let day = 6; day >= 0; day--) {
    const billsToday = rand(2, 6);
    for (let b = 0; b < billsToday; b++) {
      const itemCount = rand(2, 6);
      const items = [];
      let subtotal = 0;
      let cgst = 0;
      let sgst = 0;
      const usedIds = new Set<string>();
      for (let k = 0; k < itemCount; k++) {
        let p;
        do {
          p = pick(productDocs);
        } while (usedIds.has(String(p._id)));
        usedIds.add(String(p._id));
        const qty = rand(1, 4);
        const lineSubtotal = p.selling * qty;
        const taxAmount = +((lineSubtotal * p.gst) / 100).toFixed(2);
        const total = +(lineSubtotal + taxAmount).toFixed(2);
        items.push({
          productId: p._id,
          name: p.name,
          sku: p.sku,
          hsnCode: p.hsn,
          quantity: qty,
          unit: "PCS",
          unitPrice: p.selling,
          discount: 0,
          gstRate: p.gst,
          taxAmount,
          total,
        });
        subtotal += lineSubtotal;
        cgst += taxAmount / 2;
        sgst += taxAmount / 2;
      }
      const totalTax = +(cgst + sgst).toFixed(2);
      const total = +(subtotal + totalTax).toFixed(2);
      const paymentMethod = pick(["CASH", "UPI", "CARD", "CASH", "UPI"] as const);
      const customer = Math.random() < 0.5 ? pick(customerDocs) : null;
      const createdAt = new Date(Date.now() - day * 24 * 60 * 60 * 1000 - rand(0, 8) * 60 * 60 * 1000);
      const sale = await Sale.create({
        shopId: shop._id,
        branchId: pick(branchDocs)._id,
        billNumber: billNumber(billSeq++),
        customerId: customer?._id ?? null,
        cashierId: cashier._id,
        items,
        subtotal: +subtotal.toFixed(2),
        discount: 0,
        cgst: +cgst.toFixed(2),
        sgst: +sgst.toFixed(2),
        igst: 0,
        totalTax,
        total,
        paymentMethod,
        paidAmount: total,
        dueAmount: 0,
        status: "COMPLETED",
        createdAt,
        updatedAt: createdAt,
      });
      await Payment.create({
        shopId: shop._id,
        branchId: sale.branchId,
        type: "SALE_RECEIPT",
        refId: sale._id,
        customerId: sale.customerId,
        amount: total,
        method: paymentMethod,
        date: createdAt,
        createdBy: cashier._id,
      });
    }
  }

  console.log("→ Sample purchase + expenses…");
  await Purchase.deleteMany({ shopId: shop._id });
  await Expense.deleteMany({ shopId: shop._id });

  await Purchase.create({
    shopId: shop._id,
    branchId: mainBranch._id,
    invoiceNumber: "PO-2024-001",
    supplierId: supplierDocs[0]._id,
    items: productDocs.slice(0, 5).map((p) => ({
      productId: p._id,
      name: p.name,
      sku: p.sku,
      quantity: 20,
      unit: "PCS",
      unitCost: Math.round(p.selling * 0.8),
      gstRate: p.gst,
      taxAmount: Math.round(p.selling * 0.8 * 20 * (p.gst / 100)),
      total: Math.round(p.selling * 0.8 * 20 * (1 + p.gst / 100)),
    })),
    subtotal: 5000,
    totalTax: 250,
    total: 5250,
    paidAmount: 5250,
    status: "PAID",
    createdBy: owner._id,
  });

  for (const e of [
    { category: "RENT" as const, amount: 25000, note: "Monthly rent — Kozhikode" },
    { category: "ELECTRICITY" as const, amount: 4800, note: "KSEB bill" },
    { category: "SALARY" as const, amount: 35000, note: "Cashier + helper" },
    { category: "INTERNET" as const, amount: 1100, note: "Jio Fiber" },
  ]) {
    await Expense.create({
      shopId: shop._id,
      branchId: mainBranch._id,
      ...e,
      paymentMethod: "CASH",
      createdBy: owner._id,
    });
  }

  console.log("\n✓ Seed complete.");
  console.log("  Owner:    owner@demo.in / demo1234");
  console.log("  Cashier:  cashier@demo.in / demo1234");
  console.log(`  Shop:     ${shop.name}`);
  console.log(`  Branches: ${branchDocs.map((b) => b.name).join(", ")}`);
  console.log(`  Products: ${productDocs.length}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
