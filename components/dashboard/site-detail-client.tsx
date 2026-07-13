"use client";

import Link from "next/link";
import { HashIcon, LayoutDashboardIcon, SettingsIcon, SlidersHorizontalIcon } from "lucide-react";

import { useSites } from "@/components/dashboard/sites-provider";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { TabOverview } from "@/components/dashboard/tab-overview";
import { TabWidget } from "@/components/dashboard/tab-widget";
import { TabSlack } from "@/components/dashboard/tab-slack";
import { TabSiteSettings } from "@/components/dashboard/tab-site-settings";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SiteDetailClient({ id }: { id: string }) {
  const { sites, isLoading, error, refresh } = useSites();
  const site = sites.find((item) => item.id === id);

  if (isLoading) {
    return <div className="space-y-8"><div className="h-14 w-72 animate-pulse rounded-xl bg-muted" /><div className="h-10 w-full animate-pulse rounded-lg bg-muted" /><div className="h-72 animate-pulse rounded-xl border bg-muted/40" /></div>;
  }

  if (error) {
    return <div className="rounded-xl border p-6"><h1 className="font-heading text-xl font-bold">Couldn&apos;t load this site</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button className="mt-4" onClick={() => void refresh()}>Try again</Button></div>;
  }

  if (!site) {
    return <div className="rounded-xl border p-6"><h1 className="font-heading text-xl font-bold">Site not found</h1><p className="mt-2 text-sm text-muted-foreground">This site may have been deleted or you may not have access to it.</p><Button className="mt-4" nativeButton={false} render={<Link href="/overview" />}>Back to overview</Button></div>;
  }

  const stats = { openConversations: 0, totalVisitorsThisMonth: 0, avgResponseTime: "—" };
  const conversations: never[] = [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: site.primaryColor }} aria-hidden /><div><h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{site.name}</h1><p className="font-mono text-xs text-muted-foreground">{site.domain}</p></div></div>
        <div className="flex flex-wrap items-center gap-2"><StatusBadge tone={site.slackStatus === "connected" ? "success" : "muted"} dot={site.slackStatus === "connected"}>{site.slackStatus === "connected" ? "Slack connected" : "Slack off"}</StatusBadge><StatusBadge tone={site.widgetStatus === "installed" ? "success" : "warning"} dot={site.widgetStatus === "installed"}>{site.widgetStatus === "installed" ? "Widget live" : "Widget not installed"}</StatusBadge></div>
      </div>
      <Tabs defaultValue="overview">
        <TabsList className="h-9"><TabsTrigger value="overview" className="px-3"><LayoutDashboardIcon className="size-4" /><span>Overview</span></TabsTrigger><TabsTrigger value="widget" className="px-3"><SlidersHorizontalIcon className="size-4" /><span>Widget</span></TabsTrigger><TabsTrigger value="slack" className="px-3"><HashIcon className="size-4" /><span>Slack</span></TabsTrigger><TabsTrigger value="settings" className="px-3"><SettingsIcon className="size-4" /><span>Settings</span></TabsTrigger></TabsList>
        <TabsContent value="overview" className="mt-6"><TabOverview site={site} stats={stats} conversations={conversations} /></TabsContent>
        <TabsContent value="widget" className="mt-6"><TabWidget site={site} /></TabsContent>
        <TabsContent value="slack" className="mt-6"><TabSlack site={site} /></TabsContent>
        <TabsContent value="settings" className="mt-6"><TabSiteSettings site={site} /></TabsContent>
      </Tabs>
    </div>
  );
}
