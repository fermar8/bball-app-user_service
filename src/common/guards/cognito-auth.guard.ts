import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';

export const IS_PUBLIC_KEY = 'isPublic';

@Injectable()
export class CognitoAuthGuard implements CanActivate {
  private readonly logger = new Logger(CognitoAuthGuard.name);
  private readonly jwksClient: jwksClient.JwksClient;
  private readonly userPoolId: string;
  private readonly region: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly reflector: Reflector,
  ) {
    this.userPoolId = this.configService.get<string>('aws.cognito.userPoolId');
    this.region = this.configService.get<string>('aws.region');

    if (this.userPoolId) {
      this.jwksClient = jwksClient({
        jwksUri: `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}/.well-known/jwks.json`,
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
      });
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No authorization token provided');
    }

    try {
      const payload = await this.verifyToken(token);
      request['user'] = payload;
      return true;
    } catch (error) {
      this.logger.warn(`Token verification failed: ${error.message}`);
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  private extractTokenFromHeader(request: any): string | null {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : null;
  }

  private verifyToken(token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        return reject(new Error('Invalid token format'));
      }

      const kid = decoded.header.kid;
      if (!kid || !this.jwksClient) {
        // Allow unverified tokens only in non-production environments (e.g. local dev)
        if (process.env.NODE_ENV === 'production') {
          return reject(new Error('Token missing kid claim; verification required in production'));
        }
        return resolve(decoded.payload);
      }

      this.jwksClient.getSigningKey(kid, (err, key) => {
        if (err) {
          return reject(new Error(`Unable to get signing key: ${err.message}`));
        }
        const signingKey = key.getPublicKey();
        jwt.verify(token, signingKey, { algorithms: ['RS256'] }, (verifyErr, payload) => {
          if (verifyErr) {
            return reject(verifyErr);
          }
          resolve(payload);
        });
      });
    });
  }
}
