import { notFound } from "next/navigation";
import {
  HashIcon,
  LayoutDashboardIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
} from "lucide-react";

import {
  getSiteById,
  mockConversations,
  mockStats,
} from "@/app/(protected)/_lib/mock-data";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { TabOverview } from "@/components/dashboard/tab-overview";
import { TabWidget } from "@/components/dashboard/tab-widget";
import { TabSlack } from "@/components/dashboard/tab-slack";
import { TabSiteSettings } from "@/components/dashboard/tab-site-settings";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const site = getSiteById(id);
  return { title: site ? site.name : "Site" };
}

export default async function SitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const site = getSiteById(id);
  if (!site) notFound();

  const stats = mockStats[site.id] ?? {
    openConversations: 0,
    totalVisitorsThisMonth: 0,
    avgResponseTime: "—",
  };
  const conversations = mockConversations[site.id] ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span
            className="size-3 shrink-0 rounded-full"
            style={{ backgroundColor: site.primaryColor }}
            aria-hidden
          />
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {site.name}
            </h1>
            <p className="font-mono text-xs text-muted-foreground">{site.domain}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge
            tone={site.slackStatus === "connected" ? "success" : "muted"}
            dot={site.slackStatus === "connected"}
          >
            {site.slackStatus === "connected" ? "Slack connected" : "Slack off"}
          </StatusBadge>
          <StatusBadge
            tone={site.widgetStatus === "installed" ? "success" : "warning"}
            dot={site.widgetStatus === "installed"}
          >
            {site.widgetStatus === "installed" ? "Widget live" : "Widget not installed"}
          </StatusBadge>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="h-9">
          <TabsTrigger value="overview" className="px-3">
            <LayoutDashboardIcon className="size-4" />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="widget" className="px-3">
            <SlidersHorizontalIcon className="size-4" />
            <span>Widget</span>
          </TabsTrigger>
          <TabsTrigger value="slack" className="px-3">
            <HashIcon className="size-4" />
            <span>Slack</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="px-3">
            <SettingsIcon className="size-4" />
            <span>Settings</span>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-6">
          <TabOverview site={site} stats={stats} conversations={conversations} />
        </TabsContent>
        <TabsContent value="widget" className="mt-6">
          <TabWidget site={site} />
        </TabsContent>
        <TabsContent value="slack" className="mt-6">
          <TabSlack site={site} />
        </TabsContent>
        <TabsContent value="settings" className="mt-6">
          <TabSiteSettings site={site} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
