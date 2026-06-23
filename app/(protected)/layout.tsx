import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Topbar } from "@/components/dashboard/topbar";
import { Toaster } from "@/components/ui/sonner";

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Topbar user={profile} />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
      <Toaster richColors position="bottom-right" />
    </div>
  );
}
