import { createClient } from "@/lib/supabase/server";
import { OverviewClient } from "@/components/dashboard/overview-client";

export default async function DashboardOverviewPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const name =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "there";

  return <OverviewClient name={name} />;
}
