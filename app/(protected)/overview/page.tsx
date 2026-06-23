import Link from "next/link";
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  MessageSquareIcon,
  PlugIcon,
  PlusIcon,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { mockActivity, mockSites, mockStats } from "@/app/(protected)/_lib/mock-data";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Reveal } from "@/components/dashboard/reveal";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function firstName(name: string) {
  return name.split(" ")[0];
}

function formatRelative(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const mins = Math.floor(Math.max(0, now - then) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const activityIcon = {
  message: MessageSquareIcon,
  resolved: CheckCircle2Icon,
  connected: PlugIcon,
  installed: CheckCircle2Icon,
} as const;

export default async function DashboardOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const name =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "there";

  const hasSites = mockSites.length > 0;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Welcome back, {firstName(name)}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasSites
            ? "Here's how your sites are doing today."
            : "Let's get your first site set up with Crolyo."}
        </p>
      </div>

      {!hasSites ? (
        <Reveal>
          <EmptyState
            icon={<PlusIcon className="size-6" />}
            title="Connect your first site"
            description="Add a website, connect it to Slack, and drop the widget on your pages. It takes about two minutes."
            action={
              <Link href="/sites/new" className={buttonVariants({ className: "h-9 gap-2 px-4" })}>
                <PlusIcon className="size-4" />
                Add a site
              </Link>
            }
          />
        </Reveal>
      ) : (
        <>
          <Reveal>
            <section>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
                  Your sites
                </h2>
                <Link
                  href="/sites/new"
                  className={buttonVariants({ variant: "ghost", size: "sm", className: "h-8 gap-1.5 px-2.5" })}
                >
                  <PlusIcon className="size-4" />
                  Add site
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {mockSites.map((site) => {
                  const stats = mockStats[site.id];
                  return (
                    <Link
                      key={site.id}
                      href={`/sites/${site.id}`}
                      className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      <Card className="[--card-spacing:1.25rem] transition-colors group-hover:bg-muted/40 group-focus-visible:bg-muted/40">
                        <CardHeader>
                          <div className="flex items-center gap-2">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: site.primaryColor }}
                              aria-hidden
                            />
                            <CardTitle className="flex-1">{site.name}</CardTitle>
                            <ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                          </div>
                          <p className="font-mono text-xs text-muted-foreground">{site.domain}</p>
                        </CardHeader>
                        <CardContent>
                          <div className="flex flex-wrap items-center gap-2">
                            <StatusBadge tone={site.slackStatus === "connected" ? "success" : "muted"} dot={site.slackStatus === "connected"}>
                              {site.slackStatus === "connected" ? "Slack" : "Slack off"}
                            </StatusBadge>
                            <StatusBadge tone={site.widgetStatus === "installed" ? "success" : "warning"} dot={site.widgetStatus === "installed"}>
                              {site.widgetStatus === "installed" ? "Widget live" : "Widget off"}
                            </StatusBadge>
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">
                            {stats?.openConversations ?? 0} open · {stats?.totalVisitorsThisMonth.toLocaleString() ?? 0} visitors this month
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          </Reveal>

          <Reveal delay={0.05}>
            <section>
              <h2 className="mb-3 font-heading text-base font-semibold tracking-tight text-foreground">
                Recent activity
              </h2>
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {mockActivity.map((item) => {
                  const Icon = activityIcon[item.kind];
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-3.5">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <p className="min-w-0 flex-1 truncate text-sm text-foreground">{item.text}</p>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelative(item.at)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          </Reveal>
        </>
      )}
    </div>
  );
}
