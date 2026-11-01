"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  FileTextIcon,
  GlobeIcon,
  LibraryIcon,
  PencilIcon,
  RefreshCwIcon,
  TextIcon,
  Trash2Icon,
  UploadIcon,
  WebhookIcon,
} from "lucide-react";
import { toast } from "sonner";

import {
  deleteSource,
  getTextSourceContent,
  removeWebhook,
  resyncSource,
  rotateWebhookToken,
  updateSyncInterval,
  updateTextSource,
} from "@/app/actions/knowledge";
import {
  AddSourceDialog,
  parseInterval,
  selectClassName,
  SYNC_INTERVAL_CHOICES,
} from "@/components/dashboard/knowledge/add-source-dialog";
import { uploadKnowledgeFile } from "@/components/dashboard/knowledge/upload";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { KnowledgeSource, Site } from "@/lib/types";
import { MAX_TEXT_SOURCE_CHARS } from "@/lib/validations/knowledge";

type Props = {
  site: Site;
  sources: KnowledgeSource[];
  isLoading: boolean;
  loadError: string | null;
  onChanged: () => Promise<void>;
};

export function SourcesCard({ site, sources, isLoading, loadError, onChanged }: Props) {
  return (
    <Card className="[--card-spacing:1.5rem]">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
              <LibraryIcon className="size-5" />
            </span>
            <div>
              <CardTitle>Knowledge sources</CardTitle>
              <CardDescription>Web pages, documents and text the agent can answer from.</CardDescription>
            </div>
          </div>
          <AddSourceDialog siteId={site.id} onAdded={onChanged} />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((index) => (
              <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : loadError ? (
          <p className="text-sm text-destructive">{loadError}</p>
        ) : sources.length === 0 ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No sources yet. Add your help center, FAQ page, docs or policies to get started.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {sources.map((source) => (
              <SourceRow key={source.id} siteId={site.id} source={source} onChanged={onChanged} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function sourceIcon(source: KnowledgeSource) {
  if (source.type === "url") return <GlobeIcon className="size-4" />;
  if (source.type === "file") return <FileTextIcon className="size-4" />;
  return <TextIcon className="size-4" />;
}

function SourceStatus({ source }: { source: KnowledgeSource }) {
  if (source.liveJobStatus === "running" || source.status === "processing") {
    return (
      <StatusBadge tone="warning" dot pulse>
        {source.activeVersion > 0 ? "Updating" : "Processing"}
      </StatusBadge>
    );
  }
  if (source.liveJobStatus === "queued" || source.status === "pending") {
    return <StatusBadge tone="muted">Queued</StatusBadge>;
  }
  if (source.status === "failed") {
    return (
      <StatusBadge tone="warning">{source.activeVersion > 0 ? "Sync failed, using previous version" : "Failed"}</StatusBadge>
    );
  }
  return (
    <StatusBadge tone="success" dot>
      Ready
    </StatusBadge>
  );
}

function formatRelative(value: string | null): string {
  if (!value) return "never";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "never";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function SourceRow({
  siteId,
  source,
  onChanged,
}: {
  siteId: string;
  source: KnowledgeSource;
  onChanged: () => Promise<void>;
}) {
  const [isPending, startAction] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const closeEdit = useCallback(() => setEditOpen(false), []);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  const run = (action: () => Promise<{ error?: string }>, success: string) => {
    startAction(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      await onChanged();
    });
  };

  const handleDelete = () => {
    if (!confirm(`Delete "${source.title}"? The agent will stop using it right away.`)) return;
    run(() => deleteSource(source.id), "Source deleted");
  };

  const handleReplace = (file: File | undefined) => {
    if (!file) return;
    run(() => uploadKnowledgeFile({ siteId, file, sourceId: source.id }), "File replaced. Re-indexing now.");
    if (replaceInput.current) replaceInput.current.value = "";
  };

  const handleWebhook = () => {
    startAction(async () => {
      const result = await rotateWebhookToken(source.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setWebhookUrl(result.data.url);
      await onChanged();
    });
  };

  const details = [
    source.type === "url" ? `${source.pageCount} page${source.pageCount === 1 ? "" : "s"}` : null,
    `${source.chunkCount} passage${source.chunkCount === 1 ? "" : "s"}`,
    `Synced ${formatRelative(source.lastSyncedAt)}`,
    source.stalePageCount > 0
      ? `${source.stalePageCount} page${source.stalePageCount === 1 ? "" : "s"} couldn't be reached, using the last copy`
      : null,
  ].filter(Boolean);

  return (
    <li className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
          {sourceIcon(source)}
        </span>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-medium text-foreground">{source.title}</p>
            <SourceStatus source={source} />
          </div>
          {source.url ? (
            <a
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="block truncate font-mono text-xs text-muted-foreground hover:underline"
            >
              {source.url}
              {source.crawl ? " (and linked pages)" : ""}
            </a>
          ) : null}
          <p className="text-xs text-muted-foreground">{details.join(" · ")}</p>
          {source.status === "failed" && source.error ? (
            <p className="text-xs text-destructive">{source.error}</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {source.type === "url" ? (
          <select
            aria-label="Check for updates"
            className={`${selectClassName} h-8 w-auto text-xs`}
            value={source.syncIntervalHours === null ? "manual" : String(source.syncIntervalHours)}
            disabled={isPending}
            onChange={(event) =>
              run(
                () => updateSyncInterval({ sourceId: source.id, syncIntervalHours: parseInterval(event.target.value) }),
                "Schedule updated"
              )
            }
          >
            {SYNC_INTERVAL_CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        ) : null}
        {source.type !== "text" ? (
          <Button
            variant="outline"
            size="sm"
            disabled={isPending || source.liveJobStatus !== null}
            onClick={() => run(() => resyncSource(source.id), "Sync queued")}
          >
            <RefreshCwIcon />
            Re-sync
          </Button>
        ) : null}
        {source.type === "url" ? (
          <Button variant="outline" size="sm" disabled={isPending} onClick={handleWebhook}>
            <WebhookIcon />
            {source.hasWebhook ? "New webhook URL" : "Webhook"}
          </Button>
        ) : null}
        {source.type === "file" ? (
          <>
            <input
              ref={replaceInput}
              type="file"
              className="hidden"
              accept=".pdf,.docx,.txt,.md,.markdown"
              onChange={(event) => handleReplace(event.target.files?.[0])}
            />
            <Button variant="outline" size="sm" disabled={isPending} onClick={() => replaceInput.current?.click()}>
              <UploadIcon />
              Replace
            </Button>
          </>
        ) : null}
        {source.type === "text" ? (
          <Button variant="outline" size="sm" disabled={isPending} onClick={() => setEditOpen(true)}>
            <PencilIcon />
            Edit
          </Button>
        ) : null}
        <Button variant="destructive" size="sm" disabled={isPending} onClick={handleDelete}>
          <Trash2Icon />
          Delete
        </Button>
      </div>

      {source.type === "text" && editOpen ? (
        <EditTextDialog source={source} onClose={closeEdit} onSaved={onChanged} />
      ) : null}
      <WebhookDialog
        url={webhookUrl}
        onClose={() => setWebhookUrl(null)}
        onRemove={() =>
          run(async () => {
            const result = await removeWebhook(source.id);
            if (!result.error) setWebhookUrl(null);
            return result;
          }, "Webhook removed")
        }
      />
    </li>
  );
}

/** Mounted only while open; loads the current text on open. */
function EditTextDialog({
  source,
  onClose,
  onSaved,
}: {
  source: KnowledgeSource;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(source.title);
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [isSaving, startSave] = useTransition();

  useEffect(() => {
    let active = true;
    getTextSourceContent(source.id).then((result) => {
      if (!active) return;
      if (!result.ok) {
        toast.error(result.error);
        onClose();
        return;
      }
      setTitle(result.data.title);
      setContent(result.data.content);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [source.id, onClose]);

  const handleSave = (event: React.FormEvent) => {
    event.preventDefault();
    startSave(async () => {
      const result = await updateTextSource({ sourceId: source.id, title, content });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Saved. Re-indexing now.");
      onClose();
      await onSaved();
    });
  };

  return (
    <Dialog open onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSave} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Edit text source</DialogTitle>
            <DialogDescription>The agent switches to the new text as soon as it&apos;s re-indexed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`edit-title-${source.id}`}>Title</Label>
            <Input
              id={`edit-title-${source.id}`}
              value={title}
              maxLength={300}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-content-${source.id}`}>Content</Label>
            <Textarea
              id={`edit-content-${source.id}`}
              value={content}
              rows={10}
              maxLength={MAX_TEXT_SOURCE_CHARS}
              disabled={!loaded}
              placeholder={loaded ? undefined : "Loading…"}
              onChange={(event) => setContent(event.target.value)}
            />
          </div>
          <DialogFooter>
            <Button type="submit" className="h-9 px-4" disabled={isSaving || !loaded || !title.trim() || !content.trim()}>
              {isSaving ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function WebhookDialog({ url, onClose, onRemove }: { url: string | null; onClose: () => void; onRemove: () => void }) {
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Webhook URL copied");
    } catch {
      toast.error("Couldn't copy. Select the URL and copy it manually.");
    }
  };

  return (
    <Dialog open={url !== null} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sync webhook</DialogTitle>
          <DialogDescription>
            Send a POST request to this URL from your CMS publish hook or deploy pipeline and this source re-syncs within
            seconds. Copy it now: for security it won&apos;t be shown again. Creating a new one disables the old URL.
          </DialogDescription>
        </DialogHeader>
        <Input readOnly value={url ?? ""} className="font-mono text-xs" onFocus={(event) => event.target.select()} />
        <DialogFooter className="gap-2">
          <Button variant="destructive" className="h-9 px-4" onClick={onRemove}>
            Disable webhook
          </Button>
          <Button className="h-9 px-4" onClick={copy}>
            Copy URL
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
