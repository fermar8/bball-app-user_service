# Cognito User Pool
resource "aws_cognito_user_pool" "user_pool" {
  name = "${var.project_name}-user-pool-${var.environment}"

  # Password policy
  password_policy {
    minimum_length                   = 8
    require_uppercase                = true
    require_lowercase                = true
    require_numbers                  = true
    require_symbols                  = true
    temporary_password_validity_days = 7
  }

  # Email as username
  username_attributes = ["email"]

  # Auto-verify email
  auto_verified_attributes = ["email"]

  # Email configuration
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  # User pool verification message
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "Your Basketball App verification code"
    email_message        = "Your verification code is {####}"
  }

  # Schema attributes
  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 5
      max_length = 254
    }
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = true
    mutable             = true

    string_attribute_constraints {
      min_length = 2
      max_length = 100
    }
  }

  # Account recovery settings
  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  # MFA configuration (optional, off by default)
  mfa_configuration = "OFF"

  tags = merge(var.tags, {
    Name        = "${var.project_name}-user-pool-${var.environment}"
    Environment = var.environment
  })
}

# Cognito User Pool App Client
resource "aws_cognito_user_pool_client" "user_pool_client" {
  name         = "${var.project_name}-client-${var.environment}"
  user_pool_id = aws_cognito_user_pool.user_pool.id

  # Enable USER_PASSWORD_AUTH flow (for server-side auth)
  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
    "ALLOW_USER_SRP_AUTH"
  ]

  # Token validity
  access_token_validity  = 1  # hours
  id_token_validity      = 1  # hours
  refresh_token_validity = 30 # days

  token_validity_units {
    access_token  = "hours"
    id_token      = "hours"
    refresh_token = "days"
  }

  # Don't generate client secret (for server-to-server calls without secret)
  generate_secret = false

  # Prevent user existence errors
  prevent_user_existence_errors = "ENABLED"
}
