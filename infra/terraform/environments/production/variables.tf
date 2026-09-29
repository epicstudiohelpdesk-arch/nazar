variable "aws_region" {
  type    = string
  default = "eu-west-2"
}

variable "image_tag" {
  type        = string
  description = "Immutable git SHA tag for the container image"
}

variable "ecr_repository_url" {
  type        = string
  description = "ECR image repository URI"
}
