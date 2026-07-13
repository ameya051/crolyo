"use client";

import Link from "next/link";
import { ArrowRightIcon, PlusIcon, RefreshCwIcon } from "lucide-react";

import { useSites } from "@/components/dashboard/sites-provider";
import { EmptyState } from "@/components/dashboard/empty-state";
import { Reveal } from "@/components/dashboard/reveal";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function firstName(name: string) {
  return name.split(" ")[0];
}

export function OverviewClient({ name }: { name: string }) {
  const { sites, isLoading, error, refresh } = useSites();

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">Welcome back, {firstName(name)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isLoading || sites.length ? "Here's how your sites are doing today." : "Let's get your first site set up with Crolyo."}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1].map((item) => <div key={item} className="h-44 animate-pulse rounded-xl border bg-muted/40" />)}
        </div>
      ) : error ? (
        <EmptyState
          icon={<RefreshCwIcon className="size-6" />}
          title="Couldn&apos;t load your sites"
          description={error}
          action={<Button onClick={() => void refresh()}>Try again</Button>}
        />
      ) : !sites.length ? (
        <Reveal>
          <EmptyState
            icon={<PlusIcon className="size-6" />}
            title="Connect your first site"
            description="Add a website, connect it to Slack, and drop the widget on your pages. It takes about two minutes."
            action={<Link href="/sites/new" className={buttonVariants({ className: "h-9 gap-2 px-4" })}><PlusIcon className="size-4" />Add a site</Link>}
          />
        </Reveal>
      ) : (
        <Reveal>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">Your sites</h2>
              <Link href="/sites/new" className={buttonVariants({ variant: "ghost", size: "sm", className: "h-8 gap-1.5 px-2.5" })}><PlusIcon className="size-4" />Add site</Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {sites.map((site) => (
                <Link key={site.id} href={`/sites/${site.id}`} className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                  <Card className="[--card-spacing:1.25rem] transition-colors group-hover:bg-muted/40 group-focus-visible:bg-muted/40">
                    <CardHeader>
                      <div className="flex items-center gap-2"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: site.primaryColor }} aria-hidden /><CardTitle className="flex-1">{site.name}</CardTitle><ArrowRightIcon className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" /></div>
                      <p className="font-mono text-xs text-muted-foreground">{site.domain}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={site.slackStatus === "connected" ? "success" : "muted"} dot={site.slackStatus === "connected"}>{site.slackStatus === "connected" ? "Slack" : "Slack off"}</StatusBadge>
                        <StatusBadge tone={site.widgetStatus === "installed" ? "success" : "warning"} dot={site.widgetStatus === "installed"}>{site.widgetStatus === "installed" ? "Widget live" : "Widget off"}</StatusBadge>
                      </div>
                      <p className="mt-3 text-xs text-muted-foreground">0 open · 0 visitors this month</p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        </Reveal>
      )}
    </div>
  );
}
