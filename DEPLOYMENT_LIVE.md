# Production (Live) Deployment Setup Guide

This document describes the steps to configure and deploy the application to the production (live) environment for the first time.

## Prerequisites

- ✅ Nonlive environment configured and working
- ✅ GitHub Actions workflow configured
- ✅ Access to AWS CloudShell or AWS CLI configured locally
- ✅ Permissions to approve deployments in GitHub

## Initial Setup Steps

### 1. Commit and Push Changes

If there are pending workflow changes, commit and push:

```bash
git add .github/workflows/main.yml
git commit -m "feat: enable live deployment with manual approval"
git push origin main
```

### 2. Run Workflow Manually

1. Go to GitHub Actions in the repository
2. Select the workflow "Main CI - Build, Test, Deploy, and Release"
3. Click "Run workflow"
4. Configure:
   - **Branch**: `main`
   - **Enable nonlive testing mode**: ✅ **ON** (true)
5. Click "Run workflow"

The workflow will run automatically until deploy-nonlive, then pause waiting for manual approval.

### 3. Approve Provision Infrastructure (Live)

1. In GitHub Actions, you'll see the workflow paused at "Provision Infrastructure (Terraform - Live)"
2. Click the **"Review deployments"** button
3. Select the **production** environment
4. Click **"Approve and deploy"**

Terraform will create the production infrastructure:

- EC2 instance (stopped by default per `live.tfvars`)
- Cognito User Pool + Client
- DynamoDB tables (users-live, teams-static-live)
- ECR repository (bball-app-user-service-live)
- CloudWatch log groups
- Security Groups and networking

### 4. Get Live Cognito Values

Run in AWS CloudShell (or terminal with AWS CLI):

```bash
# 1. Get live User Pool ID
LIVE_USER_POOL_ID=$(aws cognito-idp list-user-pools --max-results 10 --region eu-west-3 \
  --query "UserPools[?Name=='bball-app-user-service-user-pool-live'].Id" --output text)

echo "User Pool ID: $LIVE_USER_POOL_ID"

# 2. Get live Client ID
LIVE_CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id $LIVE_USER_POOL_ID --region eu-west-3 \
  --query "UserPoolClients[0].ClientId" --output text)

echo "Client ID: $LIVE_CLIENT_ID"

# 3. Get live Instance ID
LIVE_INSTANCE_ID=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=bball-app-user-service-server-live" \
  --query "Reservations[0].Instances[0].InstanceId" \
  --output text --region eu-west-3)

echo "Instance ID: $LIVE_INSTANCE_ID"
```

**Save these values**, you'll need them in the next step.

### 5. Create .env File on Live EC2 Instance

Use the values obtained in the previous step:

```bash
aws ssm send-command \
  --instance-ids $LIVE_INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters "commands=[
    \"sudo mkdir -p /opt/bball-app-user-service\",
    \"sudo tee /opt/bball-app-user-service/.env > /dev/null <<EOF
NODE_ENV=production
PORT=3000
AWS_REGION=eu-west-3
COGNITO_USER_POOL_ID=$LIVE_USER_POOL_ID
COGNITO_CLIENT_ID=$LIVE_CLIENT_ID
DYNAMODB_USERS_TABLE=bball-app-user-service-users-live
DYNAMODB_TEAMS_STATIC_TABLE=bball-app-data-consumption-teams-static-live
CACHE_TTL=300
THROTTLE_TTL=60
THROTTLE_LIMIT=100
CORS_ORIGIN=*
EOF\",
    \"sudo chmod 600 /opt/bball-app-user-service/.env\",
    \"echo '.env file created successfully'\",
    \"cat /opt/bball-app-user-service/.env\"
  ]" \
  --region eu-west-3 \
  --query "Command.CommandId" \
  --output text
```

**Verify command execution:**

```bash
# Replace <COMMAND_ID> with the ID returned by the previous command
aws ssm get-command-invocation \
  --command-id <COMMAND_ID> \
  --instance-id $LIVE_INSTANCE_ID \
  --region eu-west-3
```

Verify that:

- `Status`: "Success"
- `StandardOutputContent`: Shows the .env file content

### 6. Approve Build Docker (Live)

The workflow will continue automatically after provision-infrastructure-live and execute build-docker-live without requiring approval.

### 7. Approve Deploy Live

1. The workflow will pause again at "Deploy to Live (Production)"
2. Click **"Review deployments"**
3. Select **production**
4. Click **"Approve and deploy"**

The deployment will:

- Start the EC2 instance
- Configure CloudWatch agent
- Deploy the Docker container
- Execute health checks (3 retries)
- Show container logs

