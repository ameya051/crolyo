import { getRequestOrigin, requireWidgetSite, widgetError, widgetJson, widgetPreflight } from "@/lib/widget";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

function realtimeUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not configured");
  return `${url.replace(/^http/, "ws")}/realtime/v1`;
}

export async function GET(request: Request) {
  const origin = getRequestOrigin(request);
  try {
    const siteId = new URL(request.url).searchParams.get("site_id") ?? "";
    const { site, origin: allowedOrigin } = await requireWidgetSite(request, siteId);
    const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!publishableKey) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not configured");

    return widgetJson(
      {
        siteId: site.id,
        name: site.name,
        primaryColor: site.primary_color,
        welcomeMessage: site.welcome_message,
        realtime: { url: realtimeUrl(), publishableKey },
      },
      200,
      allowedOrigin
    );
  } catch (error) {
    logger.warn("widget.config.failed", { reason: error instanceof Error ? error.message : "unknown" });
    return widgetError(error, origin);
  }
}

export function OPTIONS(request: Request) {
  return widgetPreflight(request);
}
