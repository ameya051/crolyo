data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

locals {
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
  # The worker makes outbound calls only: Supabase Postgres (5432), Supabase
  # Storage / OpenRouter / crawled sites (443, 80, and the two alternate web
  # ports the fetcher allows).
  egress_ports = [80, 443, 5432, 8080, 8443]
}

# ---------------------------------------------------------------------------
# Network: public subnets with no NAT gateway (saves ~$32/month). Tasks get a
# public IP for egress; the security group allows no inbound traffic at all.
# ---------------------------------------------------------------------------

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags                 = { Name = var.name }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  tags   = { Name = var.name }
}

resource "aws_subnet" "public" {
  count                   = length(local.azs)
  vpc_id                  = aws_vpc.this.id
  availability_zone       = local.azs[count.index]
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  map_public_ip_on_launch = false
  tags                    = { Name = "${var.name}-public-${local.azs[count.index]}" }
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }

  tags = { Name = "${var.name}-public" }
}

resource "aws_route_table_association" "public" {
  count          = length(aws_subnet.public)
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_security_group" "worker" {
  name        = var.name
  description = "Ingest worker: no inbound, outbound web + Postgres only"
  vpc_id      = aws_vpc.this.id
}

resource "aws_vpc_security_group_egress_rule" "worker" {
  for_each          = toset([for port in local.egress_ports : tostring(port)])
  security_group_id = aws_security_group.worker.id
  description       = "Outbound TCP ${each.value}"
  ip_protocol       = "tcp"
  from_port         = tonumber(each.value)
  to_port           = tonumber(each.value)
  cidr_ipv4         = "0.0.0.0/0"
}

# ---------------------------------------------------------------------------
# Image registry
# ---------------------------------------------------------------------------

resource "aws_ecr_repository" "worker" {
  name                 = var.name
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}

resource "aws_ecr_lifecycle_policy" "worker" {
  repository = aws_ecr_repository.worker.name
  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep the 20 most recent images"
      selection    = { tagStatus = "any", countType = "imageCountMoreThan", countNumber = 20 }
      action       = { type = "expire" }
    }]
  })
}

# ---------------------------------------------------------------------------
# Secrets: created empty here; set the values out of band, e.g.
#   aws secretsmanager put-secret-value --secret-id crolyo-ingest-worker/DATABASE_URL --secret-string '...'
# ---------------------------------------------------------------------------

resource "aws_secretsmanager_secret" "worker" {
  for_each                = toset(["DATABASE_URL", "SUPABASE_SECRET_KEY", "OPENROUTER_API_KEY"])
  name                    = "${var.name}/${each.key}"
  recovery_window_in_days = 7
}

# ---------------------------------------------------------------------------
# IAM
# ---------------------------------------------------------------------------

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
    condition {
      test     = "ArnLike"
      variable = "aws:SourceArn"
      values   = ["arn:aws:ecs:${var.region}:${data.aws_caller_identity.current.account_id}:*"]
    }
  }
}

# Used by ECS to pull the image, write logs and inject secrets.
resource "aws_iam_role" "execution" {
  name               = "${var.name}-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  statement {
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [for secret in aws_secretsmanager_secret.worker : secret.arn]
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  name   = "read-worker-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets.json
}

# The worker itself calls no AWS APIs, so its task role has no permissions.
resource "aws_iam_role" "task" {
  name               = "${var.name}-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json
}

# ---------------------------------------------------------------------------
# ECS
# ---------------------------------------------------------------------------

resource "aws_cloudwatch_log_group" "worker" {
  name              = "/ecs/${var.name}"
  retention_in_days = var.log_retention_days
}

resource "aws_ecs_cluster" "this" {
  name = var.name

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_ecs_task_definition" "worker" {
  family                   = var.name
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.execution.arn
  task_role_arn            = aws_iam_role.task.arn

  runtime_platform {
    operating_system_family = "LINUX"
    cpu_architecture        = "ARM64"
  }

  container_definitions = jsonencode([{
    name        = "worker"
    image       = "${aws_ecr_repository.worker.repository_url}:${var.image_tag}"
    essential   = true
    stopTimeout = 120 # > SHUTDOWN_GRACE_SECONDS (90) so in-flight jobs can drain
    environment = [
      { name = "SUPABASE_URL", value = var.supabase_url },
      { name = "EMBEDDING_MODEL", value = var.embedding_model },
      { name = "EMBEDDING_DIMENSIONS", value = tostring(var.embedding_dimensions) },
      { name = "WORKER_CONCURRENCY", value = tostring(var.worker_concurrency) },
      { name = "LOG_LEVEL", value = "INFO" },
    ]
    secrets = [
      for key, secret in aws_secretsmanager_secret.worker : { name = key, valueFrom = secret.arn }
    ]
    healthCheck = {
      command     = ["CMD", "python", "-m", "ingest_worker.healthcheck"]
      interval    = 30
      timeout     = 5
      retries     = 3
      startPeriod = 30
    }
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        awslogs-group         = aws_cloudwatch_log_group.worker.name
        awslogs-region        = var.region
        awslogs-stream-prefix = "worker"
      }
    }
    readonlyRootFilesystem = false
    user                   = "10001"
  }])
}

