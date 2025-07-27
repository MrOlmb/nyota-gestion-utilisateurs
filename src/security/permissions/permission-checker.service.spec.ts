import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PermissionCheckerService, PermissionAction } from './permission-checker.service';
import { SecurityContextService } from '../security-context.service';
import { PrismaService } from '../../database/prisma.service';
import { RedisService } from '../../cache/redis.service';
import { TestEnvironmentManager, setupTestHooks } from '../../test/setup-teardown';

describe('PermissionCheckerService', () => {
  let permissionChecker: PermissionCheckerService;
  let securityContextService: SecurityContextService;
  let prismaService: PrismaService;
  let redisService: RedisService;
  let testManager: TestEnvironmentManager;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionCheckerService,
        SecurityContextService,
        PrismaService,
        RedisService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
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

    permissionChecker = module.get<PermissionCheckerService>(PermissionCheckerService);
    securityContextService = module.get<SecurityContextService>(SecurityContextService);
    prismaService = module.get<PrismaService>(PrismaService);
    redisService = module.get<RedisService>(RedisService);
    
    testManager = new TestEnvironmentManager(prismaService, redisService);
    
    // Initialize Redis service manually for tests
    try {
      await redisService.onModuleInit();
    } catch (error) {
      console.warn('Redis connection failed in test, continuing without cache:', error.message);
    }
    
    await testManager.setupTestEnvironment();
  });

  afterAll(async () => {
    if (testManager) {
      await testManager.cleanupTestEnvironment();
    }
  });

  beforeEach(async () => {
    if (testManager) {
      await testManager.getRedisManager().clearTestCache();
    }
  });

  describe('checkPermission', () => {
    it('should allow access when user has required permission', async () => {
      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-2', // This user exists in test seeds as director
        'etablissement.management',
        PermissionAction.READ
      );

      // Assert
      expect(result.allowed).toBe(true);
    });

    it('should deny access when user lacks required permission', async () => {
      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-2', // Director doesn't have delete permission on establishments
        'etablissement.management',
        PermissionAction.DELETE
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Permission delete refusée');
    });

    it('should deny access for non-existent user', async () => {
      // Act
      const result = await permissionChecker.checkPermission(
        'non-existent-user',
        'etablissement.management',
        PermissionAction.READ
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Contexte de sécurité introuvable');
    });

    it('should handle service errors gracefully', async () => {
      // Temporarily break the service
      jest.spyOn(securityContextService, 'getSecurityContext').mockRejectedValueOnce(new Error('Service error'));

      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-2',
        'etablissement.management',
        PermissionAction.READ
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Erreur lors de la vérification des permissions');

      // Restore
      jest.restoreAllMocks();
    });
  });

  describe('business object specific rules', () => {
    it('should apply establishment context rules for school users', async () => {
      // Act - School user trying to access establishment management
      const result = await permissionChecker.checkPermission(
        'school-user-1', // School director from test seeds
        'etablissement.management',
        PermissionAction.READ
      );

      // Assert - School users should have limited establishment access
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('permission');
    });

    it('should allow access when school user accesses own establishment', async () => {
      // Act - School user accessing student management (their domain)
      const result = await permissionChecker.checkPermission(
        'school-user-1',
        'student.management',
        PermissionAction.READ
      );

      // Assert
      expect(result.allowed).toBe(true);
    });

    it('should handle missing business object permissions', async () => {
      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-2',
        'non.existent.object',
        PermissionAction.READ
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Aucune permission définie');
    });
  });

  describe('permission actions', () => {
    it('should validate READ permissions correctly', async () => {
      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-2',
        'etablissement.management',
        PermissionAction.READ
      );

      // Assert
      expect(result.allowed).toBe(true);
    });

    it('should validate WRITE permissions correctly', async () => {
      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-2',
        'etablissement.management',
        PermissionAction.WRITE
      );

      // Assert
      expect(result.allowed).toBe(true);
    });

    it('should validate CREATE permissions correctly', async () => {
      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-2',
        'etablissement.management',
        PermissionAction.CREATE
      );

      // Assert
      expect(result.allowed).toBe(true);
    });

    it('should validate DELETE permissions correctly', async () => {
      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-2',
        'etablissement.management',
        PermissionAction.DELETE
      );

      // Assert
      expect(result.allowed).toBe(false); // Director doesn't have delete permission
      expect(result.reason).toContain('Permission delete refusée');
    });

    it('should validate APPROVE permissions correctly', async () => {
      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-2',
        'etablissement.management',
        PermissionAction.APPROVE
      );

      // Assert
      expect(result.allowed).toBe(true);
    });
  });

  describe('contextual permission rules', () => {
    it('should restrict inspections to ministry users only', async () => {
      // Act - School user trying to access inspections
      const result = await permissionChecker.checkPermission(
        'school-user-1',
        'inspection.management',
        PermissionAction.READ
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('permission');
    });

    it('should restrict inspection approval to authorized user types', async () => {
      // Act - Regular director trying to approve inspections (minister only in seeds)
      const result = await permissionChecker.checkPermission(
        'ministry-user-2', // Director
        'inspection.management',
        PermissionAction.APPROVE
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('permission');
    });

    it('should allow minister full access to all objects', async () => {
      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-1', // Minister from test seeds
        'global.admin',
        PermissionAction.DELETE
      );

      // Assert
      expect(result.allowed).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle invalid permission actions', async () => {
      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-2',
        'etablissement.management',
        'INVALID_ACTION' as PermissionAction
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Permission INVALID_ACTION refusée');
    });

    it('should handle null or undefined user ID', async () => {
      // Act
      const result = await permissionChecker.checkPermission(
        null as any,
        'etablissement.management',
        PermissionAction.READ
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Contexte de sécurité introuvable');
    });

    it('should handle empty business object', async () => {
      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-2',
        '',
        PermissionAction.READ
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Aucune permission définie');
    });
  });

  describe('checkMultiplePermissions', () => {
    it('should validate multiple permissions correctly', async () => {
      // Arrange
      const permissions = [
        { businessObject: 'etablissement.management', action: PermissionAction.READ },
        { businessObject: 'etablissement.management', action: PermissionAction.WRITE },
      ];

      // Act
      const results = await permissionChecker.checkMultiplePermissions(
        'ministry-user-2',
        permissions
      );

      // Assert
      expect(Object.keys(results)).toHaveLength(2);
      expect(results['etablissement.management.read'].allowed).toBe(true);
      expect(results['etablissement.management.write'].allowed).toBe(true);
    });

    it('should handle mixed permission results', async () => {
      // Arrange
      const permissions = [
        { businessObject: 'etablissement.management', action: PermissionAction.READ },
        { businessObject: 'etablissement.management', action: PermissionAction.DELETE },
      ];

      // Act
      const results = await permissionChecker.checkMultiplePermissions(
        'ministry-user-2',
        permissions
      );

      // Assert
      expect(Object.keys(results)).toHaveLength(2);
      expect(results['etablissement.management.read'].allowed).toBe(true);  // READ allowed
      expect(results['etablissement.management.delete'].allowed).toBe(false); // DELETE not allowed
    });
  });
});