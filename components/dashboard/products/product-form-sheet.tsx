"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { createProduct, updateProduct } from "@/lib/actions/products";
import type { ProductDetail } from "@/lib/queries/products";
import type { CategoryListItem } from "@/lib/queries/categories";
import type { BrandListItem } from "@/lib/queries/brands";

type Props = {
  mode: "create" | "edit";
  categories: CategoryListItem[];
  brands: BrandListItem[];
  product?: ProductDetail;
  triggerLabel?: string;
  gstEnabled?: boolean;
};

export function ProductFormSheet({
  mode,
  categories,
  brands,
  product,
  triggerLabel,
  gstEnabled = true,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res =
        mode === "create"
          ? await createProduct(fd)
          : await updateProduct(product!.id, fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(mode === "create" ? "Product created" : "Product updated");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            size={mode === "create" ? "default" : "icon-sm"}
            variant={mode === "create" ? "default" : "ghost"}
            aria-label={mode === "edit" ? "Edit product" : undefined}
          >
            {mode === "create" ? (
              <>
                <Plus className="h-4 w-4" />
                {triggerLabel ?? "New Product"}
              </>
            ) : (
              <Pencil className="h-4 w-4" />
            )}
          </Button>
        }
      />
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col p-0 gap-0"
      >
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{mode === "create" ? "Add product" : "Edit product"}</SheetTitle>
          <SheetDescription>
            {mode === "create"
              ? "Catalog details, pricing, GST and stock thresholds."
              : `Update ${product?.name}.`}
          </SheetDescription>
        </SheetHeader>

        <form
          id="product-form"
          onSubmit={onSubmit}
          className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
        >
          <Field label="Product name" required>
            <Input
              name="name"
              required
              defaultValue={product?.name ?? ""}
              placeholder="e.g. Basmati Rice 5kg"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU" required>
              <Input
                name="sku"
                required
                defaultValue={product?.sku ?? ""}
                placeholder="BSM-RIC-5KG"
              />
            </Field>
            <Field label="Barcode">
              <Input
                name="barcode"
                defaultValue={product?.barcode ?? ""}
                placeholder="EAN/UPC"
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select name="categoryId" defaultValue={product?.categoryId ?? ""}>
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Brand">
              <Select name="brandId" defaultValue={product?.brandId ?? ""}>
                <option value="">— None —</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {gstEnabled ? (
            <div className="grid grid-cols-3 gap-3">
              <Field label="HSN">
                <Input
                  name="hsnCode"
                  defaultValue={product?.hsnCode ?? ""}
                  placeholder="e.g. 1006"
                />
              </Field>
              <Field label="GST %">
                <Input
                  name="gstRate"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max="100"
                  defaultValue={product?.gstRate ?? 0}
                />
              </Field>
              <Field label="Unit">
                <Input
                  name="unit"
                  defaultValue={product?.unit ?? "PCS"}
                  placeholder="PCS / KG / LTR"
                />
              </Field>
            </div>
          ) : (
            <Field label="Unit">
              <Input
                name="unit"
                defaultValue={product?.unit ?? "PCS"}
                placeholder="PCS / KG / LTR"
              />
            </Field>
          )}
          {/* Preserve any existing HSN/GST in DB while GST is off so re-enabling restores them */}
          {!gstEnabled && (
            <>
              <input type="hidden" name="hsnCode" value={product?.hsnCode ?? ""} />
              <input type="hidden" name="gstRate" value={product?.gstRate ?? 0} />
            </>
          )}

          <div className="grid grid-cols-3 gap-3">
            <Field label="Purchase ₹" required>
              <Input
                name="purchasePrice"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                required
                defaultValue={product?.purchasePrice ?? ""}
              />
            </Field>
            <Field label="Selling ₹" required>
              <Input
                name="sellingPrice"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                required
                defaultValue={product?.sellingPrice ?? ""}
              />
            </Field>
            <Field label="MRP ₹">
              <Input
                name="mrp"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                defaultValue={product?.mrp ?? ""}
              />
            </Field>
          </div>

          <Field label="Image URLs (one per line)">
            <Textarea
              name="images"
              rows={3}
              defaultValue={product?.images?.join("\n") ?? ""}
              placeholder="https://example.com/img.jpg"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Low-stock alert at">
              <Input
                name="lowStockThreshold"
                type="number"
                min="0"
                defaultValue={product?.lowStockThreshold ?? 5}
              />
            </Field>
            <div className="flex items-end gap-4 pb-1">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="hasExpiry"
                  defaultChecked={product?.hasExpiry ?? false}
                />
                Tracks expiry
              </label>
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isActive"
                  defaultChecked={product?.isActive ?? true}
                />
                Active
              </label>
            </div>
          </div>

          <Field label="Notes">
            <Textarea
              name="description"
              rows={2}
              defaultValue={product?.description ?? ""}
              placeholder="Internal notes (optional)"
            />
          </Field>
        </form>

        <SheetFooter className="border-t px-6 py-4 flex-row sm:justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" form="product-form" disabled={pending}>
            {pending ? "Saving…" : mode === "create" ? "Create product" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}
