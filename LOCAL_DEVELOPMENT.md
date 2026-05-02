# Local Development Setup

This guide explains how to run the Basketball App User Service locally with fully dockerized AWS services (DynamoDB and Cognito), allowing you to develop and test without incurring AWS costs.

## Prerequisites

- Docker and Docker Compose installed
- Node.js 24.x installed (for running scripts outside Docker)
- npm installed

## Architecture

The local development environment includes:

- **DynamoDB Local** - Amazon's official local DynamoDB on port 8000
- **DynamoDB Admin** - Web UI for managing local DynamoDB tables on port 8001
- **Cognito Local** - Local Cognito simulator on port 9229
- **Your App** - Running in dev mode with hot reload on port 3000

**Note**: The docker-compose.yml has two app services:

- `app` (profile: `prod`) - Production-like container, not used for local dev
- `app-dev` (profile: `local`) - Development container with hot reload and local AWS services

When you run `npm run local:up`, only the `local` profile services start, preventing port conflicts.

## Quick Start

### 1. Start Local Services

```bash
# Start all local infrastructure (DynamoDB, Cognito, DynamoDB Admin)
npm run local:up
```

This starts:

- DynamoDB Local at http://localhost:8000
- DynamoDB Admin UI at http://localhost:8001
- Cognito Local at http://localhost:9229

### 2. Initialize Database Tables

```bash
# Create local DynamoDB tables (only needed first time)
npm run local:init-db
```

This creates:

- `bball-app-user-service-users-local` table
- `bball-app-user-service-teams-local` table

### 3. Create Cognito User Pool and Client

Cognito Local doesn't auto-create user pools from config files. You need to create them via AWS CLI:

```bash
# Create user pool
aws cognito-idp create-user-pool \
  --pool-name BballAppLocal \
  --endpoint-url http://localhost:9229 \
  --region eu-west-3 \
  --no-sign-request
```

**Note the `Id` from the response** (e.g., `local_4A5w4n7o`)

```bash
# Create app client (replace <POOL_ID> with the ID from previous command)
aws cognito-idp create-user-pool-client \
  --user-pool-id <POOL_ID> \
  --client-name BballAppLocalClient \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --endpoint-url http://localhost:9229 \
  --region eu-west-3 \
  --no-sign-request
```

**Note the `ClientId` from the response** (e.g., `es2vqxd3d71gv1ud2lhxzthma`)

### 4. Update Environment Variables

Edit `.env.local` and update with your actual Cognito credentials:

```bash
COGNITO_USER_POOL_ID=<your-pool-id>
COGNITO_CLIENT_ID=<your-client-id>
```

### 5. Restart the Application

For the new credentials to take effect:

```bash
npm run local:down
npm run local:up
```

View logs to confirm startup:

```bash
npm run local:logs
```

Look for:

```
[DynamoDbService] Using local DynamoDB endpoint: http://dynamodb-local:8000
[CognitoService] Using local Cognito endpoint: http://cognito-local:9229
[NestApplication] Nest application successfully started
```

### 6. Access Services

- **Application**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/v1/health
- **DynamoDB Admin UI**: http://localhost:8001
- **Swagger API Docs**: http://localhost:3000/api (if configured)

## Environment Variables

The `.env.local` file is automatically loaded by the npm scripts and pre-configured for local development:

```bash
# Local endpoints
AWS_DYNAMODB_ENDPOINT=http://dynamodb-local:8000
AWS_COGNITO_ENDPOINT=http://cognito-local:9229

# Local Cognito credentials
COGNITO_USER_POOL_ID=local_XXXXXX
COGNITO_CLIENT_ID=local-client-id

# Local table names
DYNAMODB_USERS_TABLE=bball-app-user-service-users-local
DYNAMODB_TEAMS_TABLE=bball-app-user-service-teams-local
```

## Available Scripts

| Command                 | Description                            |
| ----------------------- | -------------------------------------- |
| `npm run local:up`      | Start all local services in background |
| `npm run local:down`    | Stop and remove all local services     |
| `npm run local:logs`    | View application logs                  |
| `npm run local:init-db` | Initialize DynamoDB tables             |
| `npm run local:dev`     | Start everything and follow logs       |

## Development Workflow

1. **Make code changes** - Files are hot-reloaded in the container
2. **Test endpoints** - Use Postman, curl, or Swagger UI
3. **Inspect database** - Use DynamoDB Admin at http://localhost:8001
4. **View logs** - Run `npm run local:logs`