### 8. Get Public IP and Test

```bash
# Get public IP (if live.tfvars has create_ec2_eip=true)
LIVE_PUBLIC_IP=$(aws ec2 describe-instances \
  --instance-ids $LIVE_INSTANCE_ID \
  --query "Reservations[0].Instances[0].PublicIpAddress" \
  --output text --region eu-west-3)

echo "Live Public IP: $LIVE_PUBLIC_IP"

# Or if you have Elastic IP configured:
LIVE_EIP=$(aws ec2 describe-addresses \
  --filters "Name=tag:Environment,Values=live" \
  --query "Addresses[0].PublicIp" \
  --output text --region eu-west-3)

echo "Live Elastic IP: $LIVE_EIP"
```

**Test health endpoint in Postman:**

```
GET http://<IP_LIVE>:3000/api/v1/health
```

**Expected response:**

```json
{
  "status": "ok",
  "timestamp": "2026-04-30T...",
  "service": "bball-app-user-service",
  "version": "0.1.0"
}
```

### 9. (Optional) Approve Create Release

If everything works correctly:

1. The workflow will pause at "Create GitHub Release"
2. Approve to create an automatic release with:
   - Versioned tag (v0.1.1, v0.1.2, etc.)
   - Deployment package (.zip)
   - Automatic release notes

### 10. Verify CloudWatch Logs

```bash
# View logs in CloudWatch
aws logs tail /bball-app/user-service/live --follow --region eu-west-3
```

## Post-Deployment Management

### Stop Live Server (Save Costs)

If you need to stop the production server:

**Option 1 - From CloudShell:**

```bash
cd terraform/resources
terraform apply -var-file="live.tfvars" -var="ec2_auto_start=false" -var="create_ec2_eip=false"
```

**Option 2 - From AWS Console:**

```bash
aws ec2 stop-instances --instance-ids $LIVE_INSTANCE_ID --region eu-west-3
```

### Start Live Server

```bash
cd terraform/resources
terraform apply -var-file="live.tfvars" -var="ec2_auto_start=true" -var="create_ec2_eip=true"
```

Or run the workflow manually with `nonlive_testing_mode=true` and approve the live steps.

## Troubleshooting

### Container crashes

Check logs:

```bash
aws ssm send-command \
  --instance-ids $LIVE_INSTANCE_ID \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["docker logs --tail 100 bball-app-user-service", "docker ps -a"]' \
  --region eu-west-3
```

### Incorrect environment variables

Recreate the .env file (repeat step 5 with corrected values).

### Health check fails

Verify that:

1. The container is running: `docker ps`
2. The Security Group allows traffic on port 3000
3. The .env file exists: `cat /opt/bball-app-user-service/.env`

## Important Notes

- ⚠️ **Always stop the live server when not in use** to avoid unnecessary costs
- 🔒 **Production environment** requires manual approval for each deployment
- 📊 **CloudWatch logs** are configured automatically
- 🔄 **Elastic IP** (if enabled) remains constant between restarts
- 🐳 **Docker restart policy**: `unless-stopped` - container restarts automatically if it crashes

## Production Environment Variables

| Variable                      | Live Value                                     | Description                          |
| ----------------------------- | ---------------------------------------------- | ------------------------------------ |
| `NODE_ENV`                    | `production`                                   | Production mode                      |
| `PORT`                        | `3000`                                         | Application port                     |
| `AWS_REGION`                  | `eu-west-3`                                    | AWS Region                           |
| `COGNITO_USER_POOL_ID`        | _Get in step 4_                                | Live Cognito pool                    |
| `COGNITO_CLIENT_ID`           | _Get in step 4_                                | Live Cognito client                  |
| `DYNAMODB_USERS_TABLE`        | `bball-app-user-service-users-live`            | DynamoDB table                       |
| `DYNAMODB_TEAMS_STATIC_TABLE` | `bball-app-data-consumption-teams-static-live` | DynamoDB table                       |
| `CACHE_TTL`                   | `300`                                          | Cache TTL (5 min)                    |
| `THROTTLE_TTL`                | `60`                                           | Rate limit TTL                       |
| `THROTTLE_LIMIT`              | `100`                                          | Requests/min limit                   |
| `CORS_ORIGIN`                 | `*`                                            | CORS origins (adjust for production) |

## Next Time

Once this initial setup is complete, future deployments only require:

1. Run workflow manually with `nonlive_testing_mode=true`
2. Approve "Provision Infrastructure (Live)" if needed
3. Approve "Deploy Live"
4. Approve "Create Release" (optional)

**You won't need to repeat steps 4-5!** The .env file will already be configured on the instance.
