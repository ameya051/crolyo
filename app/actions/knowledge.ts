"use server";

import { randomUUID } from "crypto";

import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult, KnowledgeConflict, KnowledgeSource, KnowledgeSourceRow } from "@/lib/types";
import {
  addTextSourceSchema,
  addUrlSourceSchema,
  confirmFileUploadSchema,
  createFileUploadSchema,
  fileExtension,
  KNOWLEDGE_FILE_TYPES,
  MAX_SOURCES_PER_SITE,
  sourceIdSchema,
  updateAgentSettingsSchema,
  updateSyncIntervalSchema,
  updateTextSourceSchema,
} from "@/lib/validations/knowledge";
import { createSessionToken, hashSessionToken } from "@/lib/widget";

const BUCKET = "knowledge-files";
const SOURCE_COLUMNS =
  "id, site_id, type, title, url, crawl, sync_interval_hours, next_sync_at, webhook_token_hash, storage_path, file_name, mime_type, status, error, active_version, last_synced_at, page_count, chunk_count, created_at, updated_at";

type Fail = { error: string };

function firstIssue(error: { issues: { message: string }[] }): Fail {
  return { error: error.issues[0]?.message ?? "Please check the details and try again." };
}

async function requireOwnedSite(siteId: string): Promise<Fail | { siteId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  // RLS limits this to the caller's own sites.
  const { data: site, error } = await supabase.from("sites").select("id").eq("id", siteId).maybeSingle();
  if (error || !site) return { error: "Site not found." };
  return { siteId: site.id as string };
}

async function requireOwnedSource(
  sourceId: string
): Promise<Fail | { source: Pick<KnowledgeSourceRow, "id" | "site_id" | "type" | "storage_path" | "last_synced_at"> & { replaced_storage_path: string | null } }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const { data: source, error } = await supabase
    .from("knowledge_sources")
    .select("id, site_id, type, storage_path, replaced_storage_path, last_synced_at")
    .eq("id", sourceId)
    .maybeSingle();
  if (error || !source) return { error: "Source not found." };
  return { source: source as never };
}

async function enqueue(sourceId: string): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("enqueue_knowledge_job", { p_source_id: sourceId });
  if (error) throw error;
}

async function sourceCount(siteId: string): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("knowledge_sources")
    .select("id", { count: "exact", head: true })
    .eq("site_id", siteId);
  if (error) throw error;
  return count ?? 0;
}

function mapSource(
  row: KnowledgeSourceRow,
  liveJobs: Map<string, "queued" | "running">,
  stalePages: Map<string, number>
): KnowledgeSource {
  return {
    id: row.id,
    siteId: row.site_id,
    type: row.type,
    title: row.title,
    url: row.url,
    crawl: row.crawl,
    syncIntervalHours: row.sync_interval_hours,
    nextSyncAt: row.next_sync_at,
    hasWebhook: Boolean(row.webhook_token_hash),
    fileName: row.file_name,
    status: row.status,
    error: row.error,
    activeVersion: row.active_version,
    lastSyncedAt: row.last_synced_at,
    pageCount: row.page_count,
    chunkCount: row.chunk_count,
    liveJobStatus: liveJobs.get(row.id) ?? null,
    stalePageCount: stalePages.get(row.id) ?? 0,
    createdAt: row.created_at,
  };
}

