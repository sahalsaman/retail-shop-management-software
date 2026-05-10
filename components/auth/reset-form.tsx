"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  const token = params.get("token") || "";

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) {
      toast.error("Missing reset token");
      return;
    }
    startTransition(async () => {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Could not reset password");
        return;
      }
      toast.success("Password reset. Please sign in.");
      router.push("/login");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        <p className="text-sm text-muted-foreground">Choose a strong password you&apos;ll remember</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending || !token}>
        {isPending ? "Saving…" : "Reset password"}
      </Button>

      <p className="text-sm text-center text-muted-foreground">
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
