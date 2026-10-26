"use client";

import { BillingBanner } from "@/components/dashboard/billing-banner";
import { Topbar } from "@/components/dashboard/topbar";
import { SitesProvider } from "@/components/dashboard/sites-provider";
import { Toaster } from "@/components/ui/sonner";
import type { DashboardUser } from "@/components/dashboard/user-menu";
import type { AccessState } from "@/lib/types";

export function DashboardShell({
  user,
  billing,
  children,
}: {
  user: DashboardUser;
  billing: AccessState | null;
  children: React.ReactNode;
}) {
  return (
    <SitesProvider>
      <div className="min-h-screen bg-background text-foreground">
        <Topbar user={user} />
        <BillingBanner billing={billing} />
        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
        <Toaster richColors position="bottom-right" />
      </div>
    </SitesProvider>
  );
}
