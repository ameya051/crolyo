import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

const SLACK_SCOPES =
  process.env.SLACK_BOT_SCOPES?.split(",") ?? [
    "chat:write",
    "channels:read",
    "groups:read",
    "channels:history",
    "groups:history",
  ];

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const siteId = searchParams.get("site_id");
  const origin = getSiteUrl();

  if (!siteId) {
    return NextResponse.redirect(`${origin}/overview?error=slack_missing_site`);
  }

  if (!process.env.SLACK_CLIENT_ID) {
    return NextResponse.redirect(`${origin}/sites/${siteId}?tab=slack&slack=error`);
  }

  const supabase = await createClient();
  const { data: site } = await supabase
    .from("sites")
    .select("id")
    .eq("id", siteId)
    .single();

  if (!site) {
    return NextResponse.redirect(`${origin}/overview?error=slack_unauthorized`);
  }

  const state = randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  const isSecure = process.env.NODE_ENV === "production";

  const cookieOptions = {
    httpOnly: true,
    secure: isSecure,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 10,
  };

  cookieStore.set("slack_oauth_state", state, cookieOptions);
  cookieStore.set("slack_oauth_site_id", siteId, cookieOptions);

  const redirectUri = `${origin}/api/slack/oauth_redirect`;
  const authUrl = new URL("https://slack.com/oauth/v2/authorize");
  authUrl.searchParams.set("client_id", process.env.SLACK_CLIENT_ID);
  authUrl.searchParams.set("scope", SLACK_SCOPES.join(","));
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);

  return NextResponse.redirect(authUrl.toString());
}
