"use client";

import { GitCompareArrowsIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { KnowledgeConflict } from "@/lib/types";

export function ConflictsCard({ conflicts }: { conflicts: KnowledgeConflict[] }) {
  return (
    <Card className="[--card-spacing:1.5rem]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <GitCompareArrowsIcon className="size-5" />
          </span>
          <div>
            <CardTitle>Possible conflicts</CardTitle>
            <CardDescription>
              These passages look like they cover the same thing but say it differently, for example an old PDF and an
              updated page. The agent trusts the most recently synced source, but deleting or re-syncing the stale one
              keeps answers clean.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {conflicts.map((conflict) => (
            <li key={conflict.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
              {[conflict.chunk, conflict.otherChunk].map((side, index) => (
                <div key={`${conflict.id}-${index}`} className="min-w-0">
                  <p className="truncate text-xs font-medium text-foreground">{side.sourceTitle}</p>
                  {side.title ? <p className="truncate text-xs text-muted-foreground">{side.title}</p> : null}
                  <p className="mt-1 text-xs text-muted-foreground">{side.excerpt}</p>
                </div>
              ))}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
