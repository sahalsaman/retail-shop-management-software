"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvite } from "@/lib/actions/admin";

export function AcceptInviteForm({
  token,
  email,
  ownerName,
  shopName,
  shopType,
}: {
  token: string;
  email: string;
  ownerName: string;
  shopName: string;
  shopType: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [branchName, setBranchName] = useState("Main Branch");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    const fd = new FormData();
    fd.set("token", token);
    fd.set("password", password);
    fd.set("branchName", branchName);
    start(async () => {
      const res = await acceptInvite(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Account created — signing you in…");
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Set up your shop</h1>
        <p className="text-sm text-muted-foreground">
          Confirm the details below and pick a password.
        </p>
      </div>

      <div className="grid gap-3 rounded-lg bg-muted/60 p-3 text-sm">
        <Row label="Email" value={email} />
        <Row label="Your name" value={ownerName} />
        <Row label="Shop" value={`${shopName} · ${shopType}`} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="branchName">Main branch name</Label>
        <Input
          id="branchName"
          value={branchName}
          onChange={(e) => setBranchName(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm</Label>
          <Input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating your shop…" : "Create my shop"}
      </Button>
    </form>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
