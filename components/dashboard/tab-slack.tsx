"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { HashIcon, MessageSquareIcon, PlugIcon } from "lucide-react";

import type { Site } from "@/app/(protected)/_lib/types";
import { listSlackChannels, connectSlackChannel } from "@/app/actions/slack";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

interface SlackChannelOption {
  id: string;
  name: string;
  is_private: boolean;
}

export function TabSlack({ site }: { site: Site }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slackStatus = searchParams.get("slack");

  const workspaceConnected = !!site.slackWorkspaceName;
  const channelConnected = !!site.slackChannelName;

  const [channels, setChannels] = useState<SlackChannelOption[]>([]);
  const [channelsLoaded, setChannelsLoaded] = useState(false);
  const [loadingChannels, setLoadingChannels] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [isSavingChannel, setIsSavingChannel] = useState(false);

  useEffect(() => {
    if (slackStatus === "installed") {
      toast.success("Slack workspace connected", {
        description: "Now pick a channel to receive visitor messages.",
      });
    } else if (slackStatus === "error") {
      toast.error("Slack connection failed", {
        description: "Try connecting again. If it keeps failing, check your Slack app settings.",
      });
    }
  }, [slackStatus]);

  const handleLoadChannels = async () => {
    setLoadingChannels(true);
    const result = await listSlackChannels(site.id);
    setLoadingChannels(false);

    if (result.error) {
      toast.error(result.error);
    } else if (result.channels) {
      setChannels(result.channels);
      setChannelsLoaded(true);
    }
  };

  const handleSaveChannel = async () => {
    if (!selectedChannelId) return;
    const channel = channels.find((c) => c.id === selectedChannelId);
    if (!channel) return;

    setIsSavingChannel(true);
    const result = await connectSlackChannel(site.id, channel.id, channel.name);
    setIsSavingChannel(false);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Channel connected", {
        description: "Visitor messages will be posted to this channel.",
      });
      router.refresh();
    }
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
                  {channelConnected
                    ? "Visitor messages route into this Slack workspace."
                    : "Connect Slack to start receiving visitor messages."}
                </CardDescription>
              </div>
            </div>
            <StatusBadge tone={channelConnected ? "success" : "muted"} dot={channelConnected} pulse={channelConnected}>
              {channelConnected ? "Connected" : "Not connected"}
            </StatusBadge>
          </div>
        </CardHeader>

        {channelConnected ? (
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
                <dd className="mt-1 text-sm text-foreground">#{site.slackChannelName}</dd>
              </div>
            </dl>
            <div className="mt-5">
              <Button
                variant="ghost"
                className="h-9 px-4 text-muted-foreground"
                onClick={() =>
                  toast.info("Disconnecting Slack isn't wired up yet in this preview.")
                }
              >
                Disconnect
              </Button>
            </div>
          </CardContent>
        ) : workspaceConnected ? (
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Pick the Slack channel where visitor messages should be posted. Then invite the Crolyo bot to that channel.
              </p>
              {channelsLoaded ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="slack-channel">Channel</Label>
                    <select
                      id="slack-channel"
                      value={selectedChannelId}
                      onChange={(e) => setSelectedChannelId(e.target.value)}
                      className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    >
                      <option value="">Select a channel</option>
                      {channels.map((channel) => (
                        <option key={channel.id} value={channel.id}>
                          {channel.is_private ? "🔒 " : "# "}
                          {channel.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-muted-foreground">
                      Don&apos;t see a channel? Make sure the Crolyo bot is invited to it.
                    </p>
                  </div>
                  <Button
                    onClick={handleSaveChannel}
                    disabled={!selectedChannelId || isSavingChannel}
                    className="h-9 gap-2 px-4"
                  >
                    {isSavingChannel ? "Saving…" : "Connect channel"}
                  </Button>
                </>
              ) : (
                <Button
                  onClick={handleLoadChannels}
                  disabled={loadingChannels}
                  variant="outline"
                  className="h-9 gap-2 px-4"
                >
                  {loadingChannels ? "Loading channels…" : "Choose a channel"}
                </Button>
              )}
            </div>
          </CardContent>
        ) : (
          <CardContent>
            <div className="flex flex-col items-start gap-4">
              <p className="text-sm text-muted-foreground">
                Authorize the Crolyo app in your Slack workspace. Every visitor message will appear in a channel of your choice, and your team replies right inside Slack.
              </p>
              <Button
                className="h-9 gap-2 px-4"
                render={<a href={`/api/slack/install?site_id=${site.id}`} />}
              >
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
