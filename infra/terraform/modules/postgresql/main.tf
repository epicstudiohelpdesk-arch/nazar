terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "environment" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_data_subnet_ids" {
  type = list(string)
}

variable "db_security_group_id" {
  type = string
}

variable "instance_class" {
  type        = string
  default     = "db.m6g.xlarge" # 4 vCPU, 16GB RAM (Gate 17 baseline)
  description = "RDS instance class"
}

variable "allocated_storage" {
  type    = number
  default = 50
}

variable "max_allocated_storage" {
  type    = number
  default = 500
}

variable "backup_retention_period" {
  type    = number
  default = 30 # 30 days PITR retention for production
}

variable "multi_az" {
  type    = bool
  default = true
}

# Subnet Group
resource "aws_db_subnet_group" "main" {
  name       = "nazar-${var.environment}-db-subnet-group"
  subnet_ids = var.private_data_subnet_ids

  tags = {
    Name        = "nazar-${var.environment}-db-subnet-group"
    Environment = var.environment
  }
}

# Parameter Group enforcing Gate 17 database controls
resource "aws_db_parameter_group" "pg16" {
  name   = "nazar-${var.environment}-pg16-params"
  family = "postgres16"

  # Gate 17 Hardened Database Parameters
  parameter {
    name  = "statement_timeout"
    value = "3000" # 3 seconds strict execution timeout
  }

  parameter {
    name  = "idle_in_transaction_session_timeout"
    value = "5000" # Clean up hung transactions
  }

  parameter {
    name  = "rds.force_ssl"
    value = "1" # Force SSL/TLS encrypted connections
  }

  parameter {
    name  = "shared_preload_libraries"
    value = "pg_stat_statements"
  }

  parameter {
    name  = "track_activity_query_size"
    value = "2048"
  }

  tags = {
    Environment = var.environment
  }
}

# PostgreSQL 16 Primary Database
resource "aws_db_instance" "primary" {
  identifier                  = "nazar-${var.environment}-pg"
  engine                      = "postgres"
  engine_version              = "16.2"
  instance_class              = var.instance_class
  allocated_storage           = var.allocated_storage
  max_allocated_storage       = var.max_allocated_storage
  storage_type                = "gp3"
  storage_encrypted           = true
  multi_az                    = var.multi_az
  publicly_accessible        = false # STRICT SECURITY: Never expose to internet
  auto_minor_version_upgrade  = true

  db_name  = "nazar_${var.environment}"
  username = "nazar_${var.environment}_admin"
  manage_master_user_password = true # Managed by AWS Secrets Manager

  db_subnet_group_name   = aws_db_subnet_group.main.name
  parameter_group_name   = aws_db_parameter_group.pg16.name
  vpc_security_group_ids = [var.db_security_group_id]

  backup_retention_period   = var.backup_retention_period
  backup_window             = "02:00-03:00"
  maintenance_window        = "sun:03:30-sun:04:30"
  copy_tags_to_snapshot     = true
  deletion_protection       = var.environment == "production"
  skip_final_snapshot       = var.environment != "production"
  final_snapshot_identifier = "nazar-${var.environment}-final-snapshot"

  tags = {
    Name        = "nazar-${var.environment}-postgres"
    Environment = var.environment
  }
}

# Optional Read Replica for Discovery Scaling (Tier 2 readiness)
resource "aws_db_instance" "replica" {
  count                  = var.environment == "production" ? 1 : 0
  identifier             = "nazar-${var.environment}-pg-read-replica"
  replicate_source_db    = aws_db_instance.primary.identifier
  instance_class         = var.instance_class
  storage_type           = "gp3"
  storage_encrypted      = true
  publicly_accessible   = false
  vpc_security_group_ids = [var.db_security_group_id]
  parameter_group_name   = aws_db_parameter_group.pg16.name
  auto_minor_version_upgrade = true
  skip_final_snapshot    = true

  tags = {
    Name        = "nazar-${var.environment}-postgres-replica"
    Environment = var.environment
    Role        = "ReadReplica"
  }
}

output "db_endpoint" {
  value = aws_db_instance.primary.endpoint
}

output "db_read_endpoint" {
  value = var.environment == "production" ? aws_db_instance.replica[0].endpoint : aws_db_instance.primary.endpoint
}

output "db_master_secret_arn" {
  value = aws_db_instance.primary.master_user_secret[0].secret_arn
}
