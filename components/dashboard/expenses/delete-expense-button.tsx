"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteExpense } from "@/lib/actions/expenses";

export function DeleteExpenseButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function go() {
    if (!confirm("Delete this expense?")) return;
    start(async () => {
      const res = await deleteExpense(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Deleted");
      router.refresh();
    });
  }
  return (
    <Button variant="ghost" size="icon-sm" disabled={pending} onClick={go} aria-label="Delete">
      <Trash2 className="h-4 w-4 text-destructive" />
    </Button>
  );
}
