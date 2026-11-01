terraform {
  required_version = ">= 1.6"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.70"
    }
  }

  # Configure a remote backend before using this for real, e.g.:
  # backend "s3" {
  #   bucket         = "crolyo-terraform-state"
  #   key            = "ingest-worker/terraform.tfstate"
  #   region         = "us-east-1"
  #   dynamodb_table = "crolyo-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.region

  default_tags {
    tags = {
      Project   = "crolyo"
      Service   = "ingest-worker"
      ManagedBy = "terraform"
    }
  }
}
