import { Package } from "lucide-react";
import { getCurrentUser } from "@/lib/dal";
import { listProducts, type ProductListFilters } from "@/lib/queries/products";
import { listCategories } from "@/lib/queries/categories";
import { listBrands } from "@/lib/queries/brands";
import { isGstEnabled } from "@/lib/queries/shop";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR } from "@/lib/format";
import { ProductsToolbar } from "@/components/dashboard/products/products-toolbar";
import { ProductFormSheet } from "@/components/dashboard/products/product-form-sheet";
import { DeleteProductButton } from "@/components/dashboard/products/delete-product-button";
import { ManageTaxonomiesDialog } from "@/components/dashboard/products/manage-taxonomies-dialog";
import { PaginationControls } from "@/components/dashboard/pagination-controls";
import Image from "next/image";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ProductsPage({ searchParams }: { searchParams: SP }) {
  const user = await getCurrentUser();
  if (!user.shopId) {
    return <p className="text-sm text-muted-foreground">No shop linked.</p>;
  }

  const sp = await searchParams;
  const pickStr = (k: string) =>
    typeof sp[k] === "string" ? (sp[k] as string) : undefined;

  const filters: ProductListFilters = {
    search: pickStr("q"),
    categoryId: pickStr("category"),
    brandId: pickStr("brand"),
    status: (pickStr("status") as ProductListFilters["status"]) ?? "active",
    page: Number(pickStr("page") ?? "1") || 1,
    pageSize: 20,
  };

  const [list, categories, brands, gstEnabled] = await Promise.all([
    listProducts(user.shopId, filters),
    listCategories(user.shopId),
    listBrands(user.shopId),
    isGstEnabled(user.shopId),
  ]);

  const exportParams = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") exportParams.set(k, String(v));
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-sm text-muted-foreground">
            Catalog with pricing, GST and stock thresholds.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ManageTaxonomiesDialog
            kind="category"
            triggerLabel="Categories"
            items={categories}
          />
          <ManageTaxonomiesDialog
            kind="brand"
            triggerLabel="Brands"
            items={brands}
          />
          <a
            href={`/api/products/export?${exportParams.toString()}`}
            className="inline-flex items-center justify-center h-10 rounded-lg border bg-background px-4 text-sm font-medium hover:bg-muted"
          >
            Export CSV
          </a>
          <ProductFormSheet
            mode="create"
            categories={categories}
            brands={brands}
            gstEnabled={gstEnabled}
          />
        </div>
      </header>

      <ProductsToolbar categories={categories} brands={brands} />

      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Selling</TableHead>
              <TableHead className="text-right">Purchase</TableHead>
              {gstEnabled && <TableHead className="text-right">GST</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead className="text-right w-32">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={gstEnabled ? 8 : 7} className="py-12 text-center">
                  <Package className="mx-auto h-8 w-8 text-muted-foreground/60" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    No products found.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              list.items.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="flex items-center">
                      <Image className="mr-3 rounded-sm"
                        src={p.images[0] ?? "https://img.freepik.com/premium-vector/image-icon-design-vector-template_1309674-943.jpg"}
                        alt={p.name}
                        width={35}
                        height={35}
                      />
                      <span className="font-medium">{p.name}</span>
                    </div>
                    {p.brand && (
                      <div className="text-xs text-muted-foreground">
                        {p.brand.name}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.category?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatINR(p.sellingPrice)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {formatINR(p.purchasePrice)}
                  </TableCell>
                  {gstEnabled && (
                    <TableCell className="text-right text-muted-foreground">
                      {p.gstRate}%
                    </TableCell>
                  )}
                  <TableCell>
                    {p.isActive ? (
                      <Badge variant="secondary">Active</Badge>
                    ) : (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex">
                      <ProductFormSheet
                        mode="edit"
                        categories={categories}
                        brands={brands}
                        product={{ ...p, createdAt: p.updatedAt }}
                        gstEnabled={gstEnabled}
                      />
                      <DeleteProductButton id={p.id} name={p.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <PaginationControls
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
      />
    </div>
  );
}
