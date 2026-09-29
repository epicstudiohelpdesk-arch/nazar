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
  type        = string
  description = "Target deployment environment"
}

variable "vpc_id" {
  type = string
}

variable "public_subnet_ids" {
  type = list(string)
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "alb_security_group_id" {
  type = string
}

variable "app_security_group_id" {
  type = string
}

variable "image_tag" {
  type        = string
  description = "Immutable git SHA tag for the container image"
}

variable "ecr_repository_url" {
  type        = string
  description = "ECR image repository URI"
}

variable "desired_api_count" {
  type        = number
  default     = 2
  description = "Initial API container count (2 per Gate 17 sizing)"
}

variable "desired_worker_count" {
  type        = number
  default     = 1
  description = "Initial Worker container count"
}

# ------------------------------------------------------------------------------
# Application Load Balancer
# ------------------------------------------------------------------------------
resource "aws_lb" "api" {
  name               = "nazar-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  enable_deletion_protection = var.environment == "production"

  tags = {
    Name        = "nazar-${var.environment}-alb"
    Environment = var.environment
  }
}

# Target Group for HTTP API Endpoints
resource "aws_lb_target_group" "api" {
  name        = "nazar-${var.environment}-api-tg"
  port        = 4000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    enabled             = true
    path                = "/health"
    port                = "4000"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30 # Connection draining
}

# Target Group for Realtime WebSocket Gateway (Sticky Sessions & Extended Timeouts)
resource "aws_lb_target_group" "ws" {
  name        = "nazar-${var.environment}-ws-tg"
  port        = 4000
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  stickiness {
    type            = "lb_cookie"
    cookie_duration = 86400
    enabled         = true
  }

  health_check {
    enabled             = true
    path                = "/health"
    port                = "4000"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 60 # Extended draining for persistent connections
}

# HTTP Listener (Redirect to HTTPS)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.api.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# ------------------------------------------------------------------------------
# ECS Cluster & Workload Separation
# ------------------------------------------------------------------------------
resource "aws_ecs_cluster" "main" {
  name = "nazar-${var.environment}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# IAM Execution Role
resource "aws_iam_role" "ecs_execution" {
  name = "nazar-${var.environment}-ecs-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# API Task Definition (Sized per Gate 17: 2 vCPU, 4GB RAM)
resource "aws_ecs_task_definition" "api" {
  family                   = "nazar-${var.environment}-api"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "2048" # 2 vCPU
  memory                   = "4096" # 4 GB RAM
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([{
    name      = "nazar-api"
    image     = "${var.ecr_repository_url}:${var.image_tag}"
    essential = true
    portMappings = [{
      containerPort = 4000
      hostPort      = 4000
    }]
    environment = [
      { name = "NODE_ENV", value = var.environment },
      { name = "PORT", value = "4000" }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/nazar-${var.environment}-api"
        "awslogs-region"        = "eu-west-2"
        "awslogs-stream-prefix" = "api"
      }
    }
  }])
}

# ECS API Service
resource "aws_ecs_service" "api" {
  name            = "nazar-${var.environment}-api-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.api.arn
  desired_count   = var.desired_api_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [var.app_security_group_id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "nazar-api"
    container_port   = 4000
  }

  deployment_controller {
    type = "ECS"
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
}

# Worker Task Definition (Background processing)
resource "aws_ecs_task_definition" "worker" {
  family                   = "nazar-${var.environment}-worker"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "2048"
  memory                   = "4096"
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([{
    name      = "nazar-worker"
    image     = "${var.ecr_repository_url}:${var.image_tag}"
    command   = ["node", "dist/worker.js"]
    essential = true
    environment = [
      { name = "NODE_ENV", value = var.environment }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = "/ecs/nazar-${var.environment}-worker"
        "awslogs-region"        = "eu-west-2"
        "awslogs-stream-prefix" = "worker"
      }
    }
  }])
}

# ECS Worker Service
resource "aws_ecs_service" "worker" {
  name            = "nazar-${var.environment}-worker-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.worker.arn
  desired_count   = var.desired_worker_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = var.private_subnet_ids
    security_groups = [var.app_security_group_id]
  }
}

output "alb_dns_name" {
  value = aws_lb.api.dns_name
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "api_service_name" {
  value = aws_ecs_service.api.name
}

output "worker_service_name" {
  value = aws_ecs_service.worker.name
}
