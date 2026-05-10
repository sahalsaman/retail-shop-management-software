"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteEmployee } from "@/lib/actions/employees";

export function DeleteEmployeeButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function go() {
    if (
      !confirm(
        `Remove ${name}? Employees with salary history are deactivated instead of deleted so payroll records stay intact.`,
      )
    )
      return;
    start(async () => {
      const res = await deleteEmployee(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Done");
      router.refresh();
    });
  }
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={go}
      disabled={pending}
      aria-label={`Remove ${name}`}
    >
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