export async function listKnowledgeSources(siteId: string): Promise<ActionResult<KnowledgeSource[]>> {
  const owned = await requireOwnedSite(siteId);
  if ("error" in owned) return owned;

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("knowledge_sources")
    .select(SOURCE_COLUMNS)
    .eq("site_id", siteId)
    .order("created_at", { ascending: false });
  if (error) {
    logger.error("knowledge.sources.list.failed", error, { siteId, errorCode: error.code });
    return { error: "Could not load knowledge sources." };
  }

  const sources = (rows ?? []) as KnowledgeSourceRow[];
  const ids = sources.map((source) => source.id);
  const liveJobs = new Map<string, "queued" | "running">();
  const stalePages = new Map<string, number>();

  if (ids.length > 0) {
    const [{ data: jobs }, { data: pages }] = await Promise.all([
      admin.from("knowledge_jobs").select("source_id, status").in("source_id", ids).in("status", ["queued", "running"]),
      admin.from("knowledge_pages").select("source_id, version").in("source_id", ids).not("stale_since", "is", null),
    ]);
    for (const job of jobs ?? []) liveJobs.set(job.source_id as string, job.status as "queued" | "running");
    const activeVersions = new Map(sources.map((source) => [source.id, source.active_version]));
    for (const page of pages ?? []) {
      if (activeVersions.get(page.source_id as string) !== page.version) continue;
      stalePages.set(page.source_id as string, (stalePages.get(page.source_id as string) ?? 0) + 1);
    }
  }

  return { ok: true, data: sources.map((row) => mapSource(row, liveJobs, stalePages)) };
}

type ConflictChunkRow = {
  id: string;
  title: string;
  content: string;
  source_id: string;
  knowledge_sources: { title: string } | null;
};

function excerpt(content: string): string {
  const flat = content.replace(/\s+/g, " ").trim();
  return flat.length > 220 ? `${flat.slice(0, 217)}...` : flat;
}

export async function listKnowledgeConflicts(siteId: string): Promise<ActionResult<KnowledgeConflict[]>> {
  const owned = await requireOwnedSite(siteId);
  if ("error" in owned) return owned;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_conflicts")
    .select(
      "id, similarity, chunk:knowledge_chunks!knowledge_conflicts_chunk_id_fkey(id, title, content, source_id, knowledge_sources(title)), other:knowledge_chunks!knowledge_conflicts_other_chunk_id_fkey(id, title, content, source_id, knowledge_sources(title))"
    )
    .eq("site_id", siteId)
    .order("similarity", { ascending: false })
    .limit(40);
  if (error) {
    logger.error("knowledge.conflicts.list.failed", error, { siteId, errorCode: error.code });
    return { error: "Could not load possible conflicts." };
  }

  const seen = new Set<string>();
  const conflicts: KnowledgeConflict[] = [];
  for (const row of (data ?? []) as unknown as {
    id: string;
    similarity: number;
    chunk: ConflictChunkRow | null;
    other: ConflictChunkRow | null;
  }[]) {
    if (!row.chunk || !row.other) continue;
    const key = [row.chunk.id, row.other.id].sort().join(":");
    if (seen.has(key)) continue;
    seen.add(key);
    const side = (chunk: ConflictChunkRow) => ({
      sourceId: chunk.source_id,
      sourceTitle: chunk.knowledge_sources?.title ?? "Unknown source",
      title: chunk.title,
      excerpt: excerpt(chunk.content),
    });
    conflicts.push({ id: row.id, similarity: row.similarity, chunk: side(row.chunk), otherChunk: side(row.other) });
    if (conflicts.length >= 20) break;
  }
  return { ok: true, data: conflicts };
}

