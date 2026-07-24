import { createHash, randomBytes } from "crypto";

import { createAdminClient } from "@/lib/supabase/admin";
import type {
  WidgetConversation,
  WidgetMessage,
  WidgetSite,
} from "@/lib/types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const WIDGET_SESSION_HEADER = "x-crolyo-session";

export class WidgetRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function isUuid(value: string | null): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

export function getRequestOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  try {
    const parsed = new URL(origin);
    return parsed.origin;
  } catch {
    return null;
  }
}

export function isAllowedOrigin(origin: string | null, allowedDomains: string[]): boolean {
  if (!origin) return false;

  try {
    const hostname = new URL(origin).hostname.toLowerCase();
    return allowedDomains.some((domain) => domain.trim().toLowerCase() === hostname);
  } catch {
    return false;
  }
}

export function widgetCorsHeaders(origin: string | null): HeadersInit {
  if (!origin) return { Vary: "Origin" };

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": `Content-Type, ${WIDGET_SESSION_HEADER}`,
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

/**
 * Preflight only enables the requesting origin. Each actual request still
 * validates that origin against the site's persisted allowlist.
 */
export function widgetPreflight(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: widgetCorsHeaders(getRequestOrigin(request)),
  });
}

export function widgetJson(body: unknown, status: number, origin: string | null): Response {
  return Response.json(body, {
    status,
    headers: {
      ...widgetCorsHeaders(origin),
      "Cache-Control": "no-store",
    },
  });
}

export function widgetError(error: unknown, origin: string | null): Response {
  if (error instanceof WidgetRequestError) {
    return widgetJson({ error: error.message }, error.status, origin);
  }

  return widgetJson({ error: "Unable to process the widget request." }, 500, origin);
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function toWidgetMessage(message: {
  id: string;
  sender_type: "visitor" | "agent";
  content: string;
  created_at: string;
}): WidgetMessage {
  return {
    id: message.id,
    senderType: message.sender_type,
    content: message.content,
    createdAt: message.created_at,
  };
}

export async function requireWidgetSite(request: Request, siteId: string): Promise<{
  site: WidgetSite;
  origin: string;
}> {
  if (!isUuid(siteId)) {
    throw new WidgetRequestError(400, "Invalid site id.");
  }

  const origin = getRequestOrigin(request);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("sites")
    .select("id, name, primary_color, welcome_message, allowed_domains, slack_bot_token, slack_channel_id")
    .eq("id", siteId)
    .maybeSingle();

  if (error || !data) {
    throw new WidgetRequestError(404, "Site not found.");
  }

  const site = data as WidgetSite;
  if (!isAllowedOrigin(origin, site.allowed_domains ?? [])) {
    throw new WidgetRequestError(403, "This domain is not allowed for the widget.");
  }

  return { site, origin: origin! };
}

export async function requireWidgetSession(request: Request): Promise<{
  conversation: WidgetConversation;
  site: WidgetSite;
  origin: string;
}> {
  const token = request.headers.get(WIDGET_SESSION_HEADER);
  if (!token || token.length < 32) {
    throw new WidgetRequestError(401, "A valid widget session is required.");
  }

  const admin = createAdminClient();
  const { data: conversation, error: conversationError } = await admin
    .from("conversations")
    .select("id, site_id, slack_thread_ts")
    .eq("session_token_hash", hashSessionToken(token))
    .maybeSingle();

  if (conversationError || !conversation) {
    throw new WidgetRequestError(401, "Widget session not found.");
  }

  const { site, origin } = await requireWidgetSite(request, conversation.site_id as string);
  return {
    conversation: conversation as WidgetConversation,
    site,
    origin,
  };
}
