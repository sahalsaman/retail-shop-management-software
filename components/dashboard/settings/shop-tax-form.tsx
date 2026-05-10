"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateShopTax } from "@/lib/actions/shop";
import type { ShopSettings } from "@/lib/queries/shop";

export function ShopTaxForm({ shop }: { shop: ShopSettings }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(shop.gstEnabled);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (enabled) fd.set("gstEnabled", "on");
    else fd.delete("gstEnabled");
    start(async () => {
      const res = await updateShopTax(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Tax settings saved");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border bg-card p-6 space-y-5 max-w-2xl"
    >
      <header>
        <h2 className="text-lg font-semibold">Tax & GST</h2>
        <p className="text-sm text-muted-foreground">
          Disable to hide GST fields and tax math across products, billing and
          invoices. Existing data is preserved — turning it back on restores all
          GST UI.
        </p>
      </header>

      <label
        className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 cursor-pointer"
      >
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-1 h-4 w-4 accent-primary"
        />
        <div className="flex-1">
          <p className="font-medium">GST enabled</p>
          <p className="text-sm text-muted-foreground">
            Show HSN, GST rate, tax columns, CGST/SGST/IGST split, and the GST
            report. Off for shops below the GST threshold or non-GST businesses.
          </p>
        </div>
      </label>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">GSTIN</Label>
        <Input
          name="gstin"
          defaultValue={shop.gstin ?? ""}
          placeholder="15-char GSTIN — required when enabled"
          disabled={!enabled}
        />
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save tax settings"}
        </Button>
      </div>
    </form>
  );
}
