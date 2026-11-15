import type { Metadata } from "next";

import { createClient } from "@/lib/supabase/server";
import { AccountSettings } from "@/components/dashboard/account-settings";
import { PageHeader } from "@/components/dashboard/page-header";

export const metadata: Metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    // Protected layout is the authoritative gate; this is a belt-and-suspenders
    // check for type narrowing and shouldn't trigger in practice.
    return null;
  }

  const avatarUrl = (user.user_metadata?.avatar_url as string | undefined) ?? null;
  const fullName =
    (user.user_metadata?.full_name as string | undefined) ||
    (user.user_metadata?.name as string | undefined) ||
    user.email?.split("@")[0] ||
    "You";
  const email = user.email ?? "";

  return (
    <div className="space-y-8">
      <PageHeader title="Settings" description="Manage your profile, appearance, and account." />
      <AccountSettings profile={{ fullName, email, avatarUrl }} />
    </div>
  );
}
