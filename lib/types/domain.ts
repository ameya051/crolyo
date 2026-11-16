import type { ConversationStatus } from "./enums"

export type { ConversationStatus }

export type SlackConnectionStatus = "connected" | "disconnected"

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
  aiAgentEnabled: boolean
  aiAgentInstructions: string
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
