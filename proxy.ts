import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { logger } from "@/lib/logger";

const publicRoutes = [
  "/signin",
  "/signup",
  "/api/auth/callback",
  "/api/slack/oauth_redirect",
];

const protectedPageRoutes = [
  "/overview",
  "/sites",
  "/settings",
];

const protectedApiRoutes = [
  "/api/slack/install",
];

function matchPrefix(pathname: string, patterns: string[]): boolean {
  return patterns.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  logger.info("proxy.request.started", { pathname, method: request.method });
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) logger.error("proxy.auth_lookup.failed", error, { pathname, errorCode: error.code });

  // Must run before the public-route early return — /signin and /signup are public,
  // so an authenticated user would otherwise never get redirected to the app.
  if (user && (pathname === "/signin" || pathname === "/signup")) {
    logger.info("proxy.redirect.authenticated_user", { pathname });
    const url = request.nextUrl.clone();
    url.pathname = "/overview";
    return NextResponse.redirect(url);
  }

  if (matchPrefix(pathname, publicRoutes)) {
    logger.info("proxy.request.public_route", { pathname });
    return supabaseResponse;
  }

  if (!user) {
    if (matchPrefix(pathname, protectedApiRoutes)) {
      logger.warn("proxy.redirect.unauthenticated_api", { pathname });
      const url = request.nextUrl.clone();
      url.pathname = "/signin";
      url.searchParams.set("error", "auth");
      return NextResponse.redirect(url);
    }

    if (matchPrefix(pathname, protectedPageRoutes)) {
      logger.warn("proxy.redirect.unauthenticated_page", { pathname });
      const url = request.nextUrl.clone();
      url.pathname = "/signin";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
