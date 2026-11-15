"use client";

import Link from "next/link";
import { BookOpenIcon, ExternalLinkIcon, HashIcon, LayoutDashboardIcon, SettingsIcon, SlidersHorizontalIcon } from "lucide-react";

import { useSites } from "@/components/dashboard/sites-provider";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { TabOverview } from "@/components/dashboard/tab-overview";
import { TabWidget } from "@/components/dashboard/tab-widget";
import { TabSlack } from "@/components/dashboard/tab-slack";
import { TabKnowledge } from "@/components/dashboard/tab-knowledge";
import { TabSiteSettings } from "@/components/dashboard/tab-site-settings";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function SiteDetailClient({ id }: { id: string }) {
  const { sites, isLoading, error, refresh } = useSites();
  const site = sites.find((item) => item.id === id);

  if (isLoading) {
    return <div className="space-y-8"><div className="h-14 w-72 animate-pulse rounded-lg bg-muted" /><div className="h-10 w-full animate-pulse rounded-lg bg-muted" /><div className="h-72 animate-pulse rounded-lg border bg-muted/40" /></div>;
  }

  if (error) {
    return <div className="rounded-lg border p-6"><h1 className="text-xl font-medium">Couldn&apos;t load this site</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p><Button className="mt-4" onClick={() => void refresh()}>Try again</Button></div>;
  }

  if (!site) {
    return <div className="rounded-lg border p-6"><h1 className="text-xl font-medium">Site not found</h1><p className="mt-2 text-sm text-muted-foreground">This site may have been deleted or you may not have access to it.</p><Button className="mt-4" nativeButton={false} render={<Link href="/overview" />}>Back to overview</Button></div>;
  }

  const stats = { openConversations: 0, totalVisitorsThisMonth: 0, avgResponseTime: "—" };
  const conversations: never[] = [];

  return (
    <div className="space-y-8">
      <PageHeader
        title={<span className="flex items-center gap-3"><span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: site.primaryColor }} aria-hidden />{site.name}</span>}
        description={<a href={/^https?:\/\//i.test(site.domain) ? site.domain : `https://${site.domain}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-mono text-xs underline-offset-4 transition-colors hover:text-foreground hover:underline">{site.domain}<ExternalLinkIcon className="size-3 shrink-0" aria-hidden /></a>}
        actions={<><StatusBadge tone={site.slackStatus === "connected" ? "success" : site.slackWorkspaceName ? "warning" : "muted"} dot={site.slackStatus === "connected"}>{site.slackStatus === "connected" ? "Slack connected" : site.slackWorkspaceName ? "Finish Slack setup" : "Slack off"}</StatusBadge><StatusBadge tone={site.widgetStatus === "installed" ? "success" : "warning"} dot={site.widgetStatus === "installed"}>{site.widgetStatus === "installed" ? "Widget live" : "Widget not installed"}</StatusBadge></>}
      />
      <Tabs defaultValue="overview">
        <TabsList className="h-9"><TabsTrigger value="overview" className="px-3"><LayoutDashboardIcon className="size-4" /><span>Overview</span></TabsTrigger><TabsTrigger value="widget" className="px-3"><SlidersHorizontalIcon className="size-4" /><span>Widget</span></TabsTrigger><TabsTrigger value="slack" className="px-3"><HashIcon className="size-4" /><span>Slack</span></TabsTrigger><TabsTrigger value="knowledge" className="px-3"><BookOpenIcon className="size-4" /><span>Knowledge</span></TabsTrigger><TabsTrigger value="settings" className="px-3"><SettingsIcon className="size-4" /><span>Settings</span></TabsTrigger></TabsList>
        <TabsContent value="overview" className="mt-6"><TabOverview site={site} stats={stats} conversations={conversations} /></TabsContent>
        <TabsContent value="widget" className="mt-6"><TabWidget site={site} /></TabsContent>
        <TabsContent value="slack" className="mt-6"><TabSlack site={site} /></TabsContent>
        <TabsContent value="knowledge" className="mt-6"><TabKnowledge site={site} /></TabsContent>
        <TabsContent value="settings" className="mt-6"><TabSiteSettings site={site} /></TabsContent>
      </Tabs>
    </div>
  );
}
