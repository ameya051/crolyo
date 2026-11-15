import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logger } from "@/lib/logger";
import { getSiteUrl } from "@/lib/site-url";

export async function requireUser(): Promise<
  | { user: import("@supabase/supabase-js").User }
  | { user: null; redirect: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    logger.warn("auth.route_guard.unauthenticated");
    const origin = getSiteUrl();
    return { user: null, redirect: NextResponse.redirect(`${origin}/signin?error=auth`) };
  }

  return { user };
}
