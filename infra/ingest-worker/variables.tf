variable "region" {
  description = "AWS region. Pick the one closest to your Supabase project."
  type        = string
  default     = "us-east-1"
}

variable "name" {
  description = "Name prefix for all resources."
  type        = string
  default     = "crolyo-ingest-worker"
}

variable "vpc_cidr" {
  type    = string
  default = "10.40.0.0/16"
}

variable "cpu" {
  description = "Fargate task CPU units (512 = 0.5 vCPU)."
  type        = number
  default     = 512
}

variable "memory" {
  description = "Fargate task memory in MiB."
  type        = number
  default     = 1024
}

variable "desired_count" {
  description = "Number of worker tasks. Safe to scale out: jobs are claimed with SKIP LOCKED."
  type        = number
  default     = 1
}

variable "image_tag" {
  description = "Image tag for the initial task definition. CI deploys new tags afterwards."
  type        = string
  default     = "latest"
}

variable "worker_concurrency" {
  type    = number
  default = 3
}

variable "supabase_url" {
  description = "https://<project-ref>.supabase.co"
  type        = string
}

variable "embedding_model" {
  description = "Must match EMBEDDING_MODEL in the Next.js app."
  type        = string
  default     = "voyageai/voyage-4-large"
}

variable "embedding_dimensions" {
  type    = number
  default = 1024
}

variable "log_retention_days" {
  type    = number
  default = 30
}

variable "alarm_email" {
  description = "Optional email address for alarm notifications (confirm the SNS subscription email)."
  type        = string
  default     = ""
}

variable "github_repository" {
  description = "owner/repo allowed to deploy through GitHub Actions OIDC."
  type        = string
  default     = "ameya051/crolyo"
}

variable "github_branch" {
  description = "Branch allowed to deploy."
  type        = string
  default     = "main"
}

variable "create_github_oidc_provider" {
  description = "Set to false if the account already has the token.actions.githubusercontent.com OIDC provider."
  type        = bool
  default     = true
}
