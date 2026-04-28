import { Module } from '@nestjs/common';
import { DynamoDbService } from './dynamodb/dynamodb.service';
import { CognitoService } from './cognito/cognito.service';

@Module({
  providers: [DynamoDbService, CognitoService],
  exports: [DynamoDbService, CognitoService],
})
export class AwsModule {}
