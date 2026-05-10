"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Person = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  address?: string | null;
  openingBalance?: number;
  isActive: boolean;
};

type Props = {
  mode: "create" | "edit";
  kind: "customer" | "supplier";
  person?: Person;
  triggerLabel?: string;
  onSubmit: (formData: FormData) => Promise<{ ok: true } | { ok: false; error: string } | { ok: true; data: { id: string } }>;
};

export function PersonFormSheet({ mode, kind, person, triggerLabel, onSubmit }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await onSubmit(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(mode === "create" ? "Saved" : "Updated");
      setOpen(false);
      router.refresh();
    });
  }

  const title =
    mode === "create"
      ? kind === "customer" ? "Add customer" : "Add supplier"
      : kind === "customer" ? "Edit customer" : "Edit supplier";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            size={mode === "create" ? "default" : "icon-sm"}
            variant={mode === "create" ? "default" : "ghost"}
            aria-label={mode === "edit" ? "Edit" : undefined}
          >
            {mode === "create" ? (
              <>
                <Plus className="h-4 w-4" />
                {triggerLabel ?? "New"}
              </>
            ) : (
              <Pencil className="h-4 w-4" />
            )}
          </Button>
        }
      />
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 gap-0">
        <SheetHeader className="border-b px-6 py-5">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>
            {kind === "customer"
              ? "Phone is unique per shop and used for credit ledgers."
              : "Suppliers stock your shop. Opening balance only on create."}
          </SheetDescription>
        </SheetHeader>

        <form id="person-form" onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <Field label="Name" required>
            <Input name="name" required defaultValue={person?.name ?? ""} />
          </Field>
          <Field label="Phone" required={kind === "customer"}>
            <Input
              name="phone"
              required={kind === "customer"}
              defaultValue={person?.phone ?? ""}
              placeholder={kind === "customer" ? "10-digit mobile" : "Optional"}
            />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" defaultValue={person?.email ?? ""} />
          </Field>
          <Field label="GSTIN">
            <Input name="gstin" defaultValue={person?.gstin ?? ""} placeholder="Optional" />
          </Field>
          <Field label="Address">
            <Textarea name="address" rows={2} defaultValue={person?.address ?? ""} />
          </Field>
          {kind === "supplier" && mode === "create" && (
            <Field label="Opening balance ₹">
              <Input
                type="number"
                step="0.01"
                name="openingBalance"
                defaultValue={person?.openingBalance ?? 0}
                placeholder="Amount you currently owe (positive)"
              />
            </Field>
          )}
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={person?.isActive ?? true} />
            Active
          </label>
        </form>

        <SheetFooter className="border-t px-6 py-4 flex-row sm:justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="person-form" disabled={pending}>
            {pending ? "Saving…" : "Save"}
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
