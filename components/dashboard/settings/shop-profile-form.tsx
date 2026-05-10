"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { updateShopProfile } from "@/lib/actions/shop";
import type { ShopSettings } from "@/lib/queries/shop";

const SHOP_TYPES = [
  ["GROCERY", "Grocery"],
  ["ELECTRONICS", "Electronics"],
  ["FASHION", "Fashion"],
  ["STATIONERY", "Stationery"],
  ["HARDWARE", "Hardware"],
  ["MOBILE", "Mobile"],
  ["OTHER", "Other"],
] as const;

export function ShopProfileForm({ shop }: { shop: ShopSettings }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateShopProfile(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Saved");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border bg-card p-6 space-y-4 max-w-2xl"
    >
      <header>
        <h2 className="text-lg font-semibold">Shop profile</h2>
        <p className="text-sm text-muted-foreground">
          The name, address and contact info that print on every invoice.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Shop name" required>
          <Input name="name" defaultValue={shop.name} required />
        </Field>
        <Field label="Type">
          <Select name="type" defaultValue={shop.type}>
            {SHOP_TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Phone">
          <Input name="phone" defaultValue={shop.phone ?? ""} />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" defaultValue={shop.email ?? ""} />
        </Field>
      </div>

      <Field label="GSTIN">
        <Input name="gstin" defaultValue={shop.gstin ?? ""} placeholder="15-char GSTIN" />
      </Field>

      <Field label="Address">
        <Textarea name="address" rows={2} defaultValue={shop.address ?? ""} />
      </Field>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Currency">
          <Input name="currency" defaultValue={shop.currency} />
        </Field>
        <Field label="Locale">
          <Input name="locale" defaultValue={shop.locale} />
        </Field>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
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
