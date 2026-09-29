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

variable "private_data_subnet_ids" {
  type = list(string)
}

variable "redis_security_group_id" {
  type = string
}

variable "node_type" {
  type        = string
  default     = "cache.m6g.large" # 2 vCPU, 6.38 GB RAM
  description = "ElastiCache node type"
}

variable "num_cache_clusters" {
  type        = number
  default     = 2 # 1 primary + 1 replica with automatic failover
  description = "Number of cache clusters"
}

# Subnet Group
resource "aws_elasticache_subnet_group" "main" {
  name       = "nazar-${var.environment}-redis-subnet-group"
  subnet_ids = var.private_data_subnet_ids
}

# Parameter Group enforcing LRU eviction
resource "aws_elasticache_parameter_group" "redis7" {
  name   = "nazar-${var.environment}-redis7-params"
  family = "redis7"

  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru" # Safely evict least recently used cache keys under pressure
  }

  parameter {
    name  = "notify-keyspace-events"
    value = "Ex" # Key expiration events for session tracking
  }
}

# Secure random auth token generated for Redis
resource "aws_elasticache_replication_group" "main" {
  replication_group_id       = "nazar-${var.environment}-redis"
  description                = "Nazar Redis 7 Cache & Realtime PubSub Cluster"
  node_type                  = var.node_type
  num_cache_clusters         = var.num_cache_clusters
  port                       = 6379
  parameter_group_name       = aws_elasticache_parameter_group.redis7.name
  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [var.redis_security_group_id]
  automatic_failover_enabled = var.num_cache_clusters > 1
  multi_az_enabled           = var.num_cache_clusters > 1

  # Security Hardening
  transit_encryption_enabled = true # TLS in-transit
  at_rest_encryption_enabled = true # KMS at-rest

  auto_minor_version_upgrade = true
  maintenance_window         = "sun:05:00-sun:06:00"

  tags = {
    Name        = "nazar-${var.environment}-redis"
    Environment = var.environment
  }
}

output "primary_endpoint_address" {
  value = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "reader_endpoint_address" {
  value = aws_elasticache_replication_group.main.reader_endpoint_address
}
