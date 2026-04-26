import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  GlobalSignOutCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';

@Injectable()
export class CognitoService {
  private readonly logger = new Logger(CognitoService.name);
  private readonly client: CognitoIdentityProviderClient;
  private readonly userPoolId: string;
  private readonly clientId: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new CognitoIdentityProviderClient({
      region: this.configService.get<string>('aws.region'),
    });
    this.userPoolId = this.configService.get<string>('aws.cognito.userPoolId');
    this.clientId = this.configService.get<string>('aws.cognito.clientId');
  }

  async signUp(
    email: string,
    password: string,
    name: string,
  ): Promise<{ userSub: string }> {
    try {
      const command = new SignUpCommand({
        ClientId: this.clientId,
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'name', Value: name },
        ],
      });
      const result = await this.client.send(command);
      return { userSub: result.UserSub };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Cognito signUp error: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Cognito signUp error: ${String(error)}`);
      }
      throw error;
    }
  }

  async confirmSignUp(email: string, confirmationCode: string): Promise<void> {
    try {
      const command = new ConfirmSignUpCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: confirmationCode,
      });
      await this.client.send(command);
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Cognito confirmSignUp error: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Cognito confirmSignUp error: ${String(error)}`);
      }
      throw error;
    }
  }

  async signIn(
    email: string,
    password: string,
  ): Promise<{
    accessToken: string;
    idToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
        ClientId: this.clientId,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      });
      const result = await this.client.send(command);
      const authResult = result.AuthenticationResult;
      return {
        accessToken: authResult.AccessToken,
        idToken: authResult.IdToken,
        refreshToken: authResult.RefreshToken,
        expiresIn: authResult.ExpiresIn,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Cognito signIn error: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Cognito signIn error: ${String(error)}`);
      }
      throw error;
    }
  }

  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    idToken: string;
    expiresIn: number;
  }> {
    try {
      const command = new InitiateAuthCommand({
        AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
        ClientId: this.clientId,
        AuthParameters: {
          REFRESH_TOKEN: refreshToken,
        },
      });
      const result = await this.client.send(command);
      const authResult = result.AuthenticationResult;
      return {
        accessToken: authResult.AccessToken,
        idToken: authResult.IdToken,
        expiresIn: authResult.ExpiresIn,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Cognito refreshToken error: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Cognito refreshToken error: ${String(error)}`);
      }
      throw error;
    }
  }

  async forgotPassword(email: string): Promise<void> {
    try {
      const command = new ForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
      });
      await this.client.send(command);
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Cognito forgotPassword error: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Cognito forgotPassword error: ${String(error)}`);
      }
      throw error;
    }
  }

  async confirmForgotPassword(
    email: string,
    confirmationCode: string,
    newPassword: string,
  ): Promise<void> {
    try {
      const command = new ConfirmForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email,
        ConfirmationCode: confirmationCode,
        Password: newPassword,
      });
      await this.client.send(command);
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Cognito confirmForgotPassword error: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(
          `Cognito confirmForgotPassword error: ${String(error)}`,
        );
      }
      throw error;
    }
  }

  async signOut(accessToken: string): Promise<void> {
    try {
      const command = new GlobalSignOutCommand({ AccessToken: accessToken });
      await this.client.send(command);
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.logger.error(
          `Cognito signOut error: ${error.message}`,
          error.stack,
        );
      } else {
        this.logger.error(`Cognito signOut error: ${String(error)}`);
      }
      throw error;
    }
  }
}
