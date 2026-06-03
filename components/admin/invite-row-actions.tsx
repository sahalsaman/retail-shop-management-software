"use client";

import { useTransition } from "react";
import { Copy, Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { revokeInvite } from "@/lib/actions/admin";

export function InviteRowActions({
  id,
  token,
  status,
}: {
  id: string;
  token: string;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
}) {
  const [pending, start] = useTransition();

  function copyLink() {
    const url = `${window.location.origin}/accept-invite?token=${token}`;
    navigator.clipboard.writeText(url).then(() => toast.success("Link copied"));
  }

  if (status !== "PENDING") {
    return (
      <Button variant="ghost" size="icon-sm" onClick={copyLink} title="Copy link">
        <Copy className="h-4 w-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <div className="flex gap-1">
      <Button variant="ghost" size="icon-sm" onClick={copyLink} title="Copy invite link">
        <Copy className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        title="Revoke invite"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await revokeInvite(id);
            if (!res.ok) toast.error(res.error);
            else toast.success("Invite revoked");
          })
        }
      >
        <Ban className="h-4 w-4 text-destructive" />
      </Button>
    </div>
  );
}
