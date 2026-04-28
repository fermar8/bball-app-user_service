import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { CognitoService } from '../aws/cognito/cognito.service';

const mockCognitoService = {
  signUp: jest.fn(),
  confirmSignUp: jest.fn(),
  signIn: jest.fn(),
  refreshToken: jest.fn(),
  forgotPassword: jest.fn(),
  confirmForgotPassword: jest.fn(),
  signOut: jest.fn(),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: CognitoService, useValue: mockCognitoService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('should register a user successfully', async () => {
      mockCognitoService.signUp.mockResolvedValue({ userSub: 'test-sub-123' });

      const result = await service.register({
        email: 'test@example.com',
        password: 'Password123!',
        name: 'Test User',
      });

      expect(result.userSub).toBe('test-sub-123');
      expect(result.message).toContain('confirmation code');
      expect(mockCognitoService.signUp).toHaveBeenCalledWith(
        'test@example.com',
        'Password123!',
        'Test User',
      );
    });

    it('should throw ConflictException when user already exists', async () => {
      const error = new Error('User already exists');
      error.name = 'UsernameExistsException';
      mockCognitoService.signUp.mockRejectedValue(error);

      await expect(
        service.register({
          email: 'existing@example.com',
          password: 'Password123!',
          name: 'Test',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for invalid password', async () => {
      const error = new Error('Password policy violation');
      error.name = 'InvalidPasswordException';
      mockCognitoService.signUp.mockRejectedValue(error);

      await expect(
        service.register({
          email: 'test@example.com',
          password: 'weak',
          name: 'Test',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('login', () => {
    it('should return tokens on successful login', async () => {
      const tokens = {
        accessToken: 'access-token',
        idToken: 'id-token',
        refreshToken: 'refresh-token',
        expiresIn: 3600,
      };
      mockCognitoService.signIn.mockResolvedValue(tokens);

      const result = await service.login({
        email: 'test@example.com',
        password: 'Password123!',
      });

      expect(result).toEqual(tokens);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const error = new Error('Incorrect username or password');
      error.name = 'NotAuthorizedException';
      mockCognitoService.signIn.mockRejectedValue(error);

      await expect(
        service.login({ email: 'test@example.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      const error = new Error('User does not exist');
      error.name = 'UserNotFoundException';
      mockCognitoService.signIn.mockRejectedValue(error);

      await expect(
        service.login({
          email: 'unknown@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user not confirmed', async () => {
      const error = new Error('User is not confirmed');
      error.name = 'UserNotConfirmedException';
      mockCognitoService.signIn.mockRejectedValue(error);

      await expect(
        service.login({
          email: 'unconfirmed@example.com',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('confirmRegistration', () => {
    it('should confirm registration successfully', async () => {
      mockCognitoService.confirmSignUp.mockResolvedValue(undefined);

      const result = await service.confirmRegistration({
        email: 'test@example.com',
        confirmationCode: '123456',
      });

      expect(result.message).toContain('confirmed');
    });

    it('should throw BadRequestException for wrong code', async () => {
      const error = new Error('Invalid code');
      error.name = 'CodeMismatchException';
      mockCognitoService.confirmSignUp.mockRejectedValue(error);

      await expect(
        service.confirmRegistration({
          email: 'test@example.com',
          confirmationCode: '000000',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('forgotPassword', () => {
    it('should return generic message regardless of outcome', async () => {
      mockCognitoService.forgotPassword.mockResolvedValue(undefined);
      const result = await service.forgotPassword({
        email: 'test@example.com',
      });
      expect(result.message).toBeDefined();
    });

    it('should return generic message even on error (email enumeration protection)', async () => {
      mockCognitoService.forgotPassword.mockRejectedValue(
        new Error('User not found'),
      );
      const result = await service.forgotPassword({
        email: 'nonexistent@example.com',
      });
      expect(result.message).toBeDefined();
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      mockCognitoService.signOut.mockResolvedValue(undefined);
      const result = await service.logout('valid-access-token');
      expect(result.message).toContain('Logged out');
    });
  });
});
