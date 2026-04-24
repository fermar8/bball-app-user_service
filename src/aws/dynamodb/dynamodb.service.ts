import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
  QueryCommand,
  GetCommandInput,
  PutCommandInput,
  UpdateCommandInput,
  DeleteCommandInput,
  ScanCommandInput,
  QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';

@Injectable()
export class DynamoDbService {
  private readonly logger = new Logger(DynamoDbService.name);
  private readonly docClient: DynamoDBDocumentClient;

  constructor(private readonly configService: ConfigService) {
    const client = new DynamoDBClient({
      region: this.configService.get<string>('aws.region'),
    });
    this.docClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: {
        removeUndefinedValues: true,
        convertEmptyValues: false,
      },
    });
  }

  async getItem(params: GetCommandInput): Promise<Record<string, any> | null> {
    try {
      const result = await this.docClient.send(new GetCommand(params));
      return result.Item || null;
    } catch (error) {
      this.logger.error(`DynamoDB getItem error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async putItem(params: PutCommandInput): Promise<void> {
    try {
      await this.docClient.send(new PutCommand(params));
    } catch (error) {
      this.logger.error(`DynamoDB putItem error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async updateItem(params: UpdateCommandInput): Promise<Record<string, any>> {
    try {
      const result = await this.docClient.send(new UpdateCommand(params));
      return result.Attributes || {};
    } catch (error) {
      this.logger.error(`DynamoDB updateItem error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async deleteItem(params: DeleteCommandInput): Promise<void> {
    try {
      await this.docClient.send(new DeleteCommand(params));
    } catch (error) {
      this.logger.error(`DynamoDB deleteItem error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async scan(params: ScanCommandInput): Promise<Record<string, any>[]> {
    try {
      const result = await this.docClient.send(new ScanCommand(params));
      return result.Items || [];
    } catch (error) {
      this.logger.error(`DynamoDB scan error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async query(params: QueryCommandInput): Promise<Record<string, any>[]> {
    try {
      const result = await this.docClient.send(new QueryCommand(params));
      return result.Items || [];
    } catch (error) {
      this.logger.error(`DynamoDB query error: ${error.message}`, error.stack);
      throw error;
    }
  }
}
