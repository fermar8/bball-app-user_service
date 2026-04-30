#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:?Usage: deploy.sh <environment> <deployment-bucket> <exit-code-if-no-instance> <ecr-repository-url> <image-tag>}"
DEPLOYMENT_BUCKET="${2:?Usage: deploy.sh <environment> <deployment-bucket> <exit-code-if-no-instance> <ecr-repository-url> <image-tag>}"
EXIT_CODE_IF_NO_INSTANCE="${3:?Usage: deploy.sh <environment> <deployment-bucket> <exit-code-if-no-instance> <ecr-repository-url> <image-tag>}"
ECR_REPOSITORY_URL="${4:?Usage: deploy.sh <environment> <deployment-bucket> <exit-code-if-no-instance> <ecr-repository-url> <image-tag>}"
IMAGE_TAG="${5:?Usage: deploy.sh <environment> <deployment-bucket> <exit-code-if-no-instance> <ecr-repository-url> <image-tag>}"

INSTANCE_NAME="bball-app-user-service-server-${ENVIRONMENT}"
IMAGE_URL="${ECR_REPOSITORY_URL}:${IMAGE_TAG}"

echo "Looking for EC2 instance: ${INSTANCE_NAME}"

# Find instance by name (any state)
INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=${INSTANCE_NAME}" \
            "Name=instance-state-name,Values=running,stopped,stopping" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text)

if [ "$INSTANCE_ID" == "None" ] || [ -z "$INSTANCE_ID" ]; then
  echo "No ${ENVIRONMENT} instance found."
  exit "${EXIT_CODE_IF_NO_INSTANCE}"
fi

echo "Found instance: ${INSTANCE_ID}"

# Get current instance state and AutoStart tag
INSTANCE_STATE=$(aws ec2 describe-instances \
  --instance-ids "$INSTANCE_ID" \
  --query "Reservations[0].Instances[0].State.Name" \
  --output text)

AUTO_START=$(aws ec2 describe-tags \
  --filters "Name=resource-id,Values=${INSTANCE_ID}" "Name=key,Values=AutoStart" \
  --query "Tags[0].Value" \
  --output text || echo "false")

echo "Instance state: ${INSTANCE_STATE}, AutoStart: ${AUTO_START}"

# Start instance if not running
WAS_STOPPED="false"
if [ "$INSTANCE_STATE" != "running" ]; then
  WAS_STOPPED="true"
  echo "Starting instance..."
  aws ec2 start-instances --instance-ids "$INSTANCE_ID"
  
  echo "Waiting for instance to be running..."
  aws ec2 wait instance-running --instance-ids "$INSTANCE_ID"
  
  echo "Waiting for SSM agent to be ready..."
  MAX_WAIT=60
  WAIT_COUNT=0
  while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
    SSM_STATUS=$(aws ssm describe-instance-information \
      --filters "Key=InstanceIds,Values=${INSTANCE_ID}" \
      --query "InstanceInformationList[0].PingStatus" \
      --output text 2>/dev/null || echo "")
    
    if [ "$SSM_STATUS" == "Online" ]; then
      echo "SSM agent is ready"
      break
    fi
    
    WAIT_COUNT=$((WAIT_COUNT + 1))
    if [ $WAIT_COUNT -ge $MAX_WAIT ]; then
      echo "ERROR: SSM agent did not become ready in time"
      exit 1
    fi
    
    echo "Waiting for SSM agent... ($WAIT_COUNT/$MAX_WAIT)"
    sleep 5
  done
fi

echo "Deploying Docker container ${IMAGE_URL} to ${ENVIRONMENT} instance: ${INSTANCE_ID}"

# Get AWS region
AWS_REGION=${AWS_REGION:-eu-west-3}

# Deploy via SSM Run Command
COMMAND_ID=$(aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "commands=[
    \"echo 'Configuring CloudWatch agent...'\",
    \"/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c ssm:/bball-app/user-service/${ENVIRONMENT}/cloudwatch-config || echo 'CloudWatch config failed, continuing...'\",
    \"systemctl start amazon-cloudwatch-agent || true\",
    \"echo 'Logging in to ECR...'\",
    \"aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REPOSITORY_URL}\",
    \"echo 'Pulling Docker image: ${IMAGE_URL}...'\",
    \"docker pull ${IMAGE_URL}\",
    \"echo 'Stopping old container...'\",
    \"docker stop bball-app-user-service || true\",
    \"docker rm bball-app-user-service || true\",
    \"echo 'Starting new container...'\",
    \"docker run -d --name bball-app-user-service --env-file /opt/bball-app-user-service/.env -p 3000:3000 --restart unless-stopped ${IMAGE_URL}\",
    \"echo 'Verifying container health...'\",
    \"for i in 1 2 3; do sleep 5; if curl -f http://localhost:3000/api/v1/health 2>/dev/null; then echo 'Health check passed'; break; elif [ \\\$i -eq 3 ]; then echo 'Health check failed after 3 attempts'; docker logs --tail 100 bball-app-user-service; exit 1; else echo 'Health check attempt \\\$i failed, retrying...'; fi; done\",
    \"docker ps -a\",
    \"echo 'Container logs:'\",
    \"docker logs --tail 50 bball-app-user-service\"
  ]" \
  --query "Command.CommandId" \
  --output text)

echo "SSM Command ID: ${COMMAND_ID}"

# Wait for command to complete
echo "Waiting for deployment command to complete..."
aws ssm wait command-executed \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID"

# Check command status
COMMAND_STATUS=$(aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --query "Status" \
  --output text)

echo "Deployment command status: ${COMMAND_STATUS}"

if [ "$COMMAND_STATUS" != "Success" ]; then
  echo "ERROR: Deployment failed"
  echo "=== Standard Error ==="
  aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --query "StandardErrorContent" \
    --output text
  echo "=== Standard Output ==="
  aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --query "StandardOutputContent" \
    --output text
  exit 1
fi

echo "Deployment successful!"

# Stop instance if AutoStart was false and we started it
if [ "$AUTO_START" == "false" ] && [ "$WAS_STOPPED" == "true" ]; then
  echo "Stopping instance (AutoStart=false)..."
  aws ec2 stop-instances --instance-ids "$INSTANCE_ID"
  echo "Instance will stop in background"
fi

echo "Docker container deployment complete!"
