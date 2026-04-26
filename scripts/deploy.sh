#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:?Usage: deploy.sh <environment> <deployment-bucket> <exit-code-if-no-instance>}"
DEPLOYMENT_BUCKET="${2:?Usage: deploy.sh <environment> <deployment-bucket> <exit-code-if-no-instance>}"
EXIT_CODE_IF_NO_INSTANCE="${3:?Usage: deploy.sh <environment> <deployment-bucket> <exit-code-if-no-instance>}"

INSTANCE_NAME="bball-app-user-service-server-${ENVIRONMENT}"
S3_KEY="bball-app-user-service/${ENVIRONMENT}/app.zip"

echo "Looking for running EC2 instance: ${INSTANCE_NAME}"

INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=${INSTANCE_NAME}" \
            "Name=instance-state-name,Values=running" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text)

if [ "$INSTANCE_ID" == "None" ] || [ -z "$INSTANCE_ID" ]; then
  echo "No running ${ENVIRONMENT} instance found."
  exit "${EXIT_CODE_IF_NO_INSTANCE}"
fi

echo "Deploying to ${ENVIRONMENT} instance: ${INSTANCE_ID}"

# Create deployment package
zip -r app.zip dist/ package.json package-lock.json

# Upload to S3
aws s3 cp app.zip "s3://${DEPLOYMENT_BUCKET}/${S3_KEY}"

# Deploy via SSM Run Command
aws ssm send-command \
  --instance-ids "$INSTANCE_ID" \
  --document-name "AWS-RunShellScript" \
  --parameters "commands=[
    \"cd /opt/bball-app-user-service\",
    \"aws s3 cp s3://${DEPLOYMENT_BUCKET}/${S3_KEY} .\",
    \"unzip -o app.zip\",
    \"npm ci --production\",
    \"pm2 restart bball-app-user-service || pm2 start dist/main.js --name bball-app-user-service\",
    \"pm2 save\"
  ]" \
  --output text
