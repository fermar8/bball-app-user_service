import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DynamoDbService } from '../aws/dynamodb/dynamodb.service';
import { TeamQueryDto } from './dto/team-query.dto';

export interface Team {
  teamId: number;
  name?: string;
}

@Injectable()
export class TeamsService {
  private readonly logger = new Logger(TeamsService.name);
  private readonly tableName: string;

  constructor(
    private readonly dynamoDbService: DynamoDbService,
    private readonly configService: ConfigService,
  ) {
    this.tableName = this.configService.get<string>(
      'aws.dynamodb.teamsStaticTable',
    );
  }

  async findAll(query?: TeamQueryDto): Promise<Team[]> {
    const items = await this.dynamoDbService.scan({
      TableName: this.tableName,
    });
    let teams = items as Team[];

    if (query?.name) {
      teams = teams.filter((t) =>
        t.name?.toLowerCase().includes(query.name.toLowerCase()),
      );
    }

    return teams;
  }

  async findOne(teamId: number): Promise<Team> {
    const item = await this.dynamoDbService.getItem({
      TableName: this.tableName,
      Key: { teamId },
    });

    if (!item) {
      throw new NotFoundException(`Team with ID ${teamId} not found`);
    }

    return item as Team;
  }
}
