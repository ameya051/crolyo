import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccessState } from "@/lib/billing/access";
import { getBillingMode } from "@/lib/billing/dodo";
import { getCurrentBillingAccount } from "@/lib/billing/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split("@")[0] ||
    "You";
  const email = user.email ?? "";

  const profile = { avatarUrl, fullName, email } as const;

  // Computed on the server so "days left" never mismatches during hydration.
  // A failed lookup hides the banner rather than claiming the widget is offline.
  const account = await getCurrentBillingAccount();
  const billing = account ? getAccessState(account, getBillingMode()) : null;

  return (
    <DashboardShell user={profile} billing={billing}>
      {children}
    </DashboardShell>
  );
}
