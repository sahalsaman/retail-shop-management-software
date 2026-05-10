"use client";

import { useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/lib/actions/profile";

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await changePassword(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Password changed");
      formRef.current?.reset();
    });
  }

  return (
    <form ref={formRef} onSubmit={submit} className="space-y-4">
      <Field label="Current password" required>
        <Input
          name="currentPassword"
          type="password"
          required
          autoComplete="current-password"
        />
      </Field>
      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="New password" required>
          <Input
            name="newPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
        <Field label="Confirm new password" required>
          <Input
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </Field>
      </div>
      <p className="text-xs text-muted-foreground">
        Use at least 8 characters. You&apos;ll stay signed in on this device
        after the change.
      </p>
      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Updating…" : "Change password"}
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
