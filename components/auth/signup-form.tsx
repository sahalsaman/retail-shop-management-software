"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SHOP_TYPES, type ShopType } from "@/lib/types";

const SHOP_TYPE_LABELS: Record<ShopType, string> = {
  GROCERY: "Grocery",
  ELECTRONICS: "Electronics",
  FASHION: "Fashion",
  STATIONERY: "Stationery",
  HARDWARE: "Hardware",
  MOBILE: "Mobile shop",
  OTHER: "Other",
};

export function SignupForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    shopName: "",
    shopType: "GROCERY" as ShopType,
    branchName: "Main Branch",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Signup failed");
        return;
      }
      toast.success("Shop created. Welcome!");
      router.push("/dashboard");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">Create your shop</h1>
        <p className="text-sm text-muted-foreground">
          Start managing sales, stock and customers in minutes
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2 col-span-2">
          <Label htmlFor="name">Your name</Label>
          <Input
            id="name"
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={form.email}
            onChange={(e) => update("email", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Mobile</Label>
          <Input
            id="phone"
            inputMode="numeric"
            maxLength={10}
            required
            value={form.phone}
            onChange={(e) => update("phone", e.target.value.replace(/\D/g, ""))}
            placeholder="9876543210"
          />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            value={form.password}
            onChange={(e) => update("password", e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>
        <div className="space-y-2 col-span-2">
          <Label htmlFor="shopName">Shop name</Label>
          <Input
            id="shopName"
            required
            value={form.shopName}
            onChange={(e) => update("shopName", e.target.value)}
            placeholder="e.g. Sahal Super Market"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="shopType">Shop type</Label>
          <select
            id="shopType"
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
            value={form.shopType}
            onChange={(e) => update("shopType", e.target.value as ShopType)}
          >
            {SHOP_TYPES.map((t) => (
              <option key={t} value={t}>
                {SHOP_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="branchName">Branch name</Label>
          <Input
            id="branchName"
            required
            value={form.branchName}
            onChange={(e) => update("branchName", e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Creating shop…" : "Create shop"}
      </Button>

      <p className="text-sm text-center text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-foreground hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
