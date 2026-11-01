"use client";

import { useState, useTransition } from "react";
import { BotIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { updateAgentSettings } from "@/app/actions/knowledge";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { clientLogger } from "@/lib/logger.client";
import type { Site } from "@/lib/types";

const MAX_INSTRUCTIONS = 2000;

export function AgentSettingsCard({ site, readySourceCount }: { site: Site; readySourceCount: number }) {
  // Local state on purpose: refreshing the sites provider would remount the tabs.
  const [enabled, setEnabled] = useState(site.aiAgentEnabled);
  const [instructions, setInstructions] = useState(site.aiAgentInstructions);
  const [saved, setSaved] = useState({ enabled: site.aiAgentEnabled, instructions: site.aiAgentInstructions });
  const [isSaving, startSave] = useTransition();

  const dirty = enabled !== saved.enabled || instructions !== saved.instructions;
  const slackConnected = site.slackStatus === "connected";

  const handleSave = () => {
    clientLogger.info("ui.knowledge.agent_settings.submitted", { siteId: site.id, enabled });
    startSave(async () => {
      const result = await updateAgentSettings({ siteId: site.id, enabled, instructions });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSaved({ enabled, instructions });
      toast.success(enabled ? "AI agent is on" : "AI agent settings saved", {
        description: enabled ? "New chats will be answered from your knowledge base." : undefined,
      });
    });
  };

  return (
    <Card className="[--card-spacing:1.5rem]">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BotIcon className="size-5" />
            </span>
            <div>
              <CardTitle>AI agent</CardTitle>
              <CardDescription>
                Answers low-risk questions from your knowledge base and hands everything else to your team in Slack.
              </CardDescription>
            </div>
          </div>
          <StatusBadge tone={saved.enabled ? "success" : "muted"} dot={saved.enabled}>
            {saved.enabled ? "On" : "Off"}
          </StatusBadge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {!slackConnected ? (
          <Notice>Connect Slack first. Escalated chats are handed to your team in a Slack thread.</Notice>
        ) : null}
        {enabled && readySourceCount === 0 ? (
          <Notice>
            Add at least one knowledge source. Without one, the agent will hand nearly every question to your team.
          </Notice>
        ) : null}

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-primary"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <span>
            <span className="block text-sm font-medium text-foreground">Let the AI agent answer new chats</span>
            <span className="block text-xs text-muted-foreground">
              It escalates when a visitor asks for a person, when a question is high risk (billing disputes, account
              access, legal, privacy, safety), or when your knowledge base doesn&apos;t cover it.
            </span>
          </span>
        </label>

        <div className="space-y-2">
          <Label htmlFor="agent-instructions">Instructions for the agent (optional)</Label>
          <Textarea
            id="agent-instructions"
            value={instructions}
            maxLength={MAX_INSTRUCTIONS}
            rows={4}
            placeholder="E.g. Keep a friendly, casual tone. Always hand off questions about enterprise pricing."
            onChange={(event) => setInstructions(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {instructions.length.toLocaleString()} / {MAX_INSTRUCTIONS.toLocaleString()}
          </p>
        </div>

        <Button className="h-9 px-4" disabled={!dirty || isSaving} onClick={handleSave}>
          {isSaving ? "Saving…" : "Save agent settings"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
      <TriangleAlertIcon className="mt-0.5 size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
