import Link from "next/link";
import { Store } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-primary text-primary-foreground p-10">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
          <Store className="h-5 w-5" />
          RSMS
        </Link>
        <div className="space-y-3">
          <h2 className="text-3xl font-semibold leading-tight">
            Run your shop, not the spreadsheet.
          </h2>
          <p className="text-primary-foreground/80 max-w-md">
            POS billing, inventory, GST invoices, customers and reports — built for grocery,
            electronics, fashion, stationery, hardware and mobile shops in India.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© RSMS</p>
      </div>
      <div className="flex flex-col">
        <div className="flex justify-end p-4">
          <ThemeToggle />
        </div>
        <div className="flex-1 flex items-center justify-center px-4 py-8">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  );
}
