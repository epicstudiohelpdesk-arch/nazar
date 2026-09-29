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

variable "alb_arn_suffix" {
  type = string
}

variable "db_instance_identifier" {
  type = string
}

variable "alert_email" {
  type        = string
  default     = "ops-alerts@nazar.app"
  description = "Destination email for critical platform alerts"
}

# ------------------------------------------------------------------------------
# SNS Alert Notification Topic
# ------------------------------------------------------------------------------
resource "aws_sns_topic" "alerts" {
  name = "nazar-${var.environment}-platform-alerts"

  tags = {
    Name        = "nazar-${var.environment}-alerts"
    Environment = var.environment
  }
}

resource "aws_sns_topic_subscription" "email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# ------------------------------------------------------------------------------
# CloudWatch Alarms: API & HTTP Layer
# ------------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "api_5xx_rate" {
  alarm_name          = "nazar-${var.environment}-api-high-5xx-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Sum"
  threshold           = 10 # More than 10 5xx in a minute
  alarm_description   = "API cluster is returning elevated 5xx error codes"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }
}

resource "aws_cloudwatch_metric_alarm" "api_latency_p95" {
  alarm_name          = "nazar-${var.environment}-api-p95-latency-degraded"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  extended_statistic  = "p95"
  threshold           = 0.250 # 250ms p95 latency threshold per Gate 17
  alarm_description   = "API p95 target response time degraded above 250ms"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    LoadBalancer = var.alb_arn_suffix
  }
}

# ------------------------------------------------------------------------------
# CloudWatch Alarms: Database Layer (Gate 17 Sizing: Max 100 Connections)
# ------------------------------------------------------------------------------
resource "aws_cloudwatch_metric_alarm" "db_connection_saturation" {
  alarm_name          = "nazar-${var.environment}-db-connection-saturation"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 80 # Alert at 80% of 100 max connection budget
  alarm_description   = "RDS PostgreSQL connection pool approaching saturation threshold (>80 connections)"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.db_instance_identifier
  }
}

resource "aws_cloudwatch_metric_alarm" "db_cpu_utilization" {
  alarm_name          = "nazar-${var.environment}-db-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 60
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "RDS PostgreSQL CPU utilization sustained above 80%"
  alarm_actions       = [aws_sns_topic.alerts.arn]

  dimensions = {
    DBInstanceIdentifier = var.db_instance_identifier
  }
}

output "alerts_topic_arn" {
  value = aws_sns_topic.alerts.arn
}
