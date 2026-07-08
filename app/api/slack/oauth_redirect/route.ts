import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { exchangeSlackCode } from "@/lib/slack/api";
import { encrypt } from "@/lib/encryption";
import { requireUser } from "@/lib/auth/route-guard";

function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("slack_oauth_state")?.value;
  const siteId = cookieStore.get("slack_oauth_site_id")?.value;

  const origin = getSiteUrl();

  const clearOptions = { path: "/", maxAge: 0 };
  cookieStore.set("slack_oauth_state", "", clearOptions);
  cookieStore.set("slack_oauth_site_id", "", clearOptions);

  if (error || !code || !state || !savedState || state !== savedState || !siteId) {
    return NextResponse.redirect(`${origin}/overview?error=slack_oauth`);
  }

  const auth = await requireUser();
  if (!auth.user) {
    return auth.redirect;
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

  const redirectUri = `${origin}/api/slack/oauth_redirect`;
  const oauth = await exchangeSlackCode(code, redirectUri);

  if (!oauth.ok || !oauth.access_token || !oauth.team) {
    console.error(oauth.error);
    return NextResponse.redirect(`${origin}/sites/${siteId}?tab=slack&slack=error`);
  }

  const encryptedToken = encrypt(oauth.access_token);

  const { error: dbError } = await supabase
    .from("sites")
    .update({
      slack_workspace_id: oauth.team.id,
      slack_workspace_name: oauth.team.name,
      slack_bot_token: encryptedToken,
    })
    .eq("id", siteId);

  if (dbError) {
    console.error(dbError);
    return NextResponse.redirect(`${origin}/sites/${siteId}?tab=slack&slack=error`);
  }

  return NextResponse.redirect(`${origin}/sites/${siteId}?tab=slack&slack=installed`);
}
