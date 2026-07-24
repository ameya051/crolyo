export type WidgetSite = {
  id: string
  name: string
  primary_color: string
  welcome_message: string
  allowed_domains: string[]
  slack_bot_token: string | null
  slack_channel_id: string | null
}

export type WidgetConversation = {
  id: string
  site_id: string
  slack_thread_ts: string | null
}

export type WidgetMessage = {
  id: string
  senderType: "visitor" | "agent"
  content: string
  createdAt: string
}
