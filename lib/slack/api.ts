import { logger } from "@/lib/logger";

const SLACK_API_BASE = "https://slack.com/api";

export interface SlackOAuthResult {
  ok: boolean;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  team?: { id: string; name: string };
  enterprise?: { id: string; name: string } | null;
  error?: string;
}

export async function exchangeSlackCode(
  code: string,
  redirectUri: string
): Promise<SlackOAuthResult> {
  const startedAt = Date.now();
  logger.info("slack.oauth.exchange.started");
  try {
    const response = await fetch(`${SLACK_API_BASE}/oauth.v2.access`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const data = (await response.json()) as SlackOAuthResult;
    logger.info("slack.oauth.exchange.completed", {
      status: response.status,
      ok: data.ok,
      errorCode: data.error,
      durationMs: Date.now() - startedAt,
    });
    return data;
  } catch (error) {
    logger.error("slack.oauth.exchange.failed", error, { durationMs: Date.now() - startedAt });
    throw error;
  }
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
}

export async function uninstallSlackApp(
  botToken: string
): Promise<{ ok: boolean; error?: string }> {
  const startedAt = Date.now();
  logger.info("slack.uninstall.started");
  try {
    const response = await fetch(`${SLACK_API_BASE}/apps.uninstall`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token: botToken,
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
      }),
    });
    const data = await response.json();
    logger.info("slack.uninstall.completed", {
      ok: data.ok,
      errorCode: data.error,
      durationMs: Date.now() - startedAt,
    });
    return { ok: data.ok, error: data.error };
  } catch (error) {
    logger.error("slack.uninstall.failed", error, { durationMs: Date.now() - startedAt });
    throw error;
  }
}

export async function listSlackChannels(botToken: string): Promise<SlackChannel[]> {
  const url = new URL(`${SLACK_API_BASE}/conversations.list`);
  url.searchParams.set("types", "public_channel,private_channel");
  url.searchParams.set("exclude_archived", "true");
  url.searchParams.set("limit", "200");

  const startedAt = Date.now();
  logger.info("slack.channels.request.started");
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${botToken}` } });
    const data = await response.json();
    if (!data.ok) {
      logger.warn("slack.channels.request.rejected", {
        status: response.status,
        errorCode: data.error,
        durationMs: Date.now() - startedAt,
      });
      throw new Error(data.error || "Failed to list Slack channels");
    }

    const channels = (data.channels as SlackChannel[])
      .filter((channel) => channel.id && channel.name)
      .map((channel) => ({ id: channel.id, name: channel.name, is_private: channel.is_private }));
    logger.info("slack.channels.request.succeeded", {
      status: response.status,
      channelCount: channels.length,
      durationMs: Date.now() - startedAt,
    });
    return channels;
  } catch (error) {
    logger.error("slack.channels.request.failed", error, { durationMs: Date.now() - startedAt });
    throw error;
  }
}
