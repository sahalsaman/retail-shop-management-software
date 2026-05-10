"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select } from "@/components/ui/select";
import type { BranchListItem } from "@/lib/queries/branches";

export function BranchSwitcher({
  branches,
  value,
}: {
  branches: BranchListItem[];
  value: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function onChange(branchId: string) {
    const next = new URLSearchParams(params.toString());
    next.set("branch", branchId);
    next.delete("page");
    router.replace(`${pathname}?${next.toString()}`);
  }

  return (
    <Select
      className="h-10 w-56"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
          {b.isMain ? " · main" : ""}
        </option>
      ))}
    </Select>
  );
}
