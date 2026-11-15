"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { HashIcon, LockIcon, MessageSquareIcon, PlugIcon, RefreshCwIcon, TriangleAlertIcon } from "lucide-react";

import type { Site } from "@/lib/types";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { useSites } from "@/components/dashboard/sites-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function TabSlack({ site }: { site: Site }) {
  const { refresh } = useSites();
  const searchParams = useSearchParams();
  const slackStatus = searchParams.get("slack");

  const workspaceConnected = !!site.slackWorkspaceName;
  const channelConnected = !!site.slackChannelName;
  const installHref = `/api/slack/install?site_id=${site.id}`;

  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [isChangingChannel, setIsChangingChannel] = useState(false);

  useEffect(() => {
    if (slackStatus === "choose_channel") {
      toast.success("Slack workspace connected", {
        description: "Now choose the channel visitor chats should go to.",
      });
    } else if (slackStatus === "installed") {
      toast.success("Slack connected", {
        description: "Visitor messages will be posted to your chosen channel.",
      });
    } else if (slackStatus === "needs_invite") {
      toast.warning("One more step in Slack", {
        description: "Invite the Crolyo app to the channel you picked (type /invite @Crolyo there) so your replies reach visitors.",
        duration: 15000,
      });
    } else if (slackStatus === "error") {
      toast.error("Slack connection failed", {
        description: "Try connecting again. If it keeps failing, check your Slack app settings.",
      });
    }
  }, [slackStatus]);

  const handleDisconnect = async () => {
    if (!confirm("Uninstall Crolyo from your Slack workspace? Visitor messages will stop flowing, and you'll need to reinstall the app to reconnect."))
      return;
    setIsDisconnecting(true);
    try {
      const res = await fetch(`/api/slack/disconnect?site_id=${site.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }
      toast.success("Slack workspace disconnected.");
      await refresh();
    } catch {
      toast.error("Could not disconnect Slack. Please try again.");
    } finally {
      setIsDisconnecting(false);
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
                    : workspaceConnected
                      ? "Pick a channel to start receiving visitor messages."
                      : "Connect Slack to start receiving visitor messages."}
                </CardDescription>
              </div>
            </div>
            <StatusBadge
              tone={channelConnected ? "success" : workspaceConnected ? "warning" : "muted"}
              dot={channelConnected}
              pulse={channelConnected}
            >
              {channelConnected ? "Connected" : workspaceConnected ? "Setup incomplete" : "Not connected"}
            </StatusBadge>
          </div>
        </CardHeader>

        {workspaceConnected && (!channelConnected || isChangingChannel) ? (
          <CardContent>
            <ChannelPicker
              siteId={site.id}
              onCancel={channelConnected ? () => setIsChangingChannel(false) : undefined}
              onSaved={async () => {
                setIsChangingChannel(false);
                await refresh();
              }}
            />
          </CardContent>
        ) : channelConnected ? (
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
            <div className="mt-5 flex flex-wrap gap-3">
              <Button variant="outline" className="h-9 gap-2 px-4" onClick={() => setIsChangingChannel(true)}>
                <HashIcon className="size-4" />
                Change channel
              </Button>
              <Button
                variant="destructive"
                className="h-9 gap-2 px-4"
                disabled={isDisconnecting}
                onClick={handleDisconnect}
              >
                {isDisconnecting ? (
                  "Uninstalling…"
                ) : (
                  <>
                    <TriangleAlertIcon className="size-4" />
                    Uninstall app
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        ) : (
          <CardContent>
            <div className="flex flex-col items-start gap-4">
              <p className="text-sm text-muted-foreground">
                Add Crolyo to Slack, then pick the channel it should post to. Every visitor message will appear there, and your team replies right inside Slack.
              </p>
              <Button
                className="h-9 gap-2 px-4"
                nativeButton={false}
                render={<a href={installHref} />}
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

type ChannelOption = { id: string; name: string; isPrivate: boolean };
type ChannelsResult = { channels: ChannelOption[] } | { error: string };

async function fetchChannels(siteId: string): Promise<ChannelsResult> {
  try {
    const res = await fetch(`/api/slack/channels?site_id=${siteId}`);
    const data = await res.json();
    if (!res.ok || data.error) return { error: data.error ?? "Could not load channels." };
    return { channels: data.channels };
  } catch {
    return { error: "Could not load channels. Please try again." };
  }
}

function ChannelPicker({
  siteId,
  onSaved,
  onCancel,
}: {
  siteId: string;
  onSaved: () => Promise<void>;
  onCancel?: () => void;
}) {
  const [channels, setChannels] = useState<ChannelOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const applyResult = useCallback((result: ChannelsResult) => {
    if ("error" in result) setLoadError(result.error);
    else setChannels(result.channels);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetchChannels(siteId).then((result) => {
      if (!cancelled) applyResult(result);
    });
    return () => {
      cancelled = true;
    };
  }, [siteId, applyResult]);

  const load = () => {
    setLoadError(null);
    setChannels(null);
    void fetchChannels(siteId).then(applyResult);
  };

  const handleSave = async () => {
    if (!selected) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/slack/channels?site_id=${siteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: selected }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        toast.error(data.error ?? "Could not save the channel.");
        return;
      }
      if (data.status === "needs_invite") {
        toast.warning("One more step in Slack", {
          description: "Invite the Crolyo app to that channel (type /invite @Crolyo there) so your replies reach visitors.",
          duration: 15000,
        });
      } else {
        toast.success("Channel saved", { description: "Visitor messages will be posted there." });
      }
      await onSaved();
    } catch {
      toast.error("Could not save the channel. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-3">
      <label htmlFor="slack-channel" className="text-sm font-medium text-foreground">
        Choose a channel for visitor chats
      </label>
      {loadError ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="outline" className="h-8 gap-2 px-3" onClick={load}>
            <RefreshCwIcon className="size-3.5" />
            Retry
          </Button>
        </div>
      ) : (
        <div className="flex w-full max-w-md items-center gap-2">
          <select
            id="slack-channel"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={!channels || isSaving}
            className="h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30"
          >
            <option value="" disabled>
              {channels ? (channels.length ? "Select a channel…" : "No channels found") : "Loading channels…"}
            </option>
            {channels?.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.isPrivate ? "🔒 " : "#"}
                {channel.name}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            className="h-9 shrink-0 px-2.5"
            aria-label="Refresh channel list"
            disabled={!channels || isSaving}
            onClick={load}
          >
            <RefreshCwIcon className="size-4" />
          </Button>
        </div>
      )}
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <LockIcon className="size-3" />
        Private channels show up after you invite @Crolyo to them in Slack.
      </p>
      <div className="mt-1 flex gap-3">
        <Button className="h-9 gap-2 px-4" disabled={!selected || isSaving} onClick={handleSave}>
          <HashIcon className="size-4" />
          {isSaving ? "Saving…" : "Save channel"}
        </Button>
        {onCancel && (
          <Button variant="outline" className="h-9 px-4" disabled={isSaving} onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
