import type { ConversationMode, EscalationReason, MessageSenderType } from "./enums"

export type WidgetSite = {
  id: string
  name: string
  primary_color: string
  welcome_message: string
  allowed_domains: string[]
  slack_bot_token: string | null
  slack_channel_id: string | null
  ai_agent_enabled: boolean
  ai_agent_instructions: string
}

export type WidgetConversation = {
  id: string
  site_id: string
  slack_thread_ts: string | null
  mode: ConversationMode
  escalation_reason: EscalationReason | null
  escalation_summary: string | null
}

export type WidgetMessage = {
  id: string
  senderType: MessageSenderType
  content: string
  createdAt: string
}