resource "aws_ecs_service" "worker" {
  name            = var.name
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  # Rolling deploys briefly run old + new tasks side by side, which is safe.
  deployment_minimum_healthy_percent = 100
  deployment_maximum_percent         = 200

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.worker.id]
    assign_public_ip = true
  }

  # CI registers new task definition revisions; don't roll them back on apply.
  lifecycle {
    ignore_changes = [task_definition]
  }
}

# ---------------------------------------------------------------------------
# Alarms
# ---------------------------------------------------------------------------

resource "aws_sns_topic" "alarms" {
  name = "${var.name}-alarms"
}

resource "aws_sns_topic_subscription" "email" {
  count     = var.alarm_email == "" ? 0 : 1
  topic_arn = aws_sns_topic.alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

resource "aws_cloudwatch_metric_alarm" "no_running_tasks" {
  alarm_name          = "${var.name}-no-running-tasks"
  alarm_description   = "No ingest worker task is running: knowledge sources won't sync."
  namespace           = "ECS/ContainerInsights"
  metric_name         = "RunningTaskCount"
  dimensions          = { ClusterName = aws_ecs_cluster.this.name, ServiceName = aws_ecs_service.worker.name }
  statistic           = "Minimum"
  period              = 60
  evaluation_periods  = 5
  comparison_operator = "LessThanThreshold"
  threshold           = 1
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
  ok_actions          = [aws_sns_topic.alarms.arn]
}

resource "aws_cloudwatch_log_metric_filter" "job_failed" {
  name           = "${var.name}-job-failed"
  log_group_name = aws_cloudwatch_log_group.worker.name
  pattern        = "{ $.event = \"job.failed\" && $.will_retry IS FALSE }"

  metric_transformation {
    name      = "JobsFailed"
    namespace = "Crolyo/IngestWorker"
    value     = "1"
  }
}

resource "aws_cloudwatch_metric_alarm" "jobs_failing" {
  alarm_name          = "${var.name}-jobs-failing"
  alarm_description   = "Several knowledge syncs failed permanently in the last 15 minutes."
  namespace           = "Crolyo/IngestWorker"
  metric_name         = "JobsFailed"
  statistic           = "Sum"
  period              = 900
  evaluation_periods  = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  threshold           = 5
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alarms.arn]
}

# ---------------------------------------------------------------------------
# GitHub Actions deploys via OIDC (no long-lived AWS keys)
# ---------------------------------------------------------------------------

resource "aws_iam_openid_connect_provider" "github" {
  count           = var.create_github_oidc_provider ? 1 : 0
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

data "aws_iam_openid_connect_provider" "github" {
  count = var.create_github_oidc_provider ? 0 : 1
  url   = "https://token.actions.githubusercontent.com"
}

locals {
  github_oidc_arn = var.create_github_oidc_provider ? aws_iam_openid_connect_provider.github[0].arn : data.aws_iam_openid_connect_provider.github[0].arn
}

data "aws_iam_policy_document" "github_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [local.github_oidc_arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repository}:ref:refs/heads/${var.github_branch}"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = "${var.name}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_assume.json
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"]
  }
  statement {
    actions = [
      "ecr:BatchCheckLayerAvailability",
      "ecr:BatchGetImage",
      "ecr:CompleteLayerUpload",
      "ecr:InitiateLayerUpload",
      "ecr:PutImage",
      "ecr:UploadLayerPart",
    ]
    resources = [aws_ecr_repository.worker.arn]
  }
  statement {
    actions   = ["ecs:DescribeTaskDefinition", "ecs:RegisterTaskDefinition"]
    resources = ["*"]
  }
  statement {
    actions   = ["ecs:UpdateService", "ecs:DescribeServices"]
    resources = [aws_ecs_service.worker.id]
  }
  statement {
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.execution.arn, aws_iam_role.task.arn]
  }
}

resource "aws_iam_role_policy" "github_deploy" {
  name   = "deploy-ingest-worker"
  role   = aws_iam_role.github_deploy.id
  policy = data.aws_iam_policy_document.github_deploy.json
}
