import { z } from "zod";

export const MAX_SOURCES_PER_SITE = 50;
export const MAX_TEXT_SOURCE_CHARS = 50_000;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const SYNC_INTERVAL_OPTIONS = [6, 24, 168] as const;

/** Accepted upload types, keyed by extension. Mirrors the bucket's allowed MIME types. */
export const KNOWLEDGE_FILE_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain",
  md: "text/markdown",
  markdown: "text/markdown",
} as const;

export type KnowledgeFileExtension = keyof typeof KNOWLEDGE_FILE_TYPES;

export function fileExtension(fileName: string): KnowledgeFileExtension | null {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  return extension in KNOWLEDGE_FILE_TYPES ? (extension as KnowledgeFileExtension) : null;
}

const uuid = z.string().uuid("Invalid id");

const syncInterval = z
  .union([z.literal(6), z.literal(24), z.literal(168), z.null()])
  .default(24);

const httpUrl = z
  .string()
  .trim()
  .min(1, "Enter a URL")
  .max(2000, "That URL is too long")
  .transform((value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`))
  .refine((value) => {
    try {
      const url = new URL(value);
      return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
    } catch {
      return false;
    }
  }, "Enter a valid web address like https://example.com/help");

export const addUrlSourceSchema = z.object({
  siteId: uuid,
  url: httpUrl,
  crawl: z.boolean().default(false),
  syncIntervalHours: syncInterval,
});

export const textSourceFields = {
  title: z.string().trim().min(1, "Add a title").max(300, "That title is too long"),
  content: z
    .string()
    .trim()
    .min(1, "Add some text")
    .max(MAX_TEXT_SOURCE_CHARS, `Text sources can be up to ${MAX_TEXT_SOURCE_CHARS.toLocaleString()} characters`),
};

export const addTextSourceSchema = z.object({ siteId: uuid, ...textSourceFields });
export const updateTextSourceSchema = z.object({ sourceId: uuid, ...textSourceFields });

export const createFileUploadSchema = z.object({
  siteId: uuid,
  /** Set when replacing the file of an existing source. */
  sourceId: uuid.optional(),
  fileName: z.string().trim().min(1).max(255),
  size: z
    .number()
    .int()
    .positive("That file is empty")
    .max(MAX_FILE_BYTES, "Files can be up to 20 MB"),
}).refine((value) => fileExtension(value.fileName) !== null, {
  message: "Upload a PDF, Word (.docx), text (.txt) or Markdown (.md) file",
  path: ["fileName"],
});

export const confirmFileUploadSchema = z.object({
  siteId: uuid,
  sourceId: uuid,
  path: z.string().min(1).max(500),
  fileName: z.string().trim().min(1).max(255),
  replace: z.boolean().default(false),
});

export const sourceIdSchema = z.object({ sourceId: uuid });

export const updateSyncIntervalSchema = z.object({
  sourceId: uuid,
  syncIntervalHours: syncInterval,
});

export const updateAgentSettingsSchema = z.object({
  siteId: uuid,
  enabled: z.boolean(),
  instructions: z.string().max(2000, "Instructions can be up to 2,000 characters").default(""),
});
