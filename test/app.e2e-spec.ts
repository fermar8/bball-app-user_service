import { Test, TestingModule } from '@nestjs/testing';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from '../src/app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('AppController (e2e)', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestFastifyApplication>(
      new FastifyAdapter(),
    );
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/v1/health (GET)', () => {
    it('should return health status', async () => {
      const response = await app
        .getHttpAdapter()
        .getInstance()
        .inject({ method: 'GET', url: '/api/v1/health' });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
      expect(body.service).toBe('bball-app-user-service');
    });
  });

  describe('/api/v1/auth endpoints (public)', () => {
    it('POST /api/v1/auth/register - should validate input', async () => {
      const response = await app
        .getHttpAdapter()
        .getInstance()
        .inject({
          method: 'POST',
          url: '/api/v1/auth/register',
          payload: { email: 'not-an-email', password: 'short', name: '' },
        });
      expect(response.statusCode).toBe(400);
    });

    it('POST /api/v1/auth/login - should validate input', async () => {
      const response = await app
        .getHttpAdapter()
        .getInstance()
        .inject({
          method: 'POST',
          url: '/api/v1/auth/login',
          payload: { email: 'not-an-email' },
        });
      expect(response.statusCode).toBe(400);
    });
  });

  describe('Protected routes', () => {
    it('GET /api/v1/users - should return 401 without token', async () => {
      const response = await app
        .getHttpAdapter()
        .getInstance()
        .inject({ method: 'GET', url: '/api/v1/users' });
      expect(response.statusCode).toBe(401);
    });

    it('GET /api/v1/teams - should return 401 without token', async () => {
      const response = await app
        .getHttpAdapter()
        .getInstance()
        .inject({ method: 'GET', url: '/api/v1/teams' });
      expect(response.statusCode).toBe(401);
    });
  });
});
