import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { DynamoDbService } from '../aws/dynamodb/dynamodb.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

export interface User {
  userId: string;
  email: string;
  name: string;
  city?: string;
  favoriteTeam?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly tableName: string;

  constructor(
    private readonly dynamoDbService: DynamoDbService,
    private readonly configService: ConfigService,
  ) {
    this.tableName = this.configService.get<string>('aws.dynamodb.usersTable');
  }

  async findAll(): Promise<User[]> {
    const items = await this.dynamoDbService.scan({
      TableName: this.tableName,
    });
    return items as User[];
  }

  async findOne(userId: string): Promise<User> {
    const item = await this.dynamoDbService.getItem({
      TableName: this.tableName,
      Key: { userId },
    });

    if (!item) {
      throw new NotFoundException(`User with ID ${userId} not found`);
    }

    return item as User;
  }

  async findByEmail(email: string): Promise<User | null> {
    const items = await this.dynamoDbService.query({
      TableName: this.tableName,
      IndexName: 'email-index',
      KeyConditionExpression: 'email = :email',
      ExpressionAttributeValues: { ':email': email },
    });

    return items.length > 0 ? (items[0] as User) : null;
  }

  async create(dto: CreateUserDto, userId?: string): Promise<User> {
    const existing = await this.findByEmail(dto.email).catch(() => null);
    if (existing) {
      throw new ConflictException(
        `User with email ${dto.email} already exists`,
      );
    }

    const now = new Date().toISOString();
    const user: User = {
      userId: userId || crypto.randomUUID(),
      ...dto,
      createdAt: now,
      updatedAt: now,
    };

    await this.dynamoDbService.putItem({
      TableName: this.tableName,
      Item: user,
      ConditionExpression: 'attribute_not_exists(userId)',
    });

    return user;
  }

  async update(userId: string, dto: UpdateUserDto): Promise<User> {
    await this.findOne(userId);

    const updateExpressions: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    Object.entries(dto).forEach(([key, value]) => {
      if (value !== undefined) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = value;
      }
    });

    updateExpressions.push('#updatedAt = :updatedAt');
    expressionAttributeNames['#updatedAt'] = 'updatedAt';
    expressionAttributeValues[':updatedAt'] = new Date().toISOString();

    const result = await this.dynamoDbService.updateItem({
      TableName: this.tableName,
      Key: { userId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW',
    });

    return result as User;
  }

  async remove(userId: string): Promise<void> {
    await this.findOne(userId);
    await this.dynamoDbService.deleteItem({
      TableName: this.tableName,
      Key: { userId },
    });
  }
}
