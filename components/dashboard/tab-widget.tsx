"use client";

import { useState } from "react";
import { toast } from "sonner";

import type { Site } from "@/app/(protected)/_lib/types";
import { WidgetPreview } from "@/components/dashboard/widget-preview";
import { EmbedSnippet } from "@/components/dashboard/embed-snippet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function TabWidget({ site }: { site: Site }) {
  const [color, setColor] = useState(site.primaryColor);
  const [welcome, setWelcome] = useState(site.welcomeMessage);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Widget settings saved", {
      description: "Visitors will see the updated widget on next load.",
    });
  };

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-1 font-heading text-base font-semibold tracking-tight text-foreground">
          Live preview
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          How visitors will see the chat on {site.domain}.
        </p>
        <WidgetPreview primaryColor={color} welcomeMessage={welcome} siteName={site.name} />
      </section>

      <form onSubmit={handleSave} className="space-y-5">
        <section>
          <h2 className="mb-4 font-heading text-base font-semibold tracking-tight text-foreground">
            Customize
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="primary-color">Brand color</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="primary-color"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="size-9 shrink-0 cursor-pointer rounded-lg border border-border bg-background p-1"
                    aria-label="Pick brand color"
                  />
                  <Input
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="font-mono text-sm uppercase"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="welcome-message">Welcome message</Label>
              <Textarea
                id="welcome-message"
                value={welcome}
                onChange={(e) => setWelcome(e.target.value)}
                rows={3}
                className="resize-none"
                placeholder="The first message a visitor sees when they open the chat."
              />
              <p className="text-xs text-muted-foreground">
                Keep it short and friendly. Visitors see this before they type anything.
              </p>
            </div>
          </div>
          <div className="mt-5 flex justify-end">
            <Button type="submit" className="h-9 px-4">Save changes</Button>
          </div>
        </section>
      </form>

      <section>
        <h2 className="mb-1 font-heading text-base font-semibold tracking-tight text-foreground">
          Install on your site
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Paste this snippet before the closing <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">&lt;/body&gt;</code> tag on every page where you want the widget.
        </p>
        <EmbedSnippet siteId={site.id} />
        {site.widgetStatus === "not-installed" ? (
          <p className="mt-3 text-xs text-muted-foreground">
            We haven&apos;t detected the widget on {site.domain} yet. It can take a few minutes after you add the snippet.
          </p>
        ) : null}
      </section>
    </div>
  );
}
