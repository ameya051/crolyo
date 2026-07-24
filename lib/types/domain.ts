export type SlackConnectionStatus = "connected" | "disconnected"

export type WidgetInstallStatus = "installed" | "not-installed"

export type ConversationStatus = "open" | "closed"

export interface Site {
  id: string
  name: string
  domain: string
  primaryColor: string
  welcomeMessage: string
  allowedDomains: string[]
  slackStatus: SlackConnectionStatus
  slackWorkspaceName: string | null
  slackChannelName: string | null
  widgetStatus: WidgetInstallStatus
  createdAt: string
}

export interface Conversation {
  id: string
  siteId: string
  visitorLabel: string
  status: ConversationStatus
  lastMessagePreview: string
  lastMessageAt: string
  messageCount: number
  slackThreadUrl: string | null
}

export interface OverviewStats {
  openConversations: number
  totalVisitorsThisMonth: number
  avgResponseTime: string
}

export interface ActivityItem {
  id: string
  siteId: string
  kind: "message" | "resolved" | "connected" | "installed"
  text: string
  at: string
}
