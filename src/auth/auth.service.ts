import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CognitoService } from '../aws/cognito/cognito.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ConfirmRegistrationDto } from './dto/confirm-registration.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ConfirmForgotPasswordDto } from './dto/confirm-forgot-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly cognitoService: CognitoService) {}

  async register(dto: RegisterDto): Promise<{ message: string; userSub: string }> {
    try {
      const result = await this.cognitoService.signUp(dto.email, dto.password, dto.name);
      return {
        message: 'Registration successful. Please check your email for the confirmation code.',
        userSub: result.userSub,
      };
    } catch (error) {
      if (error.name === 'UsernameExistsException') {
        throw new ConflictException('An account with this email already exists');
      }
      if (error.name === 'InvalidPasswordException') {
        throw new BadRequestException(error.message);
      }
      this.logger.error(`Registration error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async confirmRegistration(dto: ConfirmRegistrationDto): Promise<{ message: string }> {
    try {
      await this.cognitoService.confirmSignUp(dto.email, dto.confirmationCode);
      return { message: 'Account confirmed successfully. You can now sign in.' };
    } catch (error) {
      if (error.name === 'CodeMismatchException') {
        throw new BadRequestException('Invalid confirmation code');
      }
      if (error.name === 'ExpiredCodeException') {
        throw new BadRequestException('Confirmation code has expired');
      }
      this.logger.error(`Confirm registration error: ${error.message}`, error.stack);
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
      return await this.cognitoService.signIn(dto.email, dto.password);
    } catch (error) {
      if (
        error.name === 'NotAuthorizedException' ||
        error.name === 'UserNotFoundException'
      ) {
        throw new UnauthorizedException('Invalid email or password');
      }
      if (error.name === 'UserNotConfirmedException') {
        throw new UnauthorizedException('Please confirm your email address before signing in');
      }
      this.logger.error(`Login error: ${error.message}`, error.stack);
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
    } catch (error) {
      if (error.name === 'NotAuthorizedException') {
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
      this.logger.error(`Refresh token error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    try {
      await this.cognitoService.forgotPassword(dto.email);
      return {
        message: 'If an account with this email exists, a password reset code has been sent.',
      };
    } catch (error) {
      this.logger.error(`Forgot password error: ${error.message}`, error.stack);
      // Return generic message to avoid email enumeration
      return {
        message: 'If an account with this email exists, a password reset code has been sent.',
      };
    }
  }

  async confirmForgotPassword(dto: ConfirmForgotPasswordDto): Promise<{ message: string }> {
    try {
      await this.cognitoService.confirmForgotPassword(
        dto.email,
        dto.confirmationCode,
        dto.newPassword,
      );
      return { message: 'Password reset successfully. You can now sign in with your new password.' };
    } catch (error) {
      if (error.name === 'CodeMismatchException') {
        throw new BadRequestException('Invalid confirmation code');
      }
      if (error.name === 'ExpiredCodeException') {
        throw new BadRequestException('Confirmation code has expired');
      }
      this.logger.error(`Confirm forgot password error: ${error.message}`, error.stack);
      throw error;
    }
  }

  async logout(accessToken: string): Promise<{ message: string }> {
    try {
      await this.cognitoService.signOut(accessToken);
      return { message: 'Logged out successfully' };
    } catch (error) {
      this.logger.error(`Logout error: ${error.message}`, error.stack);
      throw error;
    }
  }
}
