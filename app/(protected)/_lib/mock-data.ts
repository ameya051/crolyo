import type {
  ActivityItem,
  Conversation,
  OverviewStats,
  Site,
} from "./types"

export const mockSites: Site[] = [
  /* {
    id: "site_acme",
    name: "Acme Store",
    domain: "acmestore.com",
    primaryColor: "#f97316",
    welcomeMessage: "Hey! Got a question about an order? We're here.",
    allowedDomains: ["acmestore.com", "www.acmestore.com"],
    slackStatus: "connected",
    slackWorkspaceName: "Acme HQ",
    slackChannelName: "#customer-chat",
    widgetStatus: "installed",
    createdAt: "2026-05-12T10:00:00.000Z",
  },
  {
    id: "site_indie",
    name: "Indie Blog",
    domain: "indieblog.dev",
    primaryColor: "#2eb67d",
    welcomeMessage: "Hi! Ask me anything about the posts.",
    allowedDomains: ["indieblog.dev"],
    slackStatus: "connected",
    slackWorkspaceName: "Indie Blog",
    slackChannelName: "#chat",
    widgetStatus: "not-installed",
    createdAt: "2026-06-18T09:30:00.000Z",
  }, */
]

export const mockStats: Record<string, OverviewStats> = {
  site_acme: {
    openConversations: 3,
    totalVisitorsThisMonth: 1284,
    avgResponseTime: "2m 14s",
  },
  site_indie: {
    openConversations: 0,
    totalVisitorsThisMonth: 96,
    avgResponseTime: "—",
  },
}

export const mockConversations: Record<string, Conversation[]> = {
  site_acme: [
    {
      id: "conv_1",
      siteId: "site_acme",
      visitorLabel: "Visitor from Berlin",
      status: "open",
      lastMessagePreview: "Is the walnut chair in stock?",
      lastMessageAt: "2026-06-23T14:32:00.000Z",
      messageCount: 4,
      slackThreadUrl: null,
    },
    {
      id: "conv_2",
      siteId: "site_acme",
      visitorLabel: "Visitor from Austin",
      status: "open",
      lastMessagePreview: "Can I combine the welcome discount with shipping?",
      lastMessageAt: "2026-06-23T13:58:00.000Z",
      messageCount: 2,
      slackThreadUrl: null,
    },
    {
      id: "conv_3",
      siteId: "site_acme",
      visitorLabel: "Visitor from Tokyo",
      status: "open",
      lastMessagePreview: "Thank you, that worked.",
      lastMessageAt: "2026-06-23T12:14:00.000Z",
      messageCount: 7,
      slackThreadUrl: null,
    },
    {
      id: "conv_4",
      siteId: "site_acme",
      visitorLabel: "Visitor from London",
      status: "closed",
      lastMessagePreview: "Order #4821 has been refunded.",
      lastMessageAt: "2026-06-22T18:41:00.000Z",
      messageCount: 9,
      slackThreadUrl: null,
    },
  ],
  site_indie: [],
}

export const mockActivity: ActivityItem[] = [
  {
    id: "act_1",
    siteId: "site_acme",
    kind: "message",
    text: "New message from a visitor in Berlin",
    at: "2026-06-23T14:32:00.000Z",
  },
  {
    id: "act_2",
    siteId: "site_acme",
    kind: "resolved",
    text: "Conversation with a London visitor was resolved",
    at: "2026-06-22T18:41:00.000Z",
  },
  {
    id: "act_3",
    siteId: "site_indie",
    kind: "connected",
    text: "Slack workspace connected",
    at: "2026-06-18T09:35:00.000Z",
  },
]

export function getSiteById(id: string): Site | undefined {
  return mockSites.find((s) => s.id === id)
}
