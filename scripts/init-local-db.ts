import {
  DynamoDBClient,
  CreateTableCommand,
  ListTablesCommand,
} from '@aws-sdk/client-dynamodb';

const DYNAMODB_ENDPOINT =
  process.env.AWS_DYNAMODB_ENDPOINT || 'http://localhost:8000';
const AWS_REGION = process.env.AWS_REGION || 'eu-west-3';

const client = new DynamoDBClient({
  region: AWS_REGION,
  endpoint: DYNAMODB_ENDPOINT,
  credentials: {
    accessKeyId: 'dummy',
    secretAccessKey: 'dummy',
  },
});

const TABLES_CONFIG = [
  {
    tableName: 'bball-app-user-service-users-local',
    keySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    attributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: 'email-index',
        KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
  {
    tableName: 'bball-app-user-service-teams-local',
    keySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    attributeDefinitions: [
      { AttributeName: 'id', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
    ],
    globalSecondaryIndexes: [
      {
        IndexName: 'userId-index',
        KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
      },
    ],
  },
];

async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await client.send(new ListTablesCommand({}));
    return result.TableNames?.includes(tableName) || false;
  } catch (error) {
    console.error('Error checking for existing tables:', error);
    return false;
  }
}

async function createTable(config: {
  tableName: string;
  keySchema: any[];
  attributeDefinitions: any[];
  globalSecondaryIndexes?: any[];
}): Promise<void> {
  const exists = await tableExists(config.tableName);

  if (exists) {
    console.log(`✅ Table '${config.tableName}' already exists, skipping...`);
    return;
  }

  try {
    const params: any = {
      TableName: config.tableName,
      KeySchema: config.keySchema,
      AttributeDefinitions: config.attributeDefinitions,
      BillingMode: 'PAY_PER_REQUEST',
    };

    if (config.globalSecondaryIndexes) {
      params.GlobalSecondaryIndexes = config.globalSecondaryIndexes;
    }

    await client.send(new CreateTableCommand(params));
    console.log(`✅ Created table: ${config.tableName}`);
  } catch (error) {
    console.error(`❌ Error creating table ${config.tableName}:`, error);
    throw error;
  }
}

async function initializeLocalDatabase(): Promise<void> {
  console.log('🚀 Initializing local DynamoDB tables...');
  console.log(`   Endpoint: ${DYNAMODB_ENDPOINT}`);
  console.log(`   Region: ${AWS_REGION}\n`);

  try {
    for (const tableConfig of TABLES_CONFIG) {
      await createTable(tableConfig);
    }
    console.log('\n✅ Local DynamoDB initialization complete!');
    console.log('\n📊 Access DynamoDB Admin at: http://localhost:8001');
  } catch (error) {
    console.error('\n❌ Failed to initialize local DynamoDB:', error);
    process.exit(1);
  }
}

initializeLocalDatabase();