## Troubleshooting & FAQ

### Cannot Access App on http://localhost:3000

**Symptom**: `Error: connect ECONNREFUSED 127.0.0.1:3000` or connection timeout

**Cause**: The container's ports aren't properly exposed to the host.

**Solution**:

```bash
# Check if port is exposed
docker ps | findstr bball-app-user-service-dev

# Should show: 0.0.0.0:3000->3000/tcp
# If it just shows: 3000/tcp (no mapping), restart:

npm run local:down
npm run local:up
```

### "App Client <id> not found" Error

**Symptom**: Registration or login fails with `ResourceNotFoundException: App Client <client-id> not found`

**Cause 1**: Cognito Local restarted but the app still has old credentials cached.

**Solution**:

```bash
npm run local:down
npm run local:up
```

**Cause 2**: The `.env.local` file has outdated Cognito credentials from a previous setup.

**Solution**:

1. Get the correct credentials:
   ```bash
   aws cognito-idp create-user-pool --pool-name BballAppLocal --endpoint-url http://localhost:9229 --region eu-west-3 --no-sign-request
   aws cognito-idp create-user-pool-client --user-pool-id <pool-id> --client-name BballAppLocalClient --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH --endpoint-url http://localhost:9229 --region eu-west-3 --no-sign-request
   ```
2. Update `.env.local` with the new `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID`
3. Fully restart:
   ```bash
   npm run local:down
   npm run local:up
   ```

### "The table does not have the specified index: email-index"

**Symptom**: `/users/me` endpoint fails with index missing error

**Cause**: DynamoDB tables were created without Global Secondary Indexes (GSI).

**Solution**:

```bash
# Delete and recreate tables
$env:AWS_ACCESS_KEY_ID='dummy'; $env:AWS_SECRET_ACCESS_KEY='dummy'
aws dynamodb delete-table --table-name bball-app-user-service-users-local --endpoint-url http://localhost:8000 --region eu-west-3
aws dynamodb delete-table --table-name bball-app-user-service-teams-local --endpoint-url http://localhost:8000 --region eu-west-3

# Or restart DynamoDB (clears all data)
docker restart dynamodb-local

# Recreate with proper indexes
npm run local:init-db
```

### 401 "Invalid or expired token" on Protected Endpoints

**Symptom**: All protected endpoints return 401 even with valid access token

**Cause**: The auth guard is trying to verify JWT against AWS Cognito's JWKS endpoint, but tokens are from Cognito Local.

**Solution**: The fix is already implemented in `src/common/guards/cognito-auth.guard.ts`:

```typescript
// Skip JWKS verification when using local Cognito
const isLocalCognito = !!process.env.AWS_COGNITO_ENDPOINT;

if (this.userPoolId && !isLocalCognito) {
  // Only initialize JWKS client for production
}
```

If still failing, restart the app to reload the guard:

```bash
docker restart bball-app-user-service-dev
```

### "ExpressionAttributeValues must not be empty" Error

**Symptom**: Database queries fail with DynamoDB validation error

