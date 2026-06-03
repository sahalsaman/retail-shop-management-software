import { listShops } from "@/lib/queries/admin";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { ShopRowActions } from "@/components/admin/shop-row-actions";

export default async function AdminShopsPage() {
  const shops = await listShops();
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Shops</h1>
          <p className="text-sm text-muted-foreground">
            All onboarded retail shops on the platform.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {shops.length} shop{shops.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5">Shop</th>
              <th className="text-left px-4 py-2.5">Owner</th>
              <th className="text-left px-4 py-2.5">Type</th>
              <th className="text-center px-4 py-2.5">Branches</th>
              <th className="text-center px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Created</th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody>
            {shops.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No shops yet. Send an invite to onboard the first one.
                </td>
              </tr>
            ) : (
              shops.map((s) => (
                <tr key={s.id} className="border-t">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3">
                    <div>{s.ownerName}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.ownerEmail}
                      {s.ownerPhone ? ` · ${s.ownerPhone}` : ""}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{s.type}</td>
                  <td className="px-4 py-3 text-center">{s.branchCount}</td>
                  <td className="px-4 py-3 text-center">
                    <Badge variant={s.isActive ? "default" : "secondary"}>
                      {s.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3">
                    <ShopRowActions id={s.id} isActive={s.isActive} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
