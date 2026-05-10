import { Suspense } from "react";
import { ResetForm } from "@/components/auth/reset-form";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetForm />
    </Suspense>
  );
}
