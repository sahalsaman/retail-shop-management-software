import { listInvites } from "@/lib/queries/admin";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { InviteForm } from "@/components/admin/invite-form";
import { InviteRowActions } from "@/components/admin/invite-row-actions";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "default",
  ACCEPTED: "secondary",
  REVOKED: "outline",
  EXPIRED: "outline",
};

export default async function AdminInvitesPage() {
  const invites = await listInvites();
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invites</h1>
          <p className="text-sm text-muted-foreground">
            Invite a retail shop owner to onboard their shop.
          </p>
        </div>
        <InviteForm />
      </div>

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2.5">Owner</th>
              <th className="text-left px-4 py-2.5">Shop</th>
              <th className="text-left px-4 py-2.5">Status</th>
              <th className="text-left px-4 py-2.5">Expires</th>
              <th className="text-left px-4 py-2.5">Invited by</th>
              <th className="text-left px-4 py-2.5">Sent</th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No invites yet.
                </td>
              </tr>
            ) : (
              invites.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="px-4 py-3">
                    <div className="font-medium">{i.ownerName}</div>
                    <div className="text-xs text-muted-foreground">{i.email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div>{i.shopName}</div>
                    <div className="text-xs text-muted-foreground">{i.shopType}</div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_VARIANT[i.status] ?? "outline"}>
                      {i.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(i.expiresAt)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{i.invitedByName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(i.createdAt)}</td>
                  <td className="px-4 py-3">
                    <InviteRowActions
                      id={i.id}
                      token={i.token}
                      status={i.status}
                    />
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
