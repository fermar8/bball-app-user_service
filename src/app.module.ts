import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { TeamsModule } from './teams/teams.module';
import { AwsModule } from './aws/aws.module';
import { HealthModule } from './health/health.module';
import configuration from './config/configuration';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: '.env',
    }),
    CacheModule.register({
      isGlobal: true,
      ttl: parseInt(process.env.CACHE_TTL || '60') * 1000,
      max: 100,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60') * 1000,
        limit: parseInt(process.env.THROTTLE_LIMIT || '100'),
      },
    ]),
    AwsModule,
    AuthModule,
    UsersModule,
    TeamsModule,
    HealthModule,
  ],
})
export class AppModule {}
