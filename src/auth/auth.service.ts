import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  CodeMismatchException,
  ExpiredCodeException,
  InvalidPasswordException,
  NotAuthorizedException,
  UserNotConfirmedException,
  UserNotFoundException,
  UsernameExistsException,
} from '@aws-sdk/client-cognito-identity-provider';
import { CognitoService } from '../aws/cognito/cognito.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfirmRegistrationDto } from './dto/confirm-registration.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ConfirmForgotPasswordDto } from './dto/confirm-forgot-password.dto';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly cognitoService: CognitoService,
    private readonly usersService: UsersService,
  ) {}

  private isCognitoError(error: unknown, errorName: string): boolean {
    return (
      error instanceof Error &&
      (error.name === errorName || error.constructor?.name === errorName)
    );
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }

  async register(
    dto: RegisterDto,
  ): Promise<{ message: string; userSub: string }> {
    try {
      const result = await this.cognitoService.signUp(
        dto.email,
        dto.password,
        dto.name,
      );
      return {
        message:
          'Registration successful. Please check your email for the confirmation code.',
        userSub: result.userSub,
      };
    } catch (error: unknown) {
      if (
        error instanceof UsernameExistsException ||
        this.isCognitoError(error, 'UsernameExistsException')
      ) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      if (
        error instanceof InvalidPasswordException ||
        this.isCognitoError(error, 'InvalidPasswordException')
      ) {
        throw new BadRequestException(
          this.getErrorMessage(error, 'Invalid password'),
        );
      }
      if (error instanceof Error) {
        this.logger.error(`Registration error: ${error.message}`, error.stack);
      } else {
        this.logger.error(`Registration error: ${String(error)}`);
      }
      throw error;
    }
  }

  async confirmRegistration(
    dto: ConfirmRegistrationDto,
  ): Promise<{ message: string }> {
    try {
      await this.cognitoService.confirmSignUp(dto.email, dto.confirmationCode);
      return {
        message: 'Account confirmed successfully. You can now sign in.',
      };
    } catch (error: unknown) {
      if (
        error instanceof CodeMismatchException ||
        this.isCognitoError(error, 'CodeMismatchException')
      ) {
        throw new BadRequestException('Invalid confirmation code');
      }
      if (
        error instanceof ExpiredCodeException ||
        this.isCognitoError(error, 'ExpiredCodeException')
      ) {
        throw new BadRequestException('Confirmation code has expired');
      }
      if (error instanceof Error) {
        this.logger.error(
          `Confirm registration error: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Confirm registration error: ${String(error)}`);
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    idToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    try {
      const tokens = await this.cognitoService.signIn(dto.email, dto.password);

      // Create user in DynamoDB on first login if doesn't exist
      const decoded = jwt.decode(tokens.idToken) as any;
      if (decoded?.sub) {
        try {
          await this.usersService.findOne(decoded.sub);
        } catch {
          // User doesn't exist in DynamoDB, create it
          await this.usersService.create(
            {
              email: decoded.email || dto.email,
              name: decoded.name || 'User',
            },
            decoded.sub,
          );
          this.logger.log(`Created DynamoDB user record for ${decoded.sub}`);
        }
      }

      return tokens;
    } catch (error: unknown) {
      if (
        error instanceof NotAuthorizedException ||
        error instanceof UserNotFoundException ||
        this.isCognitoError(error, 'NotAuthorizedException') ||
        this.isCognitoError(error, 'UserNotFoundException')
      ) {
        throw new UnauthorizedException('Invalid email or password');
      }
      if (
        error instanceof UserNotConfirmedException ||
        this.isCognitoError(error, 'UserNotConfirmedException')
      ) {
        throw new UnauthorizedException(
          'Please confirm your email address before signing in',
        );
      }
      if (error instanceof Error) {
        this.logger.error(`Login error: ${error.message}`, error.stack);
      } else {
        this.logger.error(`Login error: ${String(error)}`);
      }
      throw error;
    }
  }

  async refreshToken(dto: RefreshTokenDto): Promise<{
    accessToken: string;
    idToken: string;
    expiresIn: number;
  }> {
    try {
      return await this.cognitoService.refreshToken(dto.refreshToken);
    } catch (error: unknown) {
      if (
        error instanceof NotAuthorizedException ||
        this.isCognitoError(error, 'NotAuthorizedException')
      ) {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
      if (error instanceof Error) {
        this.logger.error(`Refresh token error: ${error.message}`, error.stack);
      } else {
        this.logger.error(`Refresh token error: ${String(error)}`);
      }
      throw error;
    }
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    try {
      await this.cognitoService.forgotPassword(dto.email);
      return {
        message:
          'If an account with this email exists, a password reset code has been sent.',
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Forgot password error: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Forgot password error: ${String(error)}`);
      }
      // Return generic message to avoid email enumeration
      return {
        message:
          'If an account with this email exists, a password reset code has been sent.',
      };
    }
  }

  async confirmForgotPassword(
    dto: ConfirmForgotPasswordDto,
  ): Promise<{ message: string }> {
    try {
      await this.cognitoService.confirmForgotPassword(
        dto.email,
        dto.confirmationCode,
        dto.newPassword,
      );
      return {
        message:
          'Password reset successfully. You can now sign in with your new password.',
      };
    } catch (error: unknown) {
      if (
        error instanceof CodeMismatchException ||
        this.isCognitoError(error, 'CodeMismatchException')
      ) {
        throw new BadRequestException('Invalid confirmation code');
      }
      if (
        error instanceof ExpiredCodeException ||
        this.isCognitoError(error, 'ExpiredCodeException')
      ) {
        throw new BadRequestException('Confirmation code has expired');
      }
      if (error instanceof Error) {
        this.logger.error(
          `Confirm forgot password error: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Confirm forgot password error: ${String(error)}`);
      }
      throw error;
    }
  }

  async logout(accessToken: string): Promise<{ message: string }> {
    try {
      await this.cognitoService.signOut(accessToken);
      return { message: 'Logged out successfully' };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(`Logout error: ${error.message}`, error.stack);
      } else {
        this.logger.error(`Logout error: ${String(error)}`);
      }
      throw error;
    }
  }
}
