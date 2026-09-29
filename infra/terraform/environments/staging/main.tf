terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "nazar-terraform-state"
    key            = "staging/terraform.tfstate"
    region         = "eu-west-2"
    encrypt        = true
    dynamodb_table = "nazar-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Nazar"
      Environment = "staging"
      ManagedBy   = "Terraform"
    }
  }
}

module "networking" {
  source      = "../../modules/networking"
  environment = "staging"
  vpc_cidr    = "10.1.0.0/16"
}

module "compute" {
  source                = "../../modules/compute"
  environment           = "staging"
  vpc_id                = module.networking.vpc_id
  public_subnet_ids     = module.networking.public_subnet_ids
  private_subnet_ids    = module.networking.private_app_subnet_ids
  alb_security_group_id = module.networking.alb_security_group_id
  app_security_group_id = module.networking.app_security_group_id
  image_tag             = var.image_tag
  ecr_repository_url    = var.ecr_repository_url
  desired_api_count     = 2
  desired_worker_count  = 1
}

module "postgresql" {
  source                  = "../../modules/postgresql"
  environment             = "staging"
  vpc_id                  = module.networking.vpc_id
  private_data_subnet_ids = module.networking.private_data_subnet_ids
  db_security_group_id    = module.networking.database_security_group_id
  instance_class          = "db.t4g.medium" # Staging sizing
  multi_az                = false
  backup_retention_period = 7
}

module "redis" {
  source                  = "../../modules/redis"
  environment             = "staging"
  private_data_subnet_ids = module.networking.private_data_subnet_ids
  redis_security_group_id = module.networking.redis_security_group_id
  node_type               = "cache.t4g.medium"
  num_cache_clusters      = 1
}

module "storage" {
  source          = "../../modules/storage"
  environment     = "staging"
  allowed_origins = ["https://staging.nazar.app", "https://admin-staging.nazar.app"]
}
