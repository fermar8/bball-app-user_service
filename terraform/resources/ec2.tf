# Data source for latest Amazon Linux 2023 AMI
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# EC2 instance for the NestJS user service
# nonlive/live: stopped by default
# set var.ec2_auto_start=true only when actively testing
resource "aws_instance" "app_server" {
  ami                    = data.aws_ami.amazon_linux_2023.id
  instance_type          = var.ec2_instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_profile.name
  key_name               = var.ec2_key_pair_name != "" ? var.ec2_key_pair_name : null

  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    environment       = var.environment
    app_port          = var.app_port
    aws_region        = var.aws_region
    project_name      = var.project_name
    cognito_pool_id   = aws_cognito_user_pool.user_pool.id
    cognito_client_id = aws_cognito_user_pool_client.user_pool_client.id
    users_table       = aws_dynamodb_table.users.name
    teams_table       = "bball-app-data-consumption-teams-static-${var.environment}"
    log_group         = aws_cloudwatch_log_group.app_logs.name
  }))

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 30
    delete_on_termination = true
    encrypted             = true
  }

  tags = merge(var.tags, {
    Name        = "${var.project_name}-server-${var.environment}"
    Environment = var.environment
    # Tag to identify if instance should be running automatically
    AutoStart = var.ec2_auto_start ? "true" : "false"
  })
}

resource "aws_ec2_instance_state" "app_server" {
  instance_id = aws_instance.app_server.id
  state       = var.ec2_auto_start ? "running" : "stopped"
}

# CloudWatch agent configuration SSM parameter
resource "aws_ssm_parameter" "cloudwatch_config" {
  name = "/${var.project_name}/${var.environment}/cloudwatch-config"
  type = "String"
  value = jsonencode({
    logs = {
      logs_collected = {
        files = {
          collect_list = [
            {
              file_path        = "/var/log/bball-app/app.log"
              log_group_name   = aws_cloudwatch_log_group.app_logs.name
              log_stream_name  = "{instance_id}/app"
              timestamp_format = "%Y-%m-%dT%H:%M:%S"
            }
          ]
        }
      }
    }
    metrics = {
      namespace = "BballApp/UserService"
      metrics_collected = {
        cpu = {
          measurement                 = ["cpu_usage_idle", "cpu_usage_iowait"]
          metrics_collection_interval = 60
        }
        mem = {
          measurement                 = ["mem_used_percent"]
          metrics_collection_interval = 60
        }
      }
    }
  })

  tags = merge(var.tags, {
    Environment = var.environment
  })
}
