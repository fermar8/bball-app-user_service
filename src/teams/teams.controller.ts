import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CacheInterceptor } from '@nestjs/cache-manager';
import { TeamsService } from './teams.service';
import { TeamQueryDto } from './dto/team-query.dto';
import { CognitoAuthGuard } from '../common/guards/cognito-auth.guard';

@ApiTags('teams')
@ApiBearerAuth('cognito-jwt')
@UseGuards(CognitoAuthGuard)
@UseInterceptors(CacheInterceptor)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all teams' })
  @ApiResponse({ status: 200, description: 'List of teams' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiQuery({
    name: 'name',
    required: false,
    description: 'Filter by team name',
  })
  findAll(@Query() query: TeamQueryDto) {
    return this.teamsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a team by ID' })
  @ApiParam({ name: 'id', description: 'Team ID (numeric)' })
  @ApiResponse({ status: 200, description: 'Team found' })
  @ApiResponse({ status: 404, description: 'Team not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.teamsService.findOne(id);
  }
}
