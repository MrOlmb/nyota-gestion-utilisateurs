import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { TestEnvironmentManager } from './setup-teardown';
import { AuthService } from '../auth/auth.service';
import { SecurityContextService } from '../security/security-context.service';
import { PermissionCheckerService } from '../security/permissions/permission-checker.service';
import { RLSFilterService } from '../security/filters/rls-filter.service';
import { UIVisibilityService } from '../security/ui-rules/ui-visibility.service';

describe('End-to-End Security Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let redis: RedisService;
  let authService: AuthService;
  let securityContextService: SecurityContextService;
  let permissionChecker: PermissionCheckerService;
  let rlsFilterService: RLSFilterService;
  let uiVisibilityService: UIVisibilityService;
  let environmentManager: TestEnvironmentManager;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        SecurityContextService,
        PermissionCheckerService,
        RLSFilterService,
        UIVisibilityService,
        PrismaService,
        RedisService,
        JwtService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                JWT_SECRET: 'test-secret',
                JWT_EXPIRES_IN: '15m',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_REFRESH_EXPIRES_IN: '7d',
                MAX_LOGIN_ATTEMPTS: 5,
                LOCK_TIME_MINUTES: 30,
                REDIS_HOST: 'localhost',
                REDIS_PORT: 6379,
                REDIS_PASSWORD: 'RedisNyota2024!',
                REDIS_DB: 0,
                CACHE_TTL_PERMISSIONS: 3600,
                SESSION_TTL_SECONDS: 1800,
                SECURITY_CONTEXT_TTL: 3600,
              };
              return config[key as keyof typeof config] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    redis = moduleFixture.get<RedisService>(RedisService);
    authService = moduleFixture.get<AuthService>(AuthService);
    securityContextService = moduleFixture.get<SecurityContextService>(SecurityContextService);
    permissionChecker = moduleFixture.get<PermissionCheckerService>(PermissionCheckerService);
    rlsFilterService = moduleFixture.get<RLSFilterService>(RLSFilterService);
    uiVisibilityService = moduleFixture.get<UIVisibilityService>(UIVisibilityService);
    
    environmentManager = new TestEnvironmentManager(prisma, redis);
    
    // Initialize Redis service manually for tests
    try {
      await redis.onModuleInit();
    } catch (error) {
      console.warn('Redis connection failed in test, continuing without cache:', error.message);
    }
    
    await environmentManager.setupTestEnvironment();
  });

  afterAll(async () => {
    if (environmentManager) {
      await environmentManager.cleanupTestEnvironment();
    }
    await app.close();
  });

  beforeEach(async () => {
    if (environmentManager) {
      await environmentManager.getRedisManager().clearTestCache();
    }
  });

  describe('Authentication End-to-End', () => {
    it('should successfully login a ministry user with real database', async () => {
      // Act
      const result = await authService.login('directeur@ministere.cg', 'password123', '192.168.1.1');

      // Assert
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('directeur@ministere.cg');
      expect(result.user.scope).toBe('MINISTRY');
    });

    it('should successfully login a school user with real database', async () => {
      // Act
      const result = await authService.login('directeur@ecole1.cg', 'password123', '192.168.1.1');

      // Assert
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe('directeur@ecole1.cg');
      expect(result.user.scope).toBe('SCHOOL');
    });
  });

  describe('Security Context End-to-End', () => {
    it('should compile complete security context for authenticated users', async () => {
      // Act - Login first to establish context
      const loginResult = await authService.login('directeur@ministere.cg', 'password123');
      
      // Act - Get security context
      const securityContext = await securityContextService.getSecurityContext(loginResult.user.id);

      // Assert
      expect(securityContext).toBeDefined();
      expect(securityContext?.userScope).toBe('MINISTRY');
      expect(securityContext?.permissions).toBeDefined();
      expect(securityContext?.dataFilters).toBeDefined();
      expect(securityContext?.hierarchy).toBeDefined();
    });
  });

  describe('Full Security Flow End-to-End', () => {
    it('should handle complete authentication to permission checking flow', async () => {
      // Act - Login
      const loginResult = await authService.login('directeur@ministere.cg', 'password123');
      
      // Act - Check permissions
      const permissionResult = await permissionChecker.checkPermission(
        loginResult.user.id,
        'etablissement.management',
        'read' as any
      );

      // Assert
      expect(permissionResult.allowed).toBe(true);
    });

    it('should handle RLS filter compilation for authenticated users', async () => {
      // Act - Login
      const loginResult = await authService.login('directeur@ministere.cg', 'password123');
      
      // Act - Compile RLS filters
      const filters = await rlsFilterService.compileFilters({
        userId: loginResult.user.id,
        businessObject: 'etablissement.management',
        operation: 'read'
      });

      // Assert
      expect(filters).toBeDefined();
      expect(['NONE', 'PARTIAL', 'FULL']).toContain(filters.restrictionLevel);
    });

    it('should handle UI visibility rules for authenticated users', async () => {
      // Act - Login
      const loginResult = await authService.login('directeur@ministere.cg', 'password123');
      
      // Act - Generate UI config
      const uiConfig = await uiVisibilityService.generateUIConfig(
        loginResult.user.id,
        'etablissement-management'
      );

      // Assert
      expect(uiConfig).toBeDefined();
      expect(typeof uiConfig).toBe('object');
    });
  });
});
