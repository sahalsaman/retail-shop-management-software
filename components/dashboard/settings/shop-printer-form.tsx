"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateShopPrinter } from "@/lib/actions/shop";
import type { ShopSettings } from "@/lib/queries/shop";

export function ShopPrinterForm({ shop }: { shop: ShopSettings }) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(shop.printer.enabled);
  const [autoPrint, setAutoPrint] = useState(shop.printer.autoPrint);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (enabled) fd.set("printerEnabled", "on");
    else fd.delete("printerEnabled");
    if (autoPrint) fd.set("printerAutoPrint", "on");
    else fd.delete("printerAutoPrint");

    start(async () => {
      const res = await updateShopPrinter(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Printer settings saved");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border bg-card p-6 space-y-5 max-w-2xl"
    >
      <header>
        <h2 className="text-lg font-semibold">Receipt printer</h2>
        <p className="text-sm text-muted-foreground">
          Configures the thermal-receipt template used after a POS sale. The
          actual print is handled by your browser&apos;s print dialog —
          install your printer in your OS and set it as default for silent
          background prints.
        </p>
      </header>

      <label className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-1 h-4 w-4 accent-primary"
        />
        <div className="flex-1">
          <p className="font-medium">Thermal receipt enabled</p>
          <p className="text-sm text-muted-foreground">
            When on, &quot;Pay &amp; print&quot; in POS opens the thermal-paper
            template. When off, the A4-style invoice is used instead.
          </p>
        </div>
      </label>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Paper width">
          <Select name="printerPaperWidth" defaultValue={shop.printer.paperWidth}>
            <option value="58mm">58 mm (small)</option>
            <option value="80mm">80 mm (standard)</option>
          </Select>
        </Field>
        <Field label="Copies">
          <Select name="printerCopies" defaultValue={String(shop.printer.copies)}>
            <option value="1">1 — customer copy only</option>
            <option value="2">2 — customer + shop</option>
            <option value="3">3 — customer + shop + accounts</option>
          </Select>
        </Field>
      </div>

      <Field label="Header (above receipt)">
        <Textarea
          name="printerHeader"
          rows={2}
          defaultValue={shop.printer.header ?? ""}
          placeholder="e.g. extra phone number, special promo"
        />
      </Field>
      <Field label="Footer (below receipt)">
        <Textarea
          name="printerFooter"
          rows={2}
          defaultValue={shop.printer.footer ?? ""}
          placeholder="Thank you message, return policy…"
        />
      </Field>

      <label className="flex items-start gap-3 rounded-lg border bg-muted/40 p-4 cursor-pointer">
        <input
          type="checkbox"
          checked={autoPrint}
          onChange={(e) => setAutoPrint(e.target.checked)}
          className="mt-1 h-4 w-4 accent-primary"
        />
        <div className="flex-1">
          <p className="font-medium">Auto-open print dialog after sale</p>
          <p className="text-sm text-muted-foreground">
            On most browsers + a thermal driver set as default this is silent
            and one-tap. Turn off if cashiers prefer to review the receipt
            preview before printing.
          </p>
        </div>
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <a
          href="/dashboard/pos/thermal/preview"
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
        >
          Preview a sample receipt
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save printer settings"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