export async function addUrlSource(input: {
  siteId: string;
  url: string;
  crawl: boolean;
  syncIntervalHours: number | null;
}): Promise<ActionResult> {
  const parsed = addUrlSourceSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const owned = await requireOwnedSite(parsed.data.siteId);
  if ("error" in owned) return owned;

  try {
    if ((await sourceCount(parsed.data.siteId)) >= MAX_SOURCES_PER_SITE) {
      return { error: `You can add up to ${MAX_SOURCES_PER_SITE} sources per site.` };
    }
    const url = new URL(parsed.data.url);
    url.hash = "";
    const title = `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`.slice(0, 300);

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("knowledge_sources")
      .insert({
        site_id: parsed.data.siteId,
        type: "url",
        title,
        url: url.toString(),
        crawl: parsed.data.crawl,
        sync_interval_hours: parsed.data.syncIntervalHours,
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Insert returned no row");
    await enqueue(data.id as string);
    logger.info("knowledge.source.url.added", { siteId: parsed.data.siteId, sourceId: data.id, crawl: parsed.data.crawl });
    return { ok: true, data: null };
  } catch (error) {
    logger.error("knowledge.source.url.add_failed", error, { siteId: parsed.data.siteId });
    return { error: "Could not add that link. Please try again." };
  }
}

export async function addTextSource(input: { siteId: string; title: string; content: string }): Promise<ActionResult> {
  const parsed = addTextSourceSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const owned = await requireOwnedSite(parsed.data.siteId);
  if ("error" in owned) return owned;

  try {
    if ((await sourceCount(parsed.data.siteId)) >= MAX_SOURCES_PER_SITE) {
      return { error: `You can add up to ${MAX_SOURCES_PER_SITE} sources per site.` };
    }
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("knowledge_sources")
      .insert({
        site_id: parsed.data.siteId,
        type: "text",
        title: parsed.data.title,
        text_content: parsed.data.content,
      })
      .select("id")
      .single();
    if (error || !data) throw error ?? new Error("Insert returned no row");
    await enqueue(data.id as string);
    logger.info("knowledge.source.text.added", { siteId: parsed.data.siteId, sourceId: data.id });
    return { ok: true, data: null };
  } catch (error) {
    logger.error("knowledge.source.text.add_failed", error, { siteId: parsed.data.siteId });
    return { error: "Could not save that text. Please try again." };
  }
}

/** Loaded on demand by the edit dialog (kept out of the polled list). */
export async function getTextSourceContent(sourceId: string): Promise<ActionResult<{ title: string; content: string }>> {
  const parsed = sourceIdSchema.safeParse({ sourceId });
  if (!parsed.success) return firstIssue(parsed.error);
  const owned = await requireOwnedSource(sourceId);
  if ("error" in owned) return owned;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("knowledge_sources")
    .select("title, text_content")
    .eq("id", sourceId)
    .eq("type", "text")
    .maybeSingle();
  if (error || !data) return { error: "Could not load this text source." };
  return { ok: true, data: { title: data.title as string, content: (data.text_content as string | null) ?? "" } };
}

export async function updateTextSource(input: { sourceId: string; title: string; content: string }): Promise<ActionResult> {
  const parsed = updateTextSourceSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const owned = await requireOwnedSource(parsed.data.sourceId);
  if ("error" in owned) return owned;
  if (owned.source.type !== "text") return { error: "Only text sources can be edited." };

  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("knowledge_sources")
      .update({ title: parsed.data.title, text_content: parsed.data.content, updated_at: new Date().toISOString() })
      .eq("id", parsed.data.sourceId);
    if (error) throw error;
    await enqueue(parsed.data.sourceId);
    logger.info("knowledge.source.text.updated", { sourceId: parsed.data.sourceId });
    return { ok: true, data: null };
  } catch (error) {
    logger.error("knowledge.source.text.update_failed", error, { sourceId: parsed.data.sourceId });
    return { error: "Could not save your changes. Please try again." };
  }
}

/**
 * Step 1 of a file upload: mint a signed upload URL so the browser uploads
 * straight to Supabase Storage (no serverless body-size limit).
 */
export async function createFileUpload(input: {
  siteId: string;
  sourceId?: string;
  fileName: string;
  size: number;
}): Promise<ActionResult<{ sourceId: string; path: string; token: string; contentType: string }>> {
  const parsed = createFileUploadSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const owned = await requireOwnedSite(parsed.data.siteId);
  if ("error" in owned) return owned;

  try {
    let sourceId = parsed.data.sourceId;
    if (sourceId) {
      const source = await requireOwnedSource(sourceId);
      if ("error" in source) return source;
      if (source.source.type !== "file" || source.source.site_id !== parsed.data.siteId) {
        return { error: "Only file sources can be replaced." };
      }
    } else {
      if ((await sourceCount(parsed.data.siteId)) >= MAX_SOURCES_PER_SITE) {
        return { error: `You can add up to ${MAX_SOURCES_PER_SITE} sources per site.` };
      }
      sourceId = randomUUID();
    }

    const extension = fileExtension(parsed.data.fileName)!;
    const path = `${parsed.data.siteId}/${sourceId}/${randomUUID()}.${extension}`;
    const admin = createAdminClient();
    const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !data) throw error ?? new Error("No signed URL returned");

    return {
      ok: true,
      data: { sourceId, path: data.path, token: data.token, contentType: KNOWLEDGE_FILE_TYPES[extension] },
    };
  } catch (error) {
    logger.error("knowledge.source.file.upload_url_failed", error, { siteId: parsed.data.siteId });
    return { error: "Could not start the upload. Please try again." };
  }
}

