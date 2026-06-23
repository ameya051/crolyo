import { ClockIcon, MessageCircleIcon, MessageSquareIcon, UsersIcon } from "lucide-react";

import type { Conversation, OverviewStats, Site } from "@/app/(protected)/_lib/types";
import { StatCard } from "@/components/dashboard/stat-card";
import { ConversationRow } from "@/components/dashboard/conversation-row";
import { EmptyState } from "@/components/dashboard/empty-state";

interface TabOverviewProps {
  site: Site;
  stats: OverviewStats;
  conversations: Conversation[];
}

export function TabOverview({ site, stats, conversations }: TabOverviewProps) {
  const openConversations = conversations.filter((c) => c.status === "open");

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Open conversations"
          value={stats.openConversations}
          hint={stats.openConversations > 0 ? "Live now" : "No live chats"}
          live={stats.openConversations > 0}
          icon={<MessageSquareIcon className="size-4 text-muted-foreground" />}
        />
        <StatCard
          label="Visitors this month"
          value={stats.totalVisitorsThisMonth.toLocaleString()}
          hint="Across all pages"
          icon={<UsersIcon className="size-4 text-muted-foreground" />}
        />
        <StatCard
          label="Avg. response time"
          value={stats.avgResponseTime}
          hint="First agent reply"
          icon={<ClockIcon className="size-4 text-muted-foreground" />}
        />
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
            Recent conversations
          </h2>
          {conversations.length > 0 ? (
            <span className="text-xs text-muted-foreground">
              {openConversations.length} open · {conversations.length} total
            </span>
          ) : null}
        </div>
        {conversations.length > 0 ? (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {conversations.map((c) => (
              <ConversationRow key={c.id} conversation={c} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<MessageCircleIcon className="size-6" />}
            title="No conversations yet"
            description={`Once visitors start chatting on ${site.domain}, their messages will show up here — and land in your Slack channel.`}
          />
        )}
      </section>
    </div>
  );
}
