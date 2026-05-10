"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [isPending, startTransition] = useTransition();
  const [devLink, setDevLink] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Could not send reset link");
        return;
      }
      toast.success("If that email exists, a reset link has been sent.");
      if (json.data?.devToken) {
        setDevLink(`/reset-password?token=${json.data.devToken}`);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">Reset password</h1>
        <p className="text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Sending…" : "Send reset link"}
      </Button>

      {devLink && (
        <Alert>
          <AlertTitle>Dev mode</AlertTitle>
          <AlertDescription>
            Email isn&apos;t wired up yet.{" "}
            <Link href={devLink} className="underline font-medium">
              Use this link to reset
            </Link>
            .
          </AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-center text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