/** Step 2 of a file upload: record the source (or the replacement file) and queue a sync. */
export async function confirmFileUpload(input: {
  siteId: string;
  sourceId: string;
  path: string;
  fileName: string;
  replace: boolean;
}): Promise<ActionResult> {
  const parsed = confirmFileUploadSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const owned = await requireOwnedSite(parsed.data.siteId);
  if ("error" in owned) return owned;

  const { siteId, sourceId, path, fileName, replace } = parsed.data;
  const extension = fileExtension(fileName);
  const folder = `${siteId}/${sourceId}`;
  if (!extension || !path.startsWith(`${folder}/`) || path.includes("..")) {
    return { error: "That upload doesn't belong to this site." };
  }

  try {
    const admin = createAdminClient();
    const objectName = path.slice(folder.length + 1);
    const { data: objects, error: listError } = await admin.storage.from(BUCKET).list(folder, { search: objectName });
    if (listError) throw listError;
    if (!objects?.some((object) => object.name === objectName)) {
      return { error: "The upload didn't finish. Please try again." };
    }

    if (replace) {
      const source = await requireOwnedSource(sourceId);
      if ("error" in source) return source;
      if (source.source.type !== "file" || source.source.site_id !== siteId) {
        return { error: "Only file sources can be replaced." };
      }
      // An older replaced file that hasn't been cleaned up yet is no longer needed.
      if (source.source.replaced_storage_path) {
        await admin.storage.from(BUCKET).remove([source.source.replaced_storage_path]);
      }
      const { error } = await admin
        .from("knowledge_sources")
        .update({
          storage_path: path,
          replaced_storage_path: source.source.storage_path,
          file_name: fileName,
          mime_type: KNOWLEDGE_FILE_TYPES[extension],
          updated_at: new Date().toISOString(),
        })
        .eq("id", sourceId);
      if (error) throw error;
    } else {
      const { error } = await admin.from("knowledge_sources").insert({
        id: sourceId,
        site_id: siteId,
        type: "file",
        title: fileName.slice(0, 300),
        storage_path: path,
        file_name: fileName,
        mime_type: KNOWLEDGE_FILE_TYPES[extension],
      });
      if (error) throw error;
    }

    await enqueue(sourceId);
    logger.info("knowledge.source.file.confirmed", { siteId, sourceId, replace });
    return { ok: true, data: null };
  } catch (error) {
    logger.error("knowledge.source.file.confirm_failed", error, { siteId, sourceId });
    return { error: "Could not save the file. Please try again." };
  }
}

export async function resyncSource(sourceId: string): Promise<ActionResult> {
  const parsed = sourceIdSchema.safeParse({ sourceId });
  if (!parsed.success) return firstIssue(parsed.error);
  const owned = await requireOwnedSource(sourceId);
  if ("error" in owned) return owned;

  try {
    await enqueue(sourceId);
    logger.info("knowledge.source.resync_queued", { sourceId });
    return { ok: true, data: null };
  } catch (error) {
    logger.error("knowledge.source.resync_failed", error, { sourceId });
    return { error: "Could not queue a sync. Please try again." };
  }
}

export async function deleteSource(sourceId: string): Promise<ActionResult> {
  const parsed = sourceIdSchema.safeParse({ sourceId });
  if (!parsed.success) return firstIssue(parsed.error);
  const owned = await requireOwnedSource(sourceId);
  if ("error" in owned) return owned;

  try {
    const admin = createAdminClient();
    const paths = [owned.source.storage_path, owned.source.replaced_storage_path].filter(Boolean) as string[];
    if (paths.length > 0) {
      const { error: storageError } = await admin.storage.from(BUCKET).remove(paths);
      if (storageError) logger.warn("knowledge.source.delete.storage_cleanup_failed", { sourceId });
    }
    const { error } = await admin.from("knowledge_sources").delete().eq("id", sourceId);
    if (error) throw error;
    logger.info("knowledge.source.deleted", { sourceId });
    return { ok: true, data: null };
  } catch (error) {
    logger.error("knowledge.source.delete_failed", error, { sourceId });
    return { error: "Could not delete the source. Please try again." };
  }
}

