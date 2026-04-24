# CloudWatch Log Group for the application
resource "aws_cloudwatch_log_group" "app_logs" {
  name              = "/bball-app/user-service/${var.environment}"
  retention_in_days = var.log_retention_days

  tags = merge(var.tags, {
    Name        = "${var.project_name}-logs-${var.environment}"
    Environment = var.environment
  })
}

# SNS Topic for CloudWatch Alarms (live only)
resource "aws_sns_topic" "app_alarms" {
  count = var.environment == "live" ? 1 : 0
  name  = "${var.project_name}-${var.environment}-alarms"

  tags = merge(var.tags, {
    Environment = var.environment
    Purpose     = "Application error notifications"
  })
}

# SNS email subscriptions (live only)
resource "aws_sns_topic_subscription" "app_alarms_email" {
  for_each  = var.environment == "live" ? toset(var.alarm_emails) : toset([])
  topic_arn = aws_sns_topic.app_alarms[0].arn
  protocol  = "email"
  endpoint  = each.value
}

# CloudWatch Metric Alarm - High CPU (live only)
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  count               = var.environment == "live" ? 1 : 0
  alarm_name          = "${var.project_name}-${var.environment}-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "EC2 CPU utilization is above 80%"
  treat_missing_data  = "notBreaching"

  dimensions = {
    InstanceId = aws_instance.app_server.id
  }

  alarm_actions = [aws_sns_topic.app_alarms[0].arn]
  ok_actions    = [aws_sns_topic.app_alarms[0].arn]

  tags = merge(var.tags, { Environment = var.environment })
}

# CloudWatch Log Metric Filter - Application errors
resource "aws_cloudwatch_log_metric_filter" "error_count" {
  name           = "${var.project_name}-${var.environment}-errors"
  log_group_name = aws_cloudwatch_log_group.app_logs.name
  pattern        = "[timestamp, level=ERROR, ...]"

  metric_transformation {
    name      = "ErrorCount"
    namespace = "BballApp/UserService"
    value     = "1"
  }
}

# CloudWatch Metric Alarm - Application errors (live only)
resource "aws_cloudwatch_metric_alarm" "app_errors" {
  count               = var.environment == "live" ? 1 : 0
  alarm_name          = "${var.project_name}-${var.environment}-app-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ErrorCount"
  namespace           = "BballApp/UserService"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  alarm_description   = "Application error rate is elevated"
  treat_missing_data  = "notBreaching"

  alarm_actions = [aws_sns_topic.app_alarms[0].arn]
  ok_actions    = [aws_sns_topic.app_alarms[0].arn]

  tags = merge(var.tags, { Environment = var.environment })
}
