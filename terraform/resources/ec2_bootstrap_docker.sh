#!/bin/bash
set -e

# Idempotency check - skip if already set up
if [ -f /opt/app-setup-complete ]; then
  echo "Setup already complete, skipping..."
  exit 0
fi

echo "Starting EC2 Docker setup..."

# Update system
yum update -y

# Install Docker
echo "Installing Docker..."
yum install -y docker

# Start Docker service
systemctl enable docker
systemctl start docker

# Add ec2-user to docker group
usermod -a -G docker ec2-user || true

# Install CloudWatch agent
echo "Installing CloudWatch agent..."
yum install -y amazon-cloudwatch-agent

# Create app directory and log directory
mkdir -p /opt/bball-app-user-service
mkdir -p /var/log/bball-app

# Write environment file for Docker container
cat > /opt/bball-app-user-service/.env << 'ENVEOF'
NODE_ENV=${environment}
PORT=${app_port}
AWS_REGION=${aws_region}
COGNITO_USER_POOL_ID=${cognito_pool_id}
COGNITO_CLIENT_ID=${cognito_client_id}
DYNAMODB_USERS_TABLE=${users_table}
DYNAMODB_TEAMS_STATIC_TABLE=${teams_table}
CACHE_TTL=60
THROTTLE_TTL=60
THROTTLE_LIMIT=100
ENVEOF

# Configure CloudWatch agent for system metrics (non-blocking)
echo "Configuring CloudWatch agent..."
if ! /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c "ssm:/${project_name}/${environment}/cloudwatch-config" 2>/dev/null; then
  echo "WARNING: CloudWatch agent config fetch failed, will retry later"
fi

# Start CloudWatch agent (non-blocking)
systemctl enable amazon-cloudwatch-agent
systemctl start amazon-cloudwatch-agent || echo "WARNING: CloudWatch agent start failed"

# Mark setup as complete
touch /opt/app-setup-complete
echo "EC2 Docker setup complete at $(date). Deploy container via CI/CD pipeline."
