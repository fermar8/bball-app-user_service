import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from './users.service';
import { DynamoDbService } from '../aws/dynamodb/dynamodb.service';

const mockDynamoDbService = {
  scan: jest.fn(),
  getItem: jest.fn(),
  query: jest.fn(),
  putItem: jest.fn(),
  updateItem: jest.fn(),
  deleteItem: jest.fn(),
};

const mockConfigService = {
  get: jest.fn().mockReturnValue('bball-app-user-service-users-test'),
};

const mockUser = {
  userId: 'test-uuid-123',
  email: 'test@example.com',
  name: 'Test User',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: DynamoDbService, useValue: mockDynamoDbService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      mockDynamoDbService.scan.mockResolvedValue([mockUser]);
      const result = await service.findAll();
      expect(result).toEqual([mockUser]);
      expect(mockDynamoDbService.scan).toHaveBeenCalledWith({
        TableName: 'bball-app-user-service-users-test',
      });
    });

    it('should return empty array when no users exist', async () => {
      mockDynamoDbService.scan.mockResolvedValue([]);
      const result = await service.findAll();
      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return a user by ID', async () => {
      mockDynamoDbService.getItem.mockResolvedValue(mockUser);
      const result = await service.findOne('test-uuid-123');
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException when user not found', async () => {
      mockDynamoDbService.getItem.mockResolvedValue(null);
      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a new user', async () => {
      mockDynamoDbService.query.mockResolvedValue([]);
      mockDynamoDbService.putItem.mockResolvedValue(undefined);

      const result = await service.create({
        email: 'new@example.com',
        name: 'New User',
      });

      expect(result.email).toBe('new@example.com');
      expect(result.name).toBe('New User');
      expect(result.userId).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    it('should throw ConflictException when email already exists', async () => {
      mockDynamoDbService.query.mockResolvedValue([mockUser]);

      await expect(
        service.create({ email: 'test@example.com', name: 'Test User' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update a user', async () => {
      mockDynamoDbService.getItem.mockResolvedValue(mockUser);
      const updatedUser = { ...mockUser, name: 'Updated Name' };
      mockDynamoDbService.updateItem.mockResolvedValue(updatedUser);

      const result = await service.update('test-uuid-123', {
        name: 'Updated Name',
      });
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException when user to update does not exist', async () => {
      mockDynamoDbService.getItem.mockResolvedValue(null);
      await expect(
        service.update('nonexistent-id', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete a user', async () => {
      mockDynamoDbService.getItem.mockResolvedValue(mockUser);
      mockDynamoDbService.deleteItem.mockResolvedValue(undefined);

      await expect(service.remove('test-uuid-123')).resolves.not.toThrow();
      expect(mockDynamoDbService.deleteItem).toHaveBeenCalledWith({
        TableName: 'bball-app-user-service-users-test',
        Key: { userId: 'test-uuid-123' },
      });
    });

    it('should throw NotFoundException when user to delete does not exist', async () => {
      mockDynamoDbService.getItem.mockResolvedValue(null);
      await expect(service.remove('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
