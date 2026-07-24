"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2Icon } from "lucide-react";

import type { Site } from "@/lib/types";
import { useSites } from "@/components/dashboard/sites-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { clientLogger } from "@/lib/logger.client";

function parseAllowedDomains(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatAllowedDomains(domains: string[]): string {
  return domains.join("\n");
}

export function TabSiteSettings({ site }: { site: Site }) {
  const router = useRouter();
  const { deleteSite, updateSite } = useSites();
  const [name, setName] = useState(site.name);
  const [domain, setDomain] = useState(site.domain);
  const [allowedDomains, setAllowedDomains] = useState(
    formatAllowedDomains(site.allowedDomains)
  );
  const [isSaving, startSave] = useTransition();
  const [isDeleting, startDelete] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    clientLogger.info("ui.sites.update.submitted", { siteId: site.id });
    startSave(async () => {
      const result = await updateSite({
        id: site.id,
        name: name.trim(),
        domain,
        allowedDomains: parseAllowedDomains(allowedDomains),
        primaryColor: site.primaryColor,
        welcomeMessage: site.welcomeMessage,
      });
      if (result.error || !result.site) {
        clientLogger.warn("ui.sites.update.failed", { siteId: site.id });
        toast.error(result.error ?? "Could not save settings.");
        return;
      }
      setName(result.site.name);
      setDomain(result.site.domain);
      setAllowedDomains(formatAllowedDomains(result.site.allowedDomains));
      clientLogger.info("ui.sites.update.succeeded", { siteId: site.id });
      toast.success("Site settings saved");
    });
  };

  const handleDelete = () => {
    clientLogger.info("ui.sites.delete.confirmed", { siteId: site.id });
    startDelete(async () => {
      const result = await deleteSite({ id: site.id });
      if (result.error) {
        clientLogger.warn("ui.sites.delete.failed", { siteId: site.id });
        toast.error(result.error);
        return;
      }
      setDeleteOpen(false);
      clientLogger.info("ui.sites.delete.succeeded", { siteId: site.id });
      toast.success("Site deleted");
      router.push("/overview");
    });
  };

  return (
    <div className="space-y-8">
      <form onSubmit={handleSave} className="space-y-5">
        <section className="space-y-4">
          <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
            Site details
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="site-name">Site name</Label>
              <Input
                id="site-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSaving}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="site-domain">Primary domain</Label>
              <Input
                id="site-domain"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="font-mono text-sm"
                placeholder="example.com"
                disabled={isSaving}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="allowed-domains">Allowed domains</Label>
            <Textarea
              id="allowed-domains"
              value={allowedDomains}
              onChange={(e) => setAllowedDomains(e.target.value)}
              rows={4}
              className="resize-none font-mono text-sm"
              placeholder={"example.com\nwww.example.com"}
              disabled={isSaving}
            />
            <p className="text-xs text-muted-foreground">
              One domain per line. The widget only loads on these domains.
            </p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" className="h-9 px-4" disabled={isSaving}>
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </section>
      </form>

      <Separator />

      <section className="space-y-4">
        <h2 className="font-heading text-base font-semibold tracking-tight text-foreground">
          Danger zone
        </h2>
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-medium text-foreground">Delete this site</p>
            <p className="text-xs text-muted-foreground">
              Permanently remove {site.name}, its widget config, and all conversations.
            </p>
          </div>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger render={<Button variant="destructive" className="h-9 gap-2 px-4" />}>
              <Trash2Icon className="size-4" />
              Delete site
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete {site.name}?</DialogTitle>
                <DialogDescription>
                  This can&apos;t be undone. The site, its widget configuration, and all conversation history will be permanently removed.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting…" : "Delete site"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>
    </div>
  );
}
