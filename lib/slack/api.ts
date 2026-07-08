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
  const response = await fetch(`${SLACK_API_BASE}/oauth.v2.access`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: redirectUri,
    }),
  });

  return response.json();
}

export interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
}

export async function listSlackChannels(botToken: string): Promise<SlackChannel[]> {
  const url = new URL(`${SLACK_API_BASE}/conversations.list`);
  url.searchParams.set("types", "public_channel,private_channel");
  url.searchParams.set("exclude_archived", "true");
  url.searchParams.set("limit", "200");

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${botToken}`,
    },
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.error || "Failed to list Slack channels");
  }

  return (data.channels as SlackChannel[])
    .filter((channel) => channel.id && channel.name)
    .map((channel) => ({
      id: channel.id,
      name: channel.name,
      is_private: channel.is_private,
    }));
}
