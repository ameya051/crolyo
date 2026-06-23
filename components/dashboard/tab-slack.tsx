"use client";

import { toast } from "sonner";
import { HashIcon, MessageSquareIcon, ExternalLinkIcon, PlugIcon } from "lucide-react";

import type { Site } from "@/app/(protected)/_lib/types";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TabSlack({ site }: { site: Site }) {
  const connected = site.slackStatus === "connected";

  const handleConnect = () => {
    toast.info("Slack OAuth isn't wired up yet", {
      description: "This is a design preview — connecting Slack lands in the next phase.",
    });
  };

  return (
    <div className="space-y-6">
      <Card className="[--card-spacing:1.5rem]">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-slack-aubergine/10 text-slack-aubergine dark:bg-slack-aubergine/20 dark:text-purple-300">
                <MessageSquareIcon className="size-5" />
              </span>
              <div>
                <CardTitle>{site.slackWorkspaceName ?? "Not connected"}</CardTitle>
                <CardDescription>
                  {connected
                    ? "Visitor messages route into this Slack workspace."
                    : "Connect Slack to start receiving visitor messages."}
                </CardDescription>
              </div>
            </div>
            <StatusBadge tone={connected ? "success" : "muted"} dot={connected} pulse={connected}>
              {connected ? "Connected" : "Not connected"}
            </StatusBadge>
          </div>
        </CardHeader>
        {connected ? (
          <CardContent>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <MessageSquareIcon className="size-3.5" /> Workspace
                </dt>
                <dd className="mt-1 text-sm text-foreground">{site.slackWorkspaceName}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <HashIcon className="size-3.5" /> Channel
                </dt>
                <dd className="mt-1 text-sm text-foreground">{site.slackChannelName}</dd>
              </div>
            </dl>
            <div className="mt-5 flex gap-2">
              <Button variant="outline" className="h-9 px-4" render={
                <a href="https://slack.com" target="_blank" rel="noopener noreferrer" />
              }>
                Open Slack
                <ExternalLinkIcon className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                className="h-9 px-4 text-muted-foreground"
                onClick={() => toast.info("Disconnecting Slack isn't wired up yet in this preview.")}
              >
                Disconnect
              </Button>
            </div>
          </CardContent>
        ) : (
          <CardContent>
            <div className="flex flex-col items-start gap-4">
              <p className="text-sm text-muted-foreground">
                Authorize the Crolyo app in your Slack workspace. Every visitor message will appear in a channel of your choice, and your team replies right inside Slack.
              </p>
              <Button onClick={handleConnect} className="h-9 gap-2 px-4">
                <PlugIcon className="size-4" />
                Connect Slack
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
