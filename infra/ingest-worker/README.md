# Ingest worker on AWS

Terraform for the knowledge-base ingest worker (`services/ingest-worker`):

- **ECS Fargate service** (ARM64/Graviton, 0.5 vCPU / 1 GB, 1 task) with the
  deployment circuit breaker and a container health check.
- **Network:** a dedicated VPC with public subnets and **no NAT gateway**. Tasks
  get a public IP for outbound traffic only. The security group has no ingress
  rules, and egress is limited to TCP 80/443/8080/8443 (web) and 5432
  (Supabase Postgres).
- **ECR** (immutable tags, scan on push, keeps the last 20 images).
- **Secrets Manager** entries for `DATABASE_URL`, `SUPABASE_SECRET_KEY` and
  `OPENROUTER_API_KEY`, injected into the task. Values are set out of band and
  never stored in Terraform state.
- **CloudWatch** logs (30 days), plus alarms for "no running task" and "≥5
  permanent sync failures in 15 min", sent to SNS (optional email).
- **GitHub OIDC deploy role**, so CI pushes images and updates the service
  without long-lived AWS keys.

Rough cost: about $20/month (Fargate ARM about $15, public IPv4 about $4, and
pennies for logs and ECR).

## First-time setup

1. Configure a remote state backend in `versions.tf`.
2. Apply:
   ```bash
   terraform init
   terraform apply -var supabase_url=https://<project-ref>.supabase.co -var alarm_email=you@example.com
   ```
   If your account already has the GitHub OIDC provider, add
   `-var create_github_oidc_provider=false`.
3. Set the secret values (use the Supabase **session pooler, port 5432**,
   because the transaction pooler doesn't support `LISTEN`):
   ```bash
   aws secretsmanager put-secret-value --secret-id crolyo-ingest-worker/DATABASE_URL --secret-string 'postgresql://...'
   aws secretsmanager put-secret-value --secret-id crolyo-ingest-worker/SUPABASE_SECRET_KEY --secret-string 'sb_secret_...'
   aws secretsmanager put-secret-value --secret-id crolyo-ingest-worker/OPENROUTER_API_KEY --secret-string 'sk-or-...'
   ```
4. In GitHub, add the `AWS_DEPLOY_ROLE_ARN` secret (from
   `terraform output github_deploy_role_arn`) to a `production` environment, and
   optionally the `AWS_REGION` variable.
5. Merge to `main`. `.github/workflows/ingest-worker.yml` tests, builds the
   ARM64 image, pushes it to ECR and rolls the service. The first task starts
   once an image exists (the service retries until then).

The service ignores `task_definition` changes in Terraform, because CI owns
image rollouts. Changing CPU, memory or env vars here creates a new revision
that the next CI deploy picks up.
