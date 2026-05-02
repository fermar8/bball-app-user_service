export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  aws: {
    region: process.env.AWS_REGION || 'eu-west-3',
    cognito: {
      userPoolId: process.env.COGNITO_USER_POOL_ID || '',
      clientId: process.env.COGNITO_CLIENT_ID || '',
    },
    dynamodb: {
      usersTable:
        process.env.DYNAMODB_USERS_TABLE ||
        'bball-app-user-service-users-nonlive',
      teamsTable:
        process.env.DYNAMODB_TEAMS_TABLE ||
        'bball-app-user-service-teams-nonlive',
    },
  },
  cache: {
    ttl: parseInt(process.env.CACHE_TTL, 10) || 60,
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL, 10) || 60,
    limit: parseInt(process.env.THROTTLE_LIMIT, 10) || 100,
  },
});
