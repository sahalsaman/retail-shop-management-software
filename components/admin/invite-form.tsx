"use client";

import { useState, useTransition } from "react";
import { Copy, Mail, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SHOP_TYPES } from "@/lib/types";
import { createInvite } from "@/lib/actions/admin";

export function InviteForm() {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="h-4 w-4" />
            New invite
          </Button>
        }
      />
      <DialogContent>
        {open && <InviteFormBody onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function InviteFormBody({ onDone }: { onDone: () => void }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await createInvite(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const token = (res.data?.token as string) ?? "";
      const url = `${window.location.origin}/accept-invite?token=${token}`;
      setLink(url);
      toast.success("Invite created");
    });
  }

  if (link) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Invite ready</DialogTitle>
          <DialogDescription>
            Share this link with the shop owner. Valid for 7 days.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-lg border bg-muted/60 p-3 break-all font-mono text-xs">
          {link}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Copied"))}>
            <Copy className="h-4 w-4" /> Copy link
          </Button>
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>Invite shop owner</DialogTitle>
        <DialogDescription>
          The owner creates their password when they accept the invite.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 py-2">
        <div className="grid gap-1.5">
          <Label className="text-xs text-muted-foreground">Owner name</Label>
          <Input name="ownerName" required autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input name="email" type="email" required />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Phone (optional)</Label>
            <Input name="phone" type="tel" placeholder="98xxxxxxxx" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Shop name</Label>
            <Input name="shopName" required />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">Shop type</Label>
            <Select name="shopType" defaultValue="GROCERY" required>
              {SHOP_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          <Mail className="h-4 w-4" />
          {pending ? "Creating…" : "Create invite"}
        </Button>
      </DialogFooter>
    </form>
  );
}
