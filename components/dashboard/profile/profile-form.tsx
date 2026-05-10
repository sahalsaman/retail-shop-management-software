"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/lib/actions/profile";

export function ProfileForm({
  defaultName,
  email,
  defaultPhone,
  role,
}: {
  defaultName: string;
  email: string;
  defaultPhone: string;
  role: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await updateProfile(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Profile updated");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Full name" required>
          <Input name="name" defaultValue={defaultName} required />
        </Field>
        <Field label="Phone">
          <Input
            name="phone"
            defaultValue={defaultPhone}
            placeholder="10-digit mobile"
          />
        </Field>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Email">
          <Input value={email} disabled />
        </Field>
        <Field label="Role">
          <Input value={role} disabled />
        </Field>
      </div>

      <p className="text-xs text-muted-foreground">
        Email and role can&apos;t be self-edited. Contact your shop owner to
        change them.
      </p>

      <div className="flex justify-end pt-1">
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