**Cause**: The `/users/me` endpoint tried to query by email (which isn't in the access token), resulting in an empty query.

**Solution**: Already fixed - the endpoint now queries by `userId` (from `sub` claim) instead of email:

```typescript
// In users.controller.ts
const userId = user?.sub || user?.username;
return this.usersService.findOne(userId);
```

### "An account with this email already exists"

**Symptom**: Cannot register a new user even after clearing DynamoDB

**Cause**: User exists in Cognito Local, not just DynamoDB.

**Solution 1** - Use a different email:

```bash
POST http://localhost:3000/api/v1/auth/register
{
  "email": "newuser@example.com",  # Different email
  "name": "New User",
  "password": "Test123!@#"
}
```

**Solution 2** - Clear Cognito and start fresh:

```bash
npm run local:down
Remove-Item -Recurse -Force .cognito\db
npm run local:up

# Recreate Cognito pool and client (see step 3 in Quick Start)
# Update .env.local with new credentials
npm run local:down
npm run local:up
npm run local:init-db
```

### DynamoDB Tables Missing After Restart

**Symptom**: After stopping containers, tables are gone

**Cause**: DynamoDB Local runs in-memory by default. Data is lost on restart unless you use the `-sharedDb` flag with a volume.

**Current Setup**: The docker-compose uses `-sharedDb` but no volume, so data persists only while the container is running.

**Solution**:

```bash
# Reinitialize tables after each restart
npm run local:init-db
```

**To persist data across restarts**, add a volume in `docker-compose.yml`:

```yaml
dynamodb-local:
  volumes:
    - ./dynamodb-data:/home/dynamodblocal/data
  command: '-jar DynamoDBLocal.jar -sharedDb -dbPath /home/dynamodblocal/data'
```

### User Not Created in DynamoDB After Login

**Symptom**: Login succeeds but `/users/me` returns 404

**Cause**: The auto-create logic runs on login. Check logs for errors.

**Solution**:

```bash
# View logs to see if user creation failed
docker logs bball-app-user-service-dev --tail 50

# Manually verify user exists in Cognito
docker exec cognito-local cat /app/.cognito/db/<pool-id>.json

# Check DynamoDB
# Open http://localhost:8001 and select users table
```

If the user wasn't created automatically, there may be a code error. Check:

- `auth.service.ts` - login method should call `usersService.create()` on first login
- `users.service.ts` - create method should accept optional `userId` parameter

### Port Conflicts (8000, 8001, 9229, 3000)

**Symptom**: Container fails to start with "port is already allocated"

**Solution**:

```bash
# Find what's using the port (Windows PowerShell)
netstat -ano | findstr :3000

# Kill the process or change the port in docker-compose.yml
```

### Hot Reload Not Working

**Symptom**: Code changes don't reflect in the running app

**Cause**: Volume mounts may not be working correctly on Windows

**Solution**:

```bash
# Restart the container to pick up changes
docker restart bball-app-user-service-dev

# Or rebuild
npm run local:down
npm run local:up
```

### Missing node_modules in Container

**Symptom**: App fails to start with "Cannot find module" errors

**Cause**: The Dockerfile's builder stage didn't copy dependencies correctly

**Solution**:

```bash
# Rebuild containers
docker-compose --env-file .env.local --profile local build
npm run local:up
```

### How to Reset Everything

Complete clean slate:

```bash
# Stop all containers
npm run local:down

# Remove Cognito data
Remove-Item -Recurse -Force .cognito\db

# Remove DynamoDB data (if using volumes)
Remove-Item -Recurse -Force dynamodb-data

# Start fresh
npm run local:up

# Create Cognito pool + client
aws cognito-idp create-user-pool --pool-name BballAppLocal --endpoint-url http://localhost:9229 --region eu-west-3 --no-sign-request
# Note the pool ID

aws cognito-idp create-user-pool-client --user-pool-id <POOL_ID> --client-name BballAppLocalClient --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH --endpoint-url http://localhost:9229 --region eu-west-3 --no-sign-request
# Note the client ID

# Update .env.local with new credentials
# Restart to load new credentials
npm run local:down
npm run local:up

# Initialize database
npm run local:init-db
```

## Differences from Production

| Aspect           | Local                                            | Production (nonlive/live) |
| ---------------- | ------------------------------------------------ | ------------------------- |
| DynamoDB         | DynamoDB Local (in-memory)                       | AWS DynamoDB              |
| Cognito          | Cognito Local                                    | AWS Cognito               |
| Data Persistence | Lost on container restart (unless using volumes) | Persisted in AWS          |
| Table Names      | `*-local`                                        | `*-nonlive` or `*-live`   |
| Credentials      | Dummy                                            | AWS IAM role              |
| Cost             | Free                                             | Pay per use               |

## Code Behavior

The application automatically detects local mode by checking environment variables:

```typescript
// In DynamoDB service
const dynamoEndpoint = process.env.AWS_DYNAMODB_ENDPOINT;
if (dynamoEndpoint) {
  // Use local DynamoDB
} else {
  // Use AWS DynamoDB (production)
}
```

**Important**: When deployed to AWS (via GitHub Actions), these environment variables are **not set**, so the code automatically uses real AWS services. Local development is completely isolated from production.

## Next Steps

- Add seed data to local DynamoDB for testing
- Create Postman collection for local API testing
- Set up integration tests using local services
- Configure debugging in VS Code for the containerized app

## Resources

- [DynamoDB Local Documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html)
- [Cognito Local GitHub](https://github.com/jagregory/cognito-local)
- [DynamoDB Admin GitHub](https://github.com/aaronshaf/dynamodb-admin)
