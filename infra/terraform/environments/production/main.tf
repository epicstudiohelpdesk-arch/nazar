terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "nazar-terraform-state-prod"
    key            = "production/terraform.tfstate"
    region         = "eu-west-2"
    encrypt        = true
    dynamodb_table = "nazar-terraform-locks-prod"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "Nazar"
      Environment = "production"
      ManagedBy   = "Terraform"
    }
  }
}

module "networking" {
  source      = "../../modules/networking"
  environment = "production"
  vpc_cidr    = "10.0.0.0/16"
}

module "compute" {
  source                = "../../modules/compute"
  environment           = "production"
  vpc_id                = module.networking.vpc_id
  public_subnet_ids     = module.networking.public_subnet_ids
  private_subnet_ids    = module.networking.private_app_subnet_ids
  alb_security_group_id = module.networking.alb_security_group_id
  app_security_group_id = module.networking.app_security_group_id
  image_tag             = var.image_tag
  ecr_repository_url    = var.ecr_repository_url
  desired_api_count     = 2 # Initial launch baseline (scales horizontally to 6 for 100k DAU)
  desired_worker_count  = 1
}

module "postgresql" {
  source                  = "../../modules/postgresql"
  environment             = "production"
  vpc_id                  = module.networking.vpc_id
  private_data_subnet_ids = module.networking.private_data_subnet_ids
  db_security_group_id    = module.networking.database_security_group_id
  instance_class          = "db.m6g.xlarge" # 4 vCPU, 16GB RAM (Gate 17 baseline)
  multi_az                = true
  backup_retention_period = 30
}

module "redis" {
  source                  = "../../modules/redis"
  environment             = "production"
  private_data_subnet_ids = module.networking.private_data_subnet_ids
  redis_security_group_id = module.networking.redis_security_group_id
  node_type               = "cache.m6g.large"
  num_cache_clusters      = 2
}

module "storage" {
  source          = "../../modules/storage"
  environment     = "production"
  allowed_origins = ["https://nazar.app", "https://admin.nazar.app"]
}
