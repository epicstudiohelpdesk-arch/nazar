terraform {
  required_version = ">= 1.5.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

variable "zone_id" {
  type        = string
  description = "Cloudflare DNS Zone ID"
}

variable "domain_name" {
  type        = string
  default     = "nazar.app"
  description = "Base domain name"
}

variable "alb_dns_name" {
  type        = string
  description = "Origin Application Load Balancer DNS name"
}

variable "environment" {
  type = string
}

# ------------------------------------------------------------------------------
# DNS Records (Proxied through Cloudflare for DDoS & WAF Protection)
# ------------------------------------------------------------------------------
resource "cloudflare_record" "api" {
  zone_id = var.zone_id
  name    = var.environment == "production" ? "api" : "api-${var.environment}"
  value   = var.alb_dns_name
  type    = "CNAME"
  proxied = true
  ttl     = 1 # Auto
}

resource "cloudflare_record" "ws" {
  zone_id = var.zone_id
  name    = var.environment == "production" ? "ws" : "ws-${var.environment}"
  value   = var.alb_dns_name
  type    = "CNAME"
  proxied = true
  ttl     = 1
}

# ------------------------------------------------------------------------------
# Zone SSL / TLS Settings: Full (Strict) Only
# ------------------------------------------------------------------------------
resource "cloudflare_zone_settings_override" "settings" {
  zone_id = var.zone_id

  settings {
    ssl                      = "strict"
    always_use_https         = "on"
    min_tls_version          = "1.2"
    opportunistic_encryption = "on"
    brotli                   = "on"
    http3                    = "on"
    websockets               = "on"
    security_header {
      enabled            = true
      preload            = true
      max_age            = 31536000
      include_subdomains = true
      nosniff            = true
    }
  }
}

# ------------------------------------------------------------------------------
# Edge Cache Rules: Explicit Endpoint Classification (Gate 18)
# ------------------------------------------------------------------------------
resource "cloudflare_page_rule" "bypass_api_cache" {
  zone_id  = var.zone_id
  target   = "*${var.domain_name}/v1/*"
  priority = 1

  actions {
    cache_level = "bypass" # Strict bypass: no personalized API data cached
  }
}

resource "cloudflare_page_rule" "bypass_websocket_cache" {
  zone_id  = var.zone_id
  target   = "*${var.domain_name}/chat/*"
  priority = 2

  actions {
    cache_level = "bypass"
  }
}

resource "cloudflare_page_rule" "media_cache" {
  zone_id  = var.zone_id
  target   = "media.${var.domain_name}/*"
  priority = 3

  actions {
    cache_level         = "cache_everything"
    edge_cache_ttl      = 2592000 # 30 days edge cache
    browser_cache_ttl   = 604800  # 7 days browser cache
  }
}

# ------------------------------------------------------------------------------
# WAF & Edge Rate Limiting Rules
# ------------------------------------------------------------------------------
resource "cloudflare_rate_limit" "api_global" {
  zone_id   = var.zone_id
  threshold = 120
  period    = 60

  match {
    request {
      url_pattern = "*${var.domain_name}/v1/*"
      schemes     = ["HTTPS"]
      methods     = ["GET", "POST", "PUT", "PATCH", "DELETE"]
    }
    response {
      statuses = [200, 201, 204, 301, 302, 400, 401, 403, 404]
    }
  }

  action {
    mode    = "simulate" # Start with challenge/simulate during initial deploy
    timeout = 60
  }

  description = "Global IP rate limit for Nazar API"
}

resource "cloudflare_rate_limit" "auth_sensitive" {
  zone_id   = var.zone_id
  threshold = 5
  period    = 60

  match {
    request {
      url_pattern = "*${var.domain_name}/v1/auth/otp/*"
      schemes     = ["HTTPS"]
      methods     = ["POST"]
    }
  }

  action {
    mode    = "block"
    timeout = 300 # 5 min lockout
  }

  description = "Strict anti-abuse rate limit on OTP endpoints"
}

output "api_fqdn" {
  value = cloudflare_record.api.hostname
}

output "ws_fqdn" {
  value = cloudflare_record.ws.hostname
}
