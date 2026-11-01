"use client";

import { confirmFileUpload, createFileUpload } from "@/app/actions/knowledge";
import { createClient } from "@/lib/supabase/client";

const BUCKET = "knowledge-files";

/**
 * Uploads a knowledge file straight to Supabase Storage with a signed URL
 * minted server-side, then records it. Pass `sourceId` to replace a file.
 */
export async function uploadKnowledgeFile(input: {
  siteId: string;
  file: File;
  sourceId?: string;
}): Promise<{ error?: string }> {
  const prepared = await createFileUpload({
    siteId: input.siteId,
    sourceId: input.sourceId,
    fileName: input.file.name,
    size: input.file.size,
  });
  if (!prepared.ok) return { error: prepared.error };

  const supabase = createClient();
  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .uploadToSignedUrl(prepared.data.path, prepared.data.token, input.file, {
      contentType: prepared.data.contentType,
    });
  if (uploadError) return { error: "The upload failed. Please try again." };

  const confirmed = await confirmFileUpload({
    siteId: input.siteId,
    sourceId: prepared.data.sourceId,
    path: prepared.data.path,
    fileName: input.file.name,
    replace: Boolean(input.sourceId),
  });
  return confirmed.error ? { error: confirmed.error } : {};
}
