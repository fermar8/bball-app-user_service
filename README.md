# bball-app-user_service

Basketball app user service — REST API built with **NestJS** and **Fastify**, deployed on **EC2** with **PM2**, managed with **Terraform**, and shipped via **GitHub Actions**.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Local Development](#local-development)
- [Environment Variables](#environment-variables)
- [Infrastructure (Terraform)](#infrastructure-terraform)
- [CI/CD (GitHub Actions)](#cicd-github-actions)
- [GitHub Actions Variables & Secrets](#github-actions-variables--secrets)
- [Architecture](#architecture)

---

## Overview

This service manages user authentication and profiles for the Basketball App. It integrates with:

- **AWS Cognito** — user registration, login, and JWT issuance
- **DynamoDB** — user profile storage (`bball-app-user-service-users-<env>`)
- **DynamoDB** — user teams storage (`bball-app-user-service-teams-<env>`)
- **CloudWatch** — structured application logs and metrics

---

## Tech Stack

| Layer           | Technology                  |
| --------------- | --------------------------- |
| Runtime         | Node.js 24                  |
| Framework       | NestJS + Fastify            |
| Process Manager | PM2                         |
| Compute         | AWS EC2 (Amazon Linux 2023) |
| Auth            | AWS Cognito                 |
| Database        | AWS DynamoDB                |
| IaC             | Terraform >= 1.0            |
| CI/CD           | GitHub Actions              |
| Region          | eu-west-3 (Paris)           |

---

## Local Development

```bash
# Install dependencies
npm ci

# Start in watch mode
npm run start:dev

# Lint
npm run lint

# Unit tests
npm test

# E2E tests
npm run test:e2e

# Build
npm run build
```

---

## Environment Variables

| Variable                      | Description                    | Example                                           |
| ----------------------------- | ------------------------------ | ------------------------------------------------- |
| `NODE_ENV`                    | Environment                    | `nonlive` / `live`                                |
| `PORT`                        | Application port               | `3000`                                            |
| `AWS_REGION`                  | AWS region                     | `eu-west-3`                                       |
| `COGNITO_USER_POOL_ID`        | Cognito User Pool ID           | `eu-west-3_abc123`                                |
| `COGNITO_CLIENT_ID`           | Cognito App Client ID          | `abc123xyz`                                       |
| `DYNAMODB_USERS_TABLE`        | DynamoDB users table name      | `bball-app-user-service-users-nonlive`            |
| `DYNAMODB_TEAMS_TABLE`        | DynamoDB user teams table name | `bball-app-user-service-teams-nonlive`            |
| `CACHE_TTL`                   | Cache TTL in seconds           | `60`                                              |
| `THROTTLE_TTL`                | Rate-limit window in seconds   | `60`                                              |
| `THROTTLE_LIMIT`              | Max requests per window        | `100`                                             |

These are written automatically by Terraform's `user_data.sh` on first boot.

---

## Infrastructure (Terraform)

All infrastructure is defined under `terraform/resources/`.

### Resources provisioned

| Resource                              | Purpose                                            |
| ------------------------------------- | -------------------------------------------------- |
| VPC + Subnet + IGW                    | Isolated network for the service                   |
| Security Group                        | Allows app port (3000) inbound; all outbound       |
| EC2 (Amazon Linux 2023)               | Runs the NestJS app via PM2 (stopped by default)   |
| Elastic IP (optional)                 | Stable public IP — only allocated when testing     |
| IAM Role + Instance Profile           | Grants EC2 access to DynamoDB, CloudWatch, SSM     |
| Cognito User Pool + Client            | User auth (registration, login, token refresh)     |
| DynamoDB Table (`users`)              | User profile storage with `email-index` GSI        |
| CloudWatch Log Group                  | Application logs (`/bball-app/user-service/<env>`) |
| CloudWatch Alarms (live only)         | High CPU + application error rate alerts           |
| SNS Topic + Subscriptions (live only) | Email notifications for alarms                     |
| SSM Parameter                         | CloudWatch agent configuration                     |

### Deploy

```bash
cd terraform/resources

# Initialise with remote state (nonlive)
terraform init -backend-config=backend.hcl

# Plan
terraform plan -var-file="nonlive.tfvars"

# Apply
terraform apply -var-file="nonlive.tfvars"
```

Use `live.tfvars` for the production environment.

### EC2 lifecycle

#### How the instance is bootstrapped

When EC2 is first created by Terraform, AWS automatically runs `terraform/resources/user_data.sh` on boot. This script:

1. Updates the OS packages
2. Installs **Node.js 24** via nvm with system-wide symlinks
3. Installs **PM2** globally (process manager used by the deploy script)
4. Installs and starts the **CloudWatch agent**
5. Creates `/opt/bball-app-user-service/` and writes a `.env` file with runtime config (Cognito IDs, DynamoDB table names, etc.) populated from Terraform variables

This only runs **once** — on first boot after `terraform apply` creates the instance. After that, the app is deployed and updated exclusively via the GitHub Actions pipeline.

#### Cost-control toggles

Both environments default to **stopped EC2 and no Elastic IP** to avoid idle charges. AWS charges ~$0.005/hour for an unattached EIP and ~$0.0116/hour for a running `t3.micro`.

| Variable         | Default | Effect when `true`                             |
| ---------------- | ------- | ---------------------------------------------- |
| `ec2_auto_start` | `false` | EC2 is started after `terraform apply`         |
| `create_ec2_eip` | `false` | An Elastic IP is allocated and attached to EC2 |

When `create_ec2_eip = false`, the `ec2_public_ip` output falls back to the instance's ephemeral public IP (changes on every start), and `api_endpoint` reflects that. Use EIP only when you need a stable address across stop/start cycles.

#### First-time provisioning

```bash
cd terraform/resources

# Initialise with remote state
terraform init -backend-config=backend.hcl

# Provision infrastructure (EC2 created but stopped, no EIP)
terraform apply -var-file="nonlive.tfvars"
```

After this, `user_data.sh` runs automatically on first boot. You don't need to do anything — the instance bootstraps itself.

#### Start testing (EC2 running + stable EIP)

**Option A — pipeline (recommended)**

Go to GitHub Actions → `Main CI - Build, Test, Deploy, and Release` → **Run workflow** and enable `nonlive_testing_mode`.

This runs Terraform with both toggles set to `true` and then deploys the app.

**Option B — Terraform CLI only**

```bash
cd terraform/resources

terraform apply -var-file="nonlive.tfvars" \
  -var="ec2_auto_start=true" \
  -var="create_ec2_eip=true"
```

The instance starts and gets a stable EIP. Deploy the app separately via the pipeline or manually.

#### Stop testing (release EIP + stop EC2)

**Option A — pipeline**

Re-run the workflow with `nonlive_testing_mode` **unchecked** (default).

**Option B — Terraform CLI**

```bash
cd terraform/resources

terraform apply -var-file="nonlive.tfvars" \
  -var="ec2_auto_start=false" \
  -var="create_ec2_eip=false"
```

The EIP is released (billing stops immediately) and the instance is stopped.

> Replace `nonlive.tfvars` with `live.tfvars` for the production environment.

### State backend

| Setting     | Value                                              |
| ----------- | -------------------------------------------------- |
| Bucket      | `tfstate-590183661886-eu-west-3`                   |
| Nonlive key | `resources/nonlive/bball-app-user-service.tfstate` |
| Live key    | `resources/live/bball-app-user-service.tfstate`    |
| Lock table  | `terraform-state-lock`                             |
| Region      | `eu-west-3`                                        |

---

## CI/CD (GitHub Actions)

### `branches.yml` — Branch CI

Triggered on every push/PR to non-`main` branches.

1. Install → Lint → Test (unit + e2e) → Build
2. Terraform Init → Validate → **Plan** (nonlive)

### `main.yml` — Main CI/CD

Triggered on push to `main` or manual dispatch.

| Job              | Description                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `build-and-test` | Install, lint, test, build; uploads `dist/` artifact                                             |
| `deploy-nonlive` | Terraform apply (nonlive) + deploy to nonlive EC2 via SSM                                        |
| `deploy-live`    | Terraform apply (live) + deploy to live EC2 via SSM (requires `production` environment approval) |
| `create-release` | Auto-increments patch version, creates GitHub Release with ZIP artifact                          |

Application deployment uses **AWS SSM Run Command** — no SSH keys required in the pipeline.

---

## GitHub Actions Variables & Secrets

### Repository Variables (`vars.*`)

| Variable                | Description                                |
| ----------------------- | ------------------------------------------ |
| `AWS_PIPELINE_ROLE_ARN` | IAM role ARN for OIDC authentication       |
| `AWS_REGION`            | AWS region (defaults to `eu-west-3`)       |
| `TF_STATE_BUCKET`       | S3 bucket for Terraform state              |
| `TF_LOCK_TABLE`         | DynamoDB table for Terraform state locking |
| `DEPLOYMENT_BUCKET`     | S3 bucket for deployment packages          |

### Repository Secrets (`secrets.*`)

| Secret         | Description                                                            |
| -------------- | ---------------------------------------------------------------------- |
| `ALARM_EMAILS` | JSON array of emails for CloudWatch alarms, e.g. `["ops@example.com"]` |
