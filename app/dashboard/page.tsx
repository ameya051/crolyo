import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SignOutButton } from "./sign-out-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/signin");
  }

  const avatarUrl = user.user_metadata?.avatar_url;
  const fullName =
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    user.email?.split("@")[0] ||
    "User";
  const email = user.email;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            Crolyo
          </h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {avatarUrl && (
                <img
                  src={avatarUrl}
                  alt={fullName}
                  className="w-8 h-8 rounded-full ring-2 ring-border"
                  referrerPolicy="no-referrer"
                />
              )}
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-foreground leading-tight">
                  {fullName}
                </p>
                <p className="text-xs text-muted-foreground">{email}</p>
              </div>
            </div>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Welcome back, {fullName.split(" ")[0]}!
          </h2>
          <p className="text-muted-foreground mt-1">
            Here&apos;s your dashboard. This is a placeholder page.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: "Active Chats",
              value: "0",
              description: "Live conversations",
            },
            {
              title: "Total Visitors",
              value: "0",
              description: "This month",
            },
            {
              title: "Response Time",
              value: "—",
              description: "Avg. reply time",
            },
          ].map((card) => (
            <div
              key={card.title}
              className="bg-card rounded-2xl border border-border p-6 shadow-sm"
            >
              <p className="text-sm text-muted-foreground font-medium">
                {card.title}
              </p>
              <p className="text-3xl font-bold text-foreground mt-2">
                {card.value}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
