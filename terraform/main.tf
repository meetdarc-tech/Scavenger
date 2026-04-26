terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "scavenger-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Environment = var.environment
      Project     = "scavenger"
      ManagedBy   = "terraform"
    }
  }
}

# VPC
module "vpc" {
  source = "./modules/vpc"

  environment = var.environment
  cidr_block  = var.vpc_cidr
  az_count    = var.az_count
}

# RDS Database
module "rds" {
  source = "./modules/rds"

  environment          = var.environment
  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  db_name              = var.db_name
  db_username          = var.db_username
  db_password          = var.db_password
  instance_class       = var.db_instance_class
  allocated_storage    = var.db_allocated_storage
  backup_retention     = var.db_backup_retention
  multi_az             = var.db_multi_az
}

# ECS Cluster
module "ecs" {
  source = "./modules/ecs"

  environment         = var.environment
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  public_subnet_ids   = module.vpc.public_subnet_ids
  container_image     = var.container_image
  container_port      = var.container_port
  desired_count       = var.ecs_desired_count
  min_capacity        = var.ecs_min_capacity
  max_capacity        = var.ecs_max_capacity
  db_host             = module.rds.endpoint
  db_name             = var.db_name
}

# ALB
module "alb" {
  source = "./modules/alb"

  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  target_group_arn   = module.ecs.target_group_arn
  certificate_arn    = var.certificate_arn
}

# CloudWatch
module "monitoring" {
  source = "./modules/monitoring"

  environment = var.environment
  alb_arn     = module.alb.arn
  ecs_cluster = module.ecs.cluster_name
  rds_id      = module.rds.db_instance_id
}

# Outputs
output "alb_dns_name" {
  value       = module.alb.dns_name
  description = "DNS name of the load balancer"
}

output "rds_endpoint" {
  value       = module.rds.endpoint
  description = "RDS database endpoint"
  sensitive   = true
}

output "ecs_cluster_name" {
  value       = module.ecs.cluster_name
  description = "ECS cluster name"
}
