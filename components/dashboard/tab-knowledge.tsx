"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { listKnowledgeConflicts, listKnowledgeSources } from "@/app/actions/knowledge";
import { AgentSettingsCard } from "@/components/dashboard/knowledge/agent-settings-card";
import { ConflictsCard } from "@/components/dashboard/knowledge/conflicts-card";
import { SourcesCard } from "@/components/dashboard/knowledge/sources-card";
import type { KnowledgeConflict, KnowledgeSource, Site } from "@/lib/types";

const POLL_INTERVAL_MS = 3_000;

function fetchKnowledge(siteId: string) {
  return Promise.all([listKnowledgeSources(siteId), listKnowledgeConflicts(siteId)]);
}

function isBusy(source: KnowledgeSource): boolean {
  return source.liveJobStatus !== null || source.status === "pending" || source.status === "processing";
}

export function TabKnowledge({ site }: { site: Site }) {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [conflicts, setConflicts] = useState<KnowledgeConflict[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apply = useCallback((results: Awaited<ReturnType<typeof fetchKnowledge>>) => {
    const [sourcesResult, conflictsResult] = results;
    if (!sourcesResult.ok) {
      setLoadError(sourcesResult.error);
    } else {
      setSources(sourcesResult.data);
      setLoadError(null);
    }
    if (conflictsResult.ok) setConflicts(conflictsResult.data);
    setIsLoading(false);
  }, []);

  const load = useCallback(async () => {
    apply(await fetchKnowledge(site.id));
  }, [apply, site.id]);

  useEffect(() => {
    let active = true;
    fetchKnowledge(site.id).then((results) => {
      if (active) apply(results);
    });
    return () => {
      active = false;
    };
  }, [apply, site.id]);

  const anyBusy = sources.some(isBusy);
  useEffect(() => {
    if (!anyBusy) return;
    const timer = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [anyBusy, load]);

  const refresh = useCallback(async () => {
    try {
      await load();
    } catch {
      toast.error("Could not refresh knowledge sources.");
    }
  }, [load]);

  const readySourceCount = sources.filter((source) => source.activeVersion > 0).length;

  return (
    <div className="space-y-6">
      <AgentSettingsCard site={site} readySourceCount={readySourceCount} />
      <SourcesCard
        site={site}
        sources={sources}
        isLoading={isLoading}
        loadError={loadError}
        onChanged={refresh}
      />
      {conflicts.length > 0 ? <ConflictsCard conflicts={conflicts} /> : null}
    </div>
  );
}
