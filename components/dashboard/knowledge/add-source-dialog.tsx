"use client";

import { useRef, useState, useTransition } from "react";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { addTextSource, addUrlSource } from "@/app/actions/knowledge";
import { uploadKnowledgeFile } from "@/components/dashboard/knowledge/upload";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { clientLogger } from "@/lib/logger.client";
import { MAX_TEXT_SOURCE_CHARS } from "@/lib/validations/knowledge";

type Kind = "url" | "file" | "text";

export const SYNC_INTERVAL_CHOICES: { value: string; label: string }[] = [
  { value: "6", label: "Every 6 hours" },
  { value: "24", label: "Daily" },
  { value: "168", label: "Weekly" },
  { value: "manual", label: "Manually only" },
];

export function parseInterval(value: string): number | null {
  return value === "manual" ? null : Number(value);
}

export const selectClassName =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function AddSourceDialog({ siteId, onAdded }: { siteId: string; onAdded: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("url");
  const [url, setUrl] = useState("");
  const [crawl, setCrawl] = useState(false);
  const [interval, setInterval] = useState("24");
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, startSubmit] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);

  const reset = () => {
    setUrl("");
    setCrawl(false);
    setInterval("24");
    setFile(null);
    setTitle("");
    setContent("");
    if (fileInput.current) fileInput.current.value = "";
  };

  const canSubmit =
    (kind === "url" && url.trim().length > 0) ||
    (kind === "file" && file !== null) ||
    (kind === "text" && title.trim().length > 0 && content.trim().length > 0);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    clientLogger.info("ui.knowledge.source.add.submitted", { siteId, kind });
    startSubmit(async () => {
      let error: string | undefined;
      if (kind === "url") {
        error = (await addUrlSource({ siteId, url, crawl, syncIntervalHours: parseInterval(interval) })).error;
      } else if (kind === "file" && file) {
        error = (await uploadKnowledgeFile({ siteId, file })).error;
      } else {
        error = (await addTextSource({ siteId, title, content })).error;
      }
      if (error) {
        toast.error(error);
        return;
      }
      toast.success("Source added", { description: "It'll be ready to answer questions in a moment." });
      reset();
      setOpen(false);
      await onAdded();
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="h-9 gap-2 px-4" />}>
        <PlusIcon className="size-4" />
        Add source
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Add a knowledge source</DialogTitle>
            <DialogDescription>The AI agent answers visitors using only what you add here.</DialogDescription>
          </DialogHeader>

          <Tabs value={kind} onValueChange={(value) => setKind(value as Kind)}>
            <TabsList className="h-9 w-full">
              <TabsTrigger value="url" className="flex-1">Web link</TabsTrigger>
              <TabsTrigger value="file" className="flex-1">Document</TabsTrigger>
              <TabsTrigger value="text" className="flex-1">Text</TabsTrigger>
            </TabsList>

            <TabsContent value="url" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="source-url">Page URL</Label>
                <Input
                  id="source-url"
                  value={url}
                  placeholder="https://example.com/help"
                  onChange={(event) => setUrl(event.target.value)}
                />
              </div>
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 accent-primary"
                  checked={crawl}
                  onChange={(event) => setCrawl(event.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium text-foreground">Also add linked pages</span>
                  <span className="block text-xs text-muted-foreground">
                    Follows links on the same domain, up to 20 pages.
                  </span>
                </span>
              </label>
              <div className="space-y-2">
                <Label htmlFor="source-interval">Check for updates</Label>
                <select
                  id="source-interval"
                  className={selectClassName}
                  value={interval}
                  onChange={(event) => setInterval(event.target.value)}
                >
                  {SYNC_INTERVAL_CHOICES.map((choice) => (
                    <option key={choice.value} value={choice.value}>
                      {choice.label}
                    </option>
                  ))}
                </select>
              </div>
            </TabsContent>

            <TabsContent value="file" className="mt-4 space-y-2">
              <Label htmlFor="source-file">File</Label>
              <Input
                id="source-file"
                ref={fileInput}
                type="file"
                accept=".pdf,.docx,.txt,.md,.markdown"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
              <p className="text-xs text-muted-foreground">
                PDF, Word (.docx), text or Markdown, up to 20 MB. Scanned PDFs without selectable text aren&apos;t
                supported yet.
              </p>
            </TabsContent>

            <TabsContent value="text" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="source-title">Title</Label>
                <Input
                  id="source-title"
                  value={title}
                  maxLength={300}
                  placeholder="Shipping FAQ"
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="source-content">Content</Label>
                <Textarea
                  id="source-content"
                  value={content}
                  rows={8}
                  maxLength={MAX_TEXT_SOURCE_CHARS}
                  placeholder="Paste answers, policies or any text visitors ask about."
                  onChange={(event) => setContent(event.target.value)}
                />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="submit" className="h-9 px-4" disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? "Adding…" : "Add source"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
