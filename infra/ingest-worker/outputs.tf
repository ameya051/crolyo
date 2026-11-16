output "ecr_repository_url" {
  value = aws_ecr_repository.worker.repository_url
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.this.name
}

output "ecs_service_name" {
  value = aws_ecs_service.worker.name
}

output "task_definition_family" {
  value = aws_ecs_task_definition.worker.family
}

output "github_deploy_role_arn" {
  description = "Set as the AWS_DEPLOY_ROLE_ARN secret in GitHub."
  value       = aws_iam_role.github_deploy.arn
}

output "secret_names" {
  description = "Put the secret values here before the first deploy."
  value       = [for secret in aws_secretsmanager_secret.worker : secret.name]
}
