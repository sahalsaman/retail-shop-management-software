"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export function ReportToolbar({ gstEnabled = true }: { gstEnabled?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  function setParam(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Report</Label>
        <Select
          className="h-10 w-44"
          value={params.get("type") ?? "sales"}
          onChange={(e) => setParam("type", e.target.value)}
        >
          <option value="sales">Sales</option>
          <option value="profit">Profit & loss</option>
          {gstEnabled && <option value="gst">GST summary</option>}
          <option value="stock">Stock valuation</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">From</Label>
        <Input
          className="h-10"
          type="date"
          value={params.get("from") ?? monthAgo}
          onChange={(e) => setParam("from", e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">To</Label>
        <Input
          className="h-10"
          type="date"
          value={params.get("to") ?? today}
          onChange={(e) => setParam("to", e.target.value)}
        />
      </div>
    </div>
  );
}
