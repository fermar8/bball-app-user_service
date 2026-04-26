# Security Group for EC2 instance
resource "aws_security_group" "app_sg" {
  name        = "${var.project_name}-sg-${var.environment}"
  description = "Security group for bball-app user service EC2 instance"
  vpc_id      = aws_vpc.main.id

  # Application port (HTTP)
  ingress {
    description = "Application HTTP"
    from_port   = var.app_port
    to_port     = var.app_port
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # All outbound traffic
  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-sg-${var.environment}"
    Environment = var.environment
  })
}
