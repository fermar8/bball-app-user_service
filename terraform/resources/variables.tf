variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "eu-west-3"
}

variable "environment" {
  description = "Deployment environment (live or nonlive)"
  type        = string

  validation {
    condition     = contains(["live", "nonlive"], var.environment)
    error_message = "Environment must be either 'live' or 'nonlive'."
  }
}

variable "project_name" {
  description = "Name of the project (used for resource naming)"
  type        = string
  default     = "bball-app-user-service"
}

variable "ec2_instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t3.micro"
}

variable "ec2_auto_start" {
  description = "Whether EC2 should be running after apply (set true only when actively testing)"
  type        = bool
  default     = false
}

variable "create_ec2_eip" {
  description = "Whether to allocate and attach an Elastic IP to EC2 (set true only when actively testing to avoid idle IPv4 charges)"
  type        = bool
  default     = false
}

variable "ec2_key_pair_name" {
  description = "EC2 key pair name for SSH access"
  type        = string
  default     = ""
}

variable "app_port" {
  description = "Port the NestJS application listens on"
  type        = number
  default     = 3000
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 7
}

variable "alarm_emails" {
  description = "List of email addresses to receive CloudWatch alarm notifications (live only)"
  type        = list(string)
  default     = []
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR block for the public subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "tags" {
  description = "Tags to apply to all resources"
  type        = map(string)
  default = {
    Project   = "bball-app"
    ManagedBy = "terraform"
  }
}
