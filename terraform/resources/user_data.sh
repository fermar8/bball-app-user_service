#!/bin/bash
set -e

# Update system
yum update -y

# Install Node.js 20 via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="/root/.nvm"
source "$NVM_DIR/nvm.sh"
nvm install 20
nvm use 20
nvm alias default 20

# Create symlinks so node/npm are available system-wide
ln -sf "$(which node)" /usr/local/bin/node
ln -sf "$(which npm)" /usr/local/bin/npm

# Install PM2 for process management
npm install -g pm2

# Install CloudWatch agent
yum install -y amazon-cloudwatch-agent

# Create app directory
mkdir -p /opt/bball-app-user-service
mkdir -p /var/log/bball-app

# Write environment configuration
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

# Configure CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c "ssm:/${project_name}/${environment}/cloudwatch-config" 2>/dev/null || true

# Start CloudWatch agent
systemctl enable amazon-cloudwatch-agent
systemctl start amazon-cloudwatch-agent || true

echo "EC2 bootstrap complete. Deploy the app via CI/CD pipeline."
