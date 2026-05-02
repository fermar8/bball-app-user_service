# DynamoDB table for users
# Created per environment: bball-app-user-service-users-nonlive / bball-app-user-service-users-live

resource "aws_dynamodb_table" "users" {
  name         = "${var.project_name}-users-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "userId"

  attribute {
    name = "userId"
    type = "S"
  }

  attribute {
    name = "email"
    type = "S"
  }

  # GSI for querying by email
  global_secondary_index {
    name            = "email-index"
    hash_key        = "email"
    projection_type = "ALL"
  }

  # Enable point-in-time recovery for live
  point_in_time_recovery {
    enabled = var.environment == "live"
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-users-${var.environment}"
      Environment = var.environment
    }
  )
}

# DynamoDB table for user teams
# Created per environment: bball-app-user-service-teams-nonlive / bball-app-user-service-teams-live

resource "aws_dynamodb_table" "teams" {
  name         = "${var.project_name}-teams-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  # GSI for querying teams by user (owner)
  global_secondary_index {
    name            = "userId-index"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  # Enable point-in-time recovery for live
  point_in_time_recovery {
    enabled = var.environment == "live"
  }

  tags = merge(
    var.tags,
    {
      Name        = "${var.project_name}-teams-${var.environment}"
      Environment = var.environment
    }
  )
}
