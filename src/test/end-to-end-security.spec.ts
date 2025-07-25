import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { TestEnvironmentManager, setupTestHooks } from './setup-teardown';
import { AuthService } from '../auth/auth.service';
import { createMockHttpObjects } from './test-helpers';

describe('End-to-End Security Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let authService: AuthService;
  let environmentManager: TestEnvironmentManager;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    redis = moduleFixture.get<RedisService>(RedisService);
    authService = moduleFixture.get<AuthService>(AuthService);
    environmentManager = new TestEnvironmentManager(prisma, redis);
  });

  afterAll(async () => {
    await app.close();
  });

  // Use the setupTestHooks to manage the test database
  setupTestHooks(environmentManager);

  it('should successfully login a ministry user', async () => {
    // Arrange
    const { req } = createMockHttpObjects();
    const bcryptjs = require('bcryptjs');
    jest.spyOn(bcryptjs, 'compare').mockResolvedValue(true);

    // Act
    const result = await authService.login('ministre@education.cg', 'password123', req);

    // Assert
    expect(result).toHaveProperty('accessToken');
    expect(result.user.email).toBe('ministre@education.cg');
  });
});
