function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

/** The URL users browse the app on. Cookies (Supabase session, OAuth state) live on this host. */
export function getSiteUrl(): string {
  return trimTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
}

/**
 * Public HTTPS base URL that Slack redirects back to. Slack rejects plain-http localhost,
 * so in dev this points at an ngrok tunnel while the site URL stays on localhost.
 * Unset in production, where both are the same domain.
 */
export function getSlackOAuthBaseUrl(): string {
  return trimTrailingSlash(process.env.SLACK_OAUTH_BASE_URL || getSiteUrl());
}

export const SLACK_OAUTH_REDIRECT_PATH = "/api/slack/oauth_redirect";

/** Must be identical in the authorize request and the token exchange. */
export function getSlackRedirectUri(): string {
  return `${getSlackOAuthBaseUrl()}${SLACK_OAUTH_REDIRECT_PATH}`;
}
