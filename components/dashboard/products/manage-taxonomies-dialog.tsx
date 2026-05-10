"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { createCategory, deleteCategory } from "@/lib/actions/categories";
import { createBrand, deleteBrand } from "@/lib/actions/brands";
import type { CategoryListItem } from "@/lib/queries/categories";
import type { BrandListItem } from "@/lib/queries/brands";

type Item = { id: string; name: string };

export function ManageTaxonomiesDialog({
  kind,
  triggerLabel,
  items,
}: {
  kind: "category" | "brand";
  triggerLabel: string;
  items: CategoryListItem[] | BrandListItem[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, start] = useTransition();
  const [list, setList] = useState<Item[]>(items);

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    start(async () => {
      const res =
        kind === "category"
          ? await createCategory({ name: trimmed, parent: null })
          : await createBrand({ name: trimmed });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`${kind === "category" ? "Category" : "Brand"} added`);
      setList((prev) => [...prev, { id: res.id ?? Math.random().toString(), name: trimmed }]);
      setName("");
    });
  }

  function remove(id: string) {
    start(async () => {
      const res =
        kind === "category" ? await deleteCategory(id) : await deleteBrand(id);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Removed");
      setList((prev) => prev.filter((i) => i.id !== id));
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" >{triggerLabel}</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{kind === "category" ? "Categories" : "Brands"}</DialogTitle>
          <DialogDescription>
            Used to organize products. Cannot delete one that&apos;s in use.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Input
            placeholder={`New ${kind} name`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            disabled={pending}
          />
          <Button onClick={add} disabled={pending || !name.trim()} size="sm">
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>

        <div className="mt-4 max-h-72 overflow-y-auto divide-y rounded-lg border">
          {list.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No {kind === "category" ? "categories" : "brands"} yet.</p>
          ) : (
            list.map((it) => (
              <div key={it.id} className="flex items-center justify-between px-3 py-2">
                <span className="text-sm">{it.name}</span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => remove(it.id)}
                  disabled={pending}
                  aria-label={`Delete ${it.name}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