export async function updateSyncInterval(input: {
  sourceId: string;
  syncIntervalHours: number | null;
}): Promise<ActionResult> {
  const parsed = updateSyncIntervalSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const owned = await requireOwnedSource(parsed.data.sourceId);
  if ("error" in owned) return owned;
  if (owned.source.type !== "url") return { error: "Only web links have a sync schedule." };

  const hours = parsed.data.syncIntervalHours;
  const base = owned.source.last_synced_at ? new Date(owned.source.last_synced_at).getTime() : Date.now();
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("knowledge_sources")
      .update({
        sync_interval_hours: hours,
        next_sync_at: hours ? new Date(Math.max(base + hours * 3_600_000, Date.now())).toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.sourceId);
    if (error) throw error;
    return { ok: true, data: null };
  } catch (error) {
    logger.error("knowledge.source.interval_update_failed", error, { sourceId: parsed.data.sourceId });
    return { error: "Could not update the schedule. Please try again." };
  }
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

/** Creates (or rotates) a source's sync webhook. The URL is only shown once. */
export async function rotateWebhookToken(sourceId: string): Promise<ActionResult<{ url: string }>> {
  const parsed = sourceIdSchema.safeParse({ sourceId });
  if (!parsed.success) return firstIssue(parsed.error);
  const owned = await requireOwnedSource(sourceId);
  if ("error" in owned) return owned;
  if (owned.source.type !== "url") return { error: "Only web links have a sync webhook." };

  try {
    const token = createSessionToken();
    const admin = createAdminClient();
    const { error } = await admin
      .from("knowledge_sources")
      .update({ webhook_token_hash: hashSessionToken(token), updated_at: new Date().toISOString() })
      .eq("id", sourceId);
    if (error) throw error;
    logger.info("knowledge.source.webhook_rotated", { sourceId });
    return { ok: true, data: { url: `${siteUrl()}/api/knowledge/hooks/${sourceId}?token=${token}` } };
  } catch (error) {
    logger.error("knowledge.source.webhook_rotate_failed", error, { sourceId });
    return { error: "Could not create the webhook. Please try again." };
  }
}

export async function removeWebhook(sourceId: string): Promise<ActionResult> {
  const parsed = sourceIdSchema.safeParse({ sourceId });
  if (!parsed.success) return firstIssue(parsed.error);
  const owned = await requireOwnedSource(sourceId);
  if ("error" in owned) return owned;

  const admin = createAdminClient();
  const { error } = await admin.from("knowledge_sources").update({ webhook_token_hash: null }).eq("id", sourceId);
  if (error) {
    logger.error("knowledge.source.webhook_remove_failed", error, { sourceId });
    return { error: "Could not remove the webhook. Please try again." };
  }
  return { ok: true, data: null };
}

export async function updateAgentSettings(input: {
  siteId: string;
  enabled: boolean;
  instructions: string;
}): Promise<ActionResult> {
  const parsed = updateAgentSettingsSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const owned = await requireOwnedSite(parsed.data.siteId);
  if ("error" in owned) return owned;

  const supabase = await createClient();
  const { error } = await supabase
    .from("sites")
    .update({
      ai_agent_enabled: parsed.data.enabled,
      ai_agent_instructions: parsed.data.instructions.trim(),
    })
    .eq("id", parsed.data.siteId);
  if (error) {
    logger.error("knowledge.agent_settings.update_failed", error, { siteId: parsed.data.siteId, errorCode: error.code });
    return { error: "Could not save the AI agent settings. Please try again." };
  }
  logger.info("knowledge.agent_settings.updated", { siteId: parsed.data.siteId, enabled: parsed.data.enabled });
  return { ok: true, data: null };
}
