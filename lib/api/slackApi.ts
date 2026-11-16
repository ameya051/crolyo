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

export interface SlackPostMessageResult {
  ok: boolean;
  ts?: string;
  channel?: string;
  error?: string;
}

export async function postSlackMessage(
  botToken: string,
  input: { channel: string; text: string; threadTs?: string }
): Promise<SlackPostMessageResult> {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${SLACK_API_BASE}/chat.postMessage`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        channel: input.channel,
        text: input.text,
        ...(input.threadTs ? { thread_ts: input.threadTs } : {}),
        mrkdwn: false,
        unfurl_links: false,
        unfurl_media: false,
      }),
    });
    const data = (await response.json()) as SlackPostMessageResult;
    logger.info("slack.message.post.completed", {
      status: response.status,
      ok: data.ok,
      errorCode: data.error,
      isThreadReply: Boolean(input.threadTs),
      durationMs: Date.now() - startedAt,
    });

    if (!data.ok || !data.ts) {
      throw new Error(data.error || "Slack did not accept the message");
    }

    return data;
  } catch (error) {
    logger.error("slack.message.post.failed", error, {
      isThreadReply: Boolean(input.threadTs),
      durationMs: Date.now() - startedAt,
    });
    throw error;
  }
}

/** Best-effort delete of a message the bot posted (used to clean up a lost thread race). */
export async function deleteSlackMessage(
  botToken: string,
  input: { channel: string; ts: string }
): Promise<{ ok: boolean; error?: string }> {
  const startedAt = Date.now();
  try {
    const response = await fetch(`${SLACK_API_BASE}/chat.delete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ channel: input.channel, ts: input.ts }),
    });
    const data = (await response.json()) as { ok: boolean; error?: string };
    logger.info("slack.message.delete.completed", {
      ok: data.ok,
      errorCode: data.error,
      durationMs: Date.now() - startedAt,
    });
    return data;
  } catch (error) {
    logger.error("slack.message.delete.failed", error, { durationMs: Date.now() - startedAt });
    return { ok: false, error: "request_failed" };
  }
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

export async function joinConversation(
  botToken: string,
  channelId: string
): Promise<{ ok: boolean; error?: string }> {
  const startedAt = Date.now();
  logger.info("slack.conversation.join.started", { channelId });
  try {
    const response = await fetch(`${SLACK_API_BASE}/conversations.join`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${botToken}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ channel: channelId }),
    });
    const data = (await response.json()) as { ok: boolean; error?: string };
    logger.info("slack.conversation.join.completed", {
      ok: data.ok,
      errorCode: data.error,
      durationMs: Date.now() - startedAt,
    });
    if (!data.ok) return { ok: false, error: data.error };
    return { ok: true };
  } catch (error) {
    logger.error("slack.conversation.join.failed", error, { channelId, durationMs: Date.now() - startedAt });
    throw error;
  }
}

export interface SlackConversationInfo {
  ok: boolean;
  isMember?: boolean;
  isPrivate?: boolean;
  error?: string;
}

export async function getConversationInfo(
  botToken: string,
  channelId: string
): Promise<SlackConversationInfo> {
  const url = new URL(`${SLACK_API_BASE}/conversations.info`);
  url.searchParams.set("channel", channelId);

  const startedAt = Date.now();
  try {
    const response = await fetch(url, { headers: { Authorization: `Bearer ${botToken}` } });
    const data = (await response.json()) as {
      ok: boolean;
      error?: string;
      channel?: { is_member?: boolean; is_private?: boolean };
    };
    logger.info("slack.conversation.info.completed", {
      channelId,
      ok: data.ok,
      errorCode: data.error,
      durationMs: Date.now() - startedAt,
    });
    if (!data.ok || !data.channel) return { ok: false, error: data.error ?? "unknown_error" };
    return { ok: true, isMember: Boolean(data.channel.is_member), isPrivate: Boolean(data.channel.is_private) };
  } catch (error) {
    logger.error("slack.conversation.info.failed", error, { channelId, durationMs: Date.now() - startedAt });
    throw error;
  }
}

export interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

/**
 * Channels the admin can route visitor chats to. Public channels come back whether or not the
 * bot is a member (it can join them); private channels only appear once the bot has been invited.
 */
export async function listConversations(botToken: string): Promise<{ ok: true; channels: SlackChannel[] } | { ok: false; error: string }> {
  const startedAt = Date.now();
  const channels: SlackChannel[] = [];
  let cursor: string | undefined;
  // Cap the pages so a huge workspace can't keep the request open indefinitely.
  const MAX_PAGES = 10;

  try {
    for (let page = 0; page < MAX_PAGES; page++) {
      const url = new URL(`${SLACK_API_BASE}/conversations.list`);
      url.searchParams.set("types", "public_channel,private_channel");
      url.searchParams.set("exclude_archived", "true");
      url.searchParams.set("limit", "200");
      if (cursor) url.searchParams.set("cursor", cursor);

      const response = await fetch(url, { headers: { Authorization: `Bearer ${botToken}` } });
      const data = (await response.json()) as {
        ok: boolean;
        error?: string;
        channels?: { id: string; name: string; is_private?: boolean }[];
        response_metadata?: { next_cursor?: string };
      };

      if (!data.ok) {
        logger.warn("slack.conversation.list.rejected", { errorCode: data.error, page });
        return { ok: false, error: data.error ?? "unknown_error" };
      }

      for (const channel of data.channels ?? []) {
        channels.push({ id: channel.id, name: channel.name, isPrivate: Boolean(channel.is_private) });
      }

      cursor = data.response_metadata?.next_cursor || undefined;
      if (!cursor) break;
    }

    logger.info("slack.conversation.list.completed", {
      channelCount: channels.length,
      truncated: Boolean(cursor),
      durationMs: Date.now() - startedAt,
    });
    channels.sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, channels };
  } catch (error) {
    logger.error("slack.conversation.list.failed", error, { durationMs: Date.now() - startedAt });
    throw error;
  }
}

/**
 * Makes sure the bot can receive thread-reply events from the channel: joins public channels,
 * and reports false for private ones it hasn't been invited to (bots can't join those).
 */
export async function ensureBotInChannel(botToken: string, channelId: string, siteId: string): Promise<boolean> {
  try {
    const info = await getConversationInfo(botToken, channelId);
    if (info.ok && info.isMember) {
      logger.info("slack.channel.bot_already_member", { siteId, channelId });
      return true;
    }
    if (info.ok && info.isPrivate) {
      logger.warn("slack.channel.private_channel_needs_invite", { siteId, channelId });
      return false;
    }

    // conversations.join returns ok:true (with an already_in_channel warning) if already a member.
    const join = await joinConversation(botToken, channelId);
    if (!join.ok) {
      logger.warn("slack.channel.join_rejected", { siteId, channelId, errorCode: join.error });
    }
    return join.ok;
  } catch (caughtError) {
    logger.error("slack.channel.membership_check_failed", caughtError, { siteId, channelId });
    return false;
  }
}
