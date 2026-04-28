import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TeamsService } from './teams.service';
import { DynamoDbService } from '../aws/dynamodb/dynamodb.service';

const mockDynamoDbService = {
  scan: jest.fn(),
  getItem: jest.fn(),
};

const mockConfigService = {
  get: jest
    .fn()
    .mockReturnValue('bball-app-data-consumption-teams-static-test'),
};

const mockTeams = [
  { teamId: 1, name: 'Maccabi De Levantar' },
  { teamId: 2, name: 'Los wenos' },
];

describe('TeamsService', () => {
  let service: TeamsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: DynamoDbService, useValue: mockDynamoDbService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<TeamsService>(TeamsService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all teams', async () => {
      mockDynamoDbService.scan.mockResolvedValue(mockTeams);
      const result = await service.findAll();
      expect(result).toEqual(mockTeams);
    });

    it('should filter by team name (case-insensitive)', async () => {
      mockDynamoDbService.scan.mockResolvedValue(mockTeams);
      const result = await service.findAll({ name: 'maccabi' });
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Maccabi De Levantar');
    });

    it('should return empty array when no teams match filter', async () => {
      mockDynamoDbService.scan.mockResolvedValue(mockTeams);
      const result = await service.findAll({ name: 'nonexistent' });
      expect(result).toHaveLength(0);
    });
  });

  describe('findOne', () => {
    it('should return a team by ID', async () => {
      mockDynamoDbService.getItem.mockResolvedValue(mockTeams[0]);
      const result = await service.findOne(1);
      expect(result).toEqual(mockTeams[0]);
    });

    it('should throw NotFoundException when team not found', async () => {
      mockDynamoDbService.getItem.mockResolvedValue(null);
      await expect(service.findOne(9999)).rejects.toThrow(NotFoundException);
    });
  });
});
