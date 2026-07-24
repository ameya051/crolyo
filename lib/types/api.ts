import type { Site } from "./domain"
import type {
  CreateSiteValues,
  DeleteSiteValues,
  UpdateSiteValues,
} from "@/lib/validations/site"

export type SitePublicRow = {
  id: string
  user_id: string
  name: string
  slack_workspace_id: string | null
  slack_channel_id: string | null
  slack_workspace_name: string | null
  slack_channel_name: string | null
  primary_color: string
  welcome_message: string
  allowed_domains: string[]
  created_at: string
  updated_at: string
}

export type CreateSiteRequest = CreateSiteValues
export type UpdateSiteRequest = UpdateSiteValues
export type DeleteSiteRequest = DeleteSiteValues

export type SitesResponse =
  | { sites: Site[]; error?: never }
  | { sites: []; error: string }

export type SiteResponse =
  | { site: Site | null; error?: never }
  | { site: null; error: string }

export type SiteMutationResponse =
  | { site: Site; error?: never }
  | { site?: never; error: string }

export type DeleteSiteResponse =
  | { ok: true; error?: never }
  | { ok?: never; error: string }
