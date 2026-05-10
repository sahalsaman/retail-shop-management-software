import { ModulePlaceholder } from "@/components/dashboard/module-placeholder";

export default function BranchesPage() {
  return (
    <ModulePlaceholder
      title="Branches"
      description="Manage multiple shop branches"
      phase="Phase 6"
      features={[
        "Add / edit branches",
        "Branch-wise inventory",
        "Branch-wise sales reports",
        "Stock transfers between branches",
      ]}
    />
  );
}
