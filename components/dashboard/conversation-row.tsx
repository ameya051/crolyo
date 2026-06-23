import Link from "next/link";
import { ExternalLinkIcon, MessageSquareIcon } from "lucide-react";

import type { Conversation } from "@/app/(protected)/_lib/types";
import { StatusBadge } from "@/components/dashboard/status-badge";

function formatRelative(iso: string) {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ConversationRow({ conversation }: { conversation: Conversation }) {
  const isOpen = conversation.status === "open";

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <MessageSquareIcon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {conversation.visitorLabel}
          </p>
          <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
            {conversation.messageCount} {conversation.messageCount === 1 ? "msg" : "msgs"}
          </span>
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">
          {conversation.lastMessagePreview}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <StatusBadge tone={isOpen ? "brand" : "muted"} dot={isOpen} pulse={isOpen}>
          {isOpen ? "Open" : "Closed"}
        </StatusBadge>
        <span className="hidden w-16 shrink-0 text-right text-xs text-muted-foreground sm:block">
          {formatRelative(conversation.lastMessageAt)}
        </span>
        {conversation.slackThreadUrl ? (
          <Link
            href={conversation.slackThreadUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Open in Slack"
          >
            <ExternalLinkIcon className="size-4" />
          </Link>
        ) : null}
      </div>
    </div>
  );
}
