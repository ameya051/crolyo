"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, CheckIcon, PlugIcon } from "lucide-react";
import { toast } from "sonner";

import { EmbedSnippet } from "@/components/dashboard/embed-snippet";
import { Reveal } from "@/components/dashboard/reveal";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewSitePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [color, setColor] = useState("#f97316");
  const [created, setCreated] = useState<{ id: string; name: string; domain: string } | null>(null);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !domain.trim()) {
      toast.error("Add a site name and a domain to continue.");
      return;
    }
    const id = `site_${Math.random().toString(36).slice(2, 10)}`;
    setCreated({ id, name: name.trim(), domain: domain.trim().replace(/^https?:\/\//, "") });
    toast.success("Site created", {
      description: "Next, connect Slack and drop the widget on your site.",
    });
  };

  const handleConnectSlack = () => {
    toast.info("Slack OAuth isn't wired up yet", {
      description: "You can do this later from the site's Slack tab.",
    });
  };

  if (created) {
    return (
      <Reveal className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-slack-green/15 text-slack-green">
            <CheckIcon className="size-5" />
          </span>
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
              {created.name} is ready
            </h1>
            <p className="font-mono text-xs text-muted-foreground">{created.domain}</p>
          </div>
        </div>

        <Card className="[--card-spacing:1.5rem]">
          <CardHeader>
            <CardTitle>1. Add the widget to your site</CardTitle>
            <CardDescription>
              Paste this before the closing body tag on every page where you want chat.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmbedSnippet siteId={created.id} />
          </CardContent>
        </Card>

        <Card className="[--card-spacing:1.5rem]">
          <CardHeader>
            <CardTitle>2. Connect Slack</CardTitle>
            <CardDescription>
              So visitor messages land in a channel your team already watches.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleConnectSlack} className="h-9 gap-2 px-4">
              <PlugIcon className="size-4" />
              Connect Slack
            </Button>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Link href="/overview" className={buttonVariants({ variant: "ghost", className: "h-9 gap-1.5 px-3" })}>
            <ArrowLeftIcon className="size-4" />
            Back to overview
          </Link>
          <Button
            variant="outline"
            className="h-9 px-4"
            onClick={() => router.push("/overview")}
          >
            Done
          </Button>
        </div>
      </Reveal>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Add a new site
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Start with the basics. You can tune the widget and Slack routing next.
        </p>
      </div>

      <Card className="[--card-spacing:1.5rem]">
        <form onSubmit={handleCreate} className="space-y-5">
          <CardHeader>
            <CardTitle>Site details</CardTitle>
            <CardDescription>This is how your site shows up in the dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Site name</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Acme Store"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain">Primary domain</Label>
              <Input
                id="domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="acmestore.com"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Don&apos;t include <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">https://</code>. You can add more domains later.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Widget brand color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="size-9 shrink-0 cursor-pointer rounded-lg border border-border bg-background p-1"
                  aria-label="Pick brand color"
                />
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono text-sm uppercase" />
              </div>
            </div>
          </CardContent>
          <div className="flex items-center justify-between gap-3 px-6 pb-6">
            <Link href="/overview" className={buttonVariants({ variant: "ghost", className: "h-9 px-3" })}>
              Cancel
            </Link>
            <Button type="submit" className="h-9 px-4">Create site</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
