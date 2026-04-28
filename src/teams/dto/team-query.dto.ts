import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class TeamQueryDto {
  @ApiPropertyOptional({
    example: 'Lakers',
    description: 'Filter teams by name',
  })
  @IsOptional()
  @IsString()
  name?: string;
}
