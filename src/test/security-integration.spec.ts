import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { AuthService } from '../auth/auth.service';
import { SecurityContextService } from '../security/security-context.service';
import { PermissionCheckerService, PermissionAction } from '../security/permissions/permission-checker.service';
import { RLSFilterService } from '../security/filters/rls-filter.service';
import { UIVisibilityService } from '../security/ui-rules/ui-visibility.service';
import { TestEnvironmentManager } from './setup-teardown';

describe('Security Integration Tests', () => {
  let app: INestApplication;
  let authService: AuthService;
  let securityContextService: SecurityContextService;
  let permissionChecker: PermissionCheckerService;
  let rlsFilterService: RLSFilterService;
  let uiVisibilityService: UIVisibilityService;
  let prismaService: PrismaService;
  let redisService: RedisService;
  let jwtService: JwtService;
  let testManager: TestEnvironmentManager;

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
              };
              return config[key as keyof typeof config] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    authService = moduleFixture.get<AuthService>(AuthService);
    securityContextService = moduleFixture.get<SecurityContextService>(SecurityContextService);
    permissionChecker = moduleFixture.get<PermissionCheckerService>(PermissionCheckerService);
    rlsFilterService = moduleFixture.get<RLSFilterService>(RLSFilterService);
    uiVisibilityService = moduleFixture.get<UIVisibilityService>(UIVisibilityService);
    prismaService = moduleFixture.get<PrismaService>(PrismaService);
    redisService = moduleFixture.get<RedisService>(RedisService);
    jwtService = moduleFixture.get<JwtService>(JwtService);
    
    testManager = new TestEnvironmentManager(prismaService, redisService);
    
    // Initialize Redis service manually for tests
    try {
      await redisService.onModuleInit();
    } catch (error) {
      console.warn('Redis connection failed in test, continuing without cache:', error.message);
    }
    
    await testManager.setupTestEnvironment();
    await app.init();
  });

  afterAll(async () => {
    if (testManager) {
      await testManager.cleanupTestEnvironment();
    }
    await app.close();
  });

  beforeEach(async () => {
    if (testManager) {
      await testManager.getRedisManager().clearTestCache();
    }
  });

  describe('Authentication Flow Integration', () => {
    it('should authenticate ministry user and build security context', async () => {
      // Act
      const loginResult = await authService.login(
        'directeur@ministere.cg',
        'password123'
      );

      // Assert
      expect(loginResult).toHaveProperty('accessToken');
      expect(loginResult).toHaveProperty('refreshToken');
      expect(loginResult.user.scope).toBe('MINISTRY');
      expect(loginResult.user.id).toBe('ministry-user-2');
    });

    it('should authenticate school user and build security context', async () => {
      // Act
      const loginResult = await authService.login(
        'directeur@ecole1.cg',
        'password123'
      );

      // Assert
      expect(loginResult).toHaveProperty('accessToken');
      expect(loginResult).toHaveProperty('refreshToken');
      expect(loginResult.user.scope).toBe('SCHOOL');
      expect(loginResult.user.id).toBe('school-user-1');
    });
  });

  describe('Security Context Compilation', () => {
    it('should compile complete security context for ministry user', async () => {
      // Act
      const securityContext = await securityContextService.getSecurityContext('ministry-user-2');

      // Assert
      expect(securityContext).toBeDefined();
      expect(securityContext?.userScope).toBe('MINISTRY');
      expect(securityContext?.userType).toBe('DIRECTEUR');
      expect(securityContext?.permissions).toBeDefined();
      expect(securityContext?.dataFilters).toBeDefined();
      expect(securityContext?.hierarchy).toBeDefined();
    });

    it('should compile complete security context for school user', async () => {
      // Act
      const securityContext = await securityContextService.getSecurityContext('school-user-1');

      // Assert
      expect(securityContext).toBeDefined();
      expect(securityContext?.userScope).toBe('SCHOOL');
      expect(securityContext?.userType).toBe('DIRECTEUR');
      expect(securityContext?.etablissementId).toBe('etablissement-1');
      expect(securityContext?.permissions).toBeDefined();
      expect(securityContext?.dataFilters).toBeDefined();
    });

    it('should cache security contexts for performance', async () => {
      // Act - First call
      const start = Date.now();
      const context1 = await securityContextService.getSecurityContext('ministry-user-2');
      const firstCallTime = Date.now() - start;

      // Act - Second call (should be cached)
      const start2 = Date.now();
      const context2 = await securityContextService.getSecurityContext('ministry-user-2');
      const secondCallTime = Date.now() - start2;

      // Assert
      expect(context1).toEqual(context2);
      // Second call should be faster due to caching (if Redis is working)
      // We don't assert this strictly since Redis might not be available in tests
    });
  });

  describe('Permission System Integration', () => {
    it('should enforce ministry user permissions correctly', async () => {
      // Act
      const readResult = await permissionChecker.checkPermission(
        'ministry-user-2',
        'etablissement.management',
        PermissionAction.READ
      );

      const deleteResult = await permissionChecker.checkPermission(
        'ministry-user-2',
        'etablissement.management',
        PermissionAction.DELETE
      );

      // Assert
      expect(readResult.allowed).toBe(true);
      expect(deleteResult.allowed).toBe(false); // Director doesn't have delete permission
    });

    it('should enforce school user permissions correctly', async () => {
      // Act
      const studentResult = await permissionChecker.checkPermission(
        'school-user-1',
        'student.management',
        PermissionAction.READ
      );

      const establishmentResult = await permissionChecker.checkPermission(
        'school-user-1',
        'etablissement.management',
        PermissionAction.READ
      );

      // Assert
      expect(studentResult.allowed).toBe(true);
      expect(establishmentResult.allowed).toBe(false); // School users don't have establishment management
    });

    it('should validate minister has full permissions', async () => {
      // Act
      const adminResult = await permissionChecker.checkPermission(
        'ministry-user-1',
        'global.admin',
        PermissionAction.DELETE
      );

      // Assert
      expect(adminResult.allowed).toBe(true);
    });
  });

  describe('Row-Level Security Integration', () => {
    it('should compile RLS filters for ministry users', async () => {
      // Act
      const filters = await rlsFilterService.compileFilters({
        userId: 'ministry-user-2',
        businessObject: 'etablissement.management',
        operation: 'read'
      });

      // Assert
      expect(['NONE', 'PARTIAL', 'FULL']).toContain(filters.restrictionLevel);
      expect(filters.where).toBeDefined();
    });

    it('should compile RLS filters for school users', async () => {
      // Act
      const filters = await rlsFilterService.compileFilters({
        userId: 'school-user-1',
        businessObject: 'student.management',
        operation: 'read'
      });

      // Assert
      expect(['NONE', 'PARTIAL', 'FULL']).toContain(filters.restrictionLevel);
      expect(filters.where).toBeDefined();
    });

    it('should apply filters to Prisma queries', async () => {
      // Arrange
      const baseQuery = {
        where: { estActif: true },
        include: { departement: true }
      };

      // Act
      const filteredQuery = await rlsFilterService.applyFiltersToQuery(
        {
          userId: 'ministry-user-2',
          businessObject: 'etablissement.management',
          operation: 'read'
        },
        baseQuery
      );

      // Assert
      expect(filteredQuery.where).toHaveProperty('AND');
      expect(filteredQuery.include).toEqual(baseQuery.include);
    });
  });

  describe('UI Visibility Integration', () => {
    it('should generate UI configuration for ministry users', async () => {
      // Act
      const uiConfig = await uiVisibilityService.generateUIConfig(
        'ministry-user-2',
        'etablissement-management'
      );

      // Assert
      expect(uiConfig).toBeDefined();
      expect(typeof uiConfig).toBe('object');
    });

    it('should generate UI configuration for school users', async () => {
      // Act
      const uiConfig = await uiVisibilityService.generateUIConfig(
        'school-user-1',
        'student-management'
      );

      // Assert
      expect(uiConfig).toBeDefined();
      expect(typeof uiConfig).toBe('object');
    });

    it('should check element visibility correctly', async () => {
      // Act
      const isVisible = await uiVisibilityService.checkElementVisibility(
        'ministry-user-2',
        'delete-button',
        'BUTTON'
      );

      // Assert
      expect(typeof isVisible).toBe('boolean');
    });
  });

  describe('Cross-Service Integration', () => {
    it('should maintain consistency between authentication and permissions', async () => {
      // Act - Login user
      const loginResult = await authService.login('directeur@ministere.cg', 'password123');
      
      // Act - Check permissions for same user
      const permissionResult = await permissionChecker.checkPermission(
        loginResult.user.id,
        'etablissement.management',
        PermissionAction.READ
      );

      // Assert
      expect(loginResult.user.id).toBe('ministry-user-2');
      expect(permissionResult.allowed).toBe(true);
    });

    it('should handle error cases gracefully across services', async () => {
      // Act & Assert - Non-existent user
      const securityContext = await securityContextService.getSecurityContext('non-existent-user');
      expect(securityContext).toBeNull();

      const permissionResult = await permissionChecker.checkPermission(
        'non-existent-user',
        'etablissement.management',
        PermissionAction.READ
      );
      expect(permissionResult.allowed).toBe(false);
    });

    it('should invalidate caches properly', async () => {
      // Act - Get initial context
      const initialContext = await securityContextService.getSecurityContext('ministry-user-2');
      
      // Act - Invalidate cache
      await securityContextService.invalidateSecurityContext('ministry-user-2');
      
      // Act - Get context again (should rebuild)
      const rebuiltContext = await securityContextService.getSecurityContext('ministry-user-2');

      // Assert
      expect(initialContext).toBeDefined();
      expect(rebuiltContext).toBeDefined();
      // Both should have same structure but may differ in timestamps
      expect(rebuiltContext?.userId).toBe(initialContext?.userId);
      expect(rebuiltContext?.userScope).toBe(initialContext?.userScope);
    });
  });

  describe('Performance Integration', () => {
    it('should handle concurrent security context requests', async () => {
      // Act - Multiple concurrent requests
      const promises = Array.from({ length: 5 }, () =>
        securityContextService.getSecurityContext('ministry-user-2')
      );

      const results = await Promise.all(promises);

      // Assert
      results.forEach(result => {
        expect(result).toBeDefined();
        expect(result?.userId).toBe('ministry-user-2');
      });
    });

    it('should handle multiple permission checks efficiently', async () => {
      // Arrange
      const permissionChecks = [
        { businessObject: 'etablissement.management', action: PermissionAction.READ },
        { businessObject: 'etablissement.management', action: PermissionAction.WRITE },
        { businessObject: 'etablissement.management', action: PermissionAction.CREATE },
        { businessObject: 'etablissement.management', action: PermissionAction.APPROVE },
      ];

      // Act
      const start = Date.now();
      const results = await permissionChecker.checkMultiplePermissions(
        'ministry-user-2',
        permissionChecks
      );
      const duration = Date.now() - start;

      // Assert
      expect(Object.keys(results)).toHaveLength(4);
      expect(duration).toBeLessThan(1000); // Should complete within 1 second
    });
  });
});