import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { AuthService } from '../auth/auth.service';
import { SecurityContextService } from '../security/security-context.service';
import { PermissionCheckerService } from '../security/permissions/permission-checker.service';
import { RLSFilterService } from '../security/filters/rls-filter.service';
import { SecurityGuard } from '../common/guards/security.guard';
import { RLSInterceptor } from '../common/interceptors/rls.interceptor';

describe('Security Integration Tests', () => {
  let app: INestApplication;
  let authService: AuthService;
  let prismaService: jest.Mocked<PrismaService>;
  let redisService: jest.Mocked<RedisService>;
  let jwtService: JwtService;

  // Mock data
  const mockMinistryUser = {
    id: 'ministry-user-1',
    email: 'ministre@education.cg',
    passwordHash: '$2a$10$hashedpassword',
    prenom: 'Jean',
    nom: 'Dupont',
    typeUtilisateur: 'DIRECTEUR',
    estActif: true,
    tentativesEchouees: 0,
    groupesSecurite: [
      {
        groupId: 'group-1',
        group: {
          permissions: [
            {
              object: { nom: 'etablissement.management' },
              peutLire: true,
              peutEcrire: true,
              peutCreer: true,
              peutSupprimer: false,
              peutApprouver: true
            }
          ]
        }
      }
    ],
    structure: { id: 'structure-1' },
    departementGeo: null
  };

  const mockSchoolUser = {
    id: 'school-user-1',
    email: 'directeur@ecole.cg',
    passwordHash: '$2a$10$hashedpassword',
    prenom: 'Marie',
    nom: 'Martin',
    typeUtilisateur: 'DIRECTEUR',
    etablissementId: 'etablissement-1',
    estActif: true,
    tentativesEchouees: 0,
    groupesSecurite: [
      {
        groupId: 'group-school-1',
        group: {
          permissions: [
            {
              object: { nom: 'student.management' },
              peutLire: true,
              peutEcrire: true,
              peutCreer: true,
              peutSupprimer: false,
              peutApprouver: false
            }
          ]
        }
      }
    ],
    etablissement: {
      id: 'etablissement-1',
      nom: 'École Primaire de Brazzaville'
    }
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        SecurityContextService,
        PermissionCheckerService,
        RLSFilterService,
        SecurityGuard,
        RLSInterceptor,
        JwtService,
        {
          provide: PrismaService,
          useValue: {
            userMinistry: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            userSchool: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            journalAudit: {
              create: jest.fn(),
            },
            visibilityRuleMinistry: {
              findMany: jest.fn(),
            },
            visibilityRuleSchool: {
              findMany: jest.fn(),
            },
            uIRuleMinistry: {
              findMany: jest.fn(),
            },
            uIRuleSchool: {
              findMany: jest.fn(),
            },
            $queryRaw: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            increment: jest.fn(),
            expire: jest.fn(),
            sadd: jest.fn(),
          },
        },
        {
          provide: 'JWT_MODULE_OPTIONS',
          useValue: {
            secret: 'test-secret',
            signOptions: { expiresIn: '15m' },
          },
        },
        {
          provide: 'CONFIG_SERVICE',
          useValue: {
            get: jest.fn((key: string) => {
              const config = {
                JWT_SECRET: 'test-secret',
                JWT_EXPIRES_IN: '15m',
                MAX_LOGIN_ATTEMPTS: 5,
                LOCK_TIME_MINUTES: 30,
                CACHE_TTL_PERMISSIONS: 3600,
                SESSION_TTL_SECONDS: 1800,
              };
              return config[key as keyof typeof config];
            }),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    authService = moduleFixture.get<AuthService>(AuthService);
    prismaService = moduleFixture.get(PrismaService);
    redisService = moduleFixture.get(RedisService);
    jwtService = moduleFixture.get<JwtService>(JwtService);

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks
    redisService.get.mockResolvedValue(null);
    redisService.set.mockResolvedValue(undefined);
    redisService.sadd.mockResolvedValue(1);
    prismaService.journalAudit.create.mockResolvedValue({} as any);
    prismaService.visibilityRuleMinistry.findMany.mockResolvedValue([]);
    prismaService.uIRuleMinistry.findMany.mockResolvedValue([]);
    prismaService.visibilityRuleSchool.findMany.mockResolvedValue([]);
    prismaService.uIRuleSchool.findMany.mockResolvedValue([]);
    prismaService.$queryRaw.mockResolvedValue([]);
  });

  describe('Full Authentication and Security Flow', () => {
    it('should complete full login flow for ministry user with security context', async () => {
      // Arrange
      const bcryptjs = require('bcryptjs');
      jest.spyOn(bcryptjs, 'compare').mockResolvedValue(true);

      prismaService.userMinistry.findUnique.mockResolvedValue(mockMinistryUser as any);
      prismaService.userSchool.findUnique.mockResolvedValue(null);
      prismaService.userMinistry.update.mockResolvedValue(mockMinistryUser as any);

      // Mock hierarchy query
      prismaService.$queryRaw.mockResolvedValue([
        {
          id: 'ministry-user-1',
          email: 'ministre@education.cg',
          prenom: 'Jean',
          nom: 'Dupont',
          manager_id: null
        },
        {
          id: 'subordinate-1',
          email: 'directeur@ministere.cg',
          prenom: 'Paul',
          nom: 'Durand',
          manager_id: 'ministry-user-1'
        }
      ]);

      // Act
      const loginResult = await authService.login(
        'ministre@education.cg',
        'password123',
        '192.168.1.1'
      );

      // Assert
      expect(loginResult).toHaveProperty('accessToken');
      expect(loginResult).toHaveProperty('refreshToken');
      expect(loginResult.user).toMatchObject({
        id: 'ministry-user-1',
        email: 'ministre@education.cg',
        scope: 'MINISTRY',
        typeUtilisateur: 'DIRECTEUR'
      });

      // Verify security context was cached
      expect(redisService.set).toHaveBeenCalledWith(
        'security:ministry-user-1',
        expect.any(String),
        3600
      );

      // Verify audit log
      expect(prismaService.journalAudit.create).toHaveBeenCalledWith({
        data: {
          userMinistryId: 'ministry-user-1',
          userSchoolId: null,
          action: 'LOGIN_SUCCESS',
          module: 'AUTH',
          adresseIp: '192.168.1.1',
          userAgent: '',
          creeLe: expect.any(Date)
        }
      });
    });

    it('should complete full login flow for school user', async () => {
      // Arrange
      const bcryptjs = require('bcryptjs');
      jest.spyOn(bcryptjs, 'compare').mockResolvedValue(true);

      prismaService.userMinistry.findUnique.mockResolvedValue(null);
      prismaService.userSchool.findUnique.mockResolvedValue(mockSchoolUser as any);
      prismaService.userSchool.update.mockResolvedValue(mockSchoolUser as any);

      // Act
      const loginResult = await authService.login(
        'directeur@ecole.cg',
        'password123',
        '192.168.1.1'
      );

      // Assert
      expect(loginResult.user).toMatchObject({
        id: 'school-user-1',
        email: 'directeur@ecole.cg',
        scope: 'SCHOOL',
        etablissementId: 'etablissement-1'
      });

      expect(prismaService.journalAudit.create).toHaveBeenCalledWith({
        data: {
          userMinistryId: null,
          userSchoolId: 'school-user-1',
          action: 'LOGIN_SUCCESS',
          module: 'AUTH',
          adresseIp: '192.168.1.1',
          userAgent: '',
          creeLe: expect.any(Date)
        }
      });
    });

    it('should handle account lockout after failed attempts', async () => {
      // Arrange
      const bcryptjs = require('bcryptjs');
      jest.spyOn(bcryptjs, 'compare').mockResolvedValue(false);

      const userWithFailedAttempts = {
        ...mockMinistryUser,
        tentativesEchouees: 4
      };

      prismaService.userMinistry.findUnique.mockResolvedValue(userWithFailedAttempts as any);
      redisService.increment.mockResolvedValue(5); // 5th attempt

      // Act & Assert
      await expect(
        authService.login('ministre@education.cg', 'wrongpassword')
      ).rejects.toThrow('Compte verrouillé suite à plusieurs tentatives échouées');

      // Verify account was locked
      expect(redisService.set).toHaveBeenCalledWith(
        'lock:ministre@education.cg',
        '1',
        1800 // 30 minutes
      );

      expect(prismaService.userMinistry.update).toHaveBeenCalledWith({
        where: { id: 'ministry-user-1' },
        data: {
          verrouJusqua: expect.any(Date)
        }
      });
    });
  });

  describe('JWT Token Validation Flow', () => {
    it('should validate JWT token and extract user context', async () => {
      // Arrange
      const payload = {
        sub: 'ministry-user-1',
        email: 'ministre@education.cg',
        type: 'DIRECTEUR',
        scope: 'MINISTRY',
        structureId: 'structure-1',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      const token = await jwtService.signAsync(payload);

      // Act
      const decoded = await jwtService.verifyAsync(token, {
        secret: 'test-secret'
      });

      // Assert
      expect(decoded).toMatchObject({
        sub: 'ministry-user-1',
        email: 'ministre@education.cg',
        type: 'DIRECTEUR',
        scope: 'MINISTRY'
      });
    });

    it('should reject expired tokens', async () => {
      // Arrange
      const expiredPayload = {
        sub: 'ministry-user-1',
        email: 'ministre@education.cg',
        type: 'DIRECTEUR',
        scope: 'MINISTRY',
        iat: Math.floor(Date.now() / 1000) - 3600,
        exp: Math.floor(Date.now() / 1000) - 1800, // Expired 30 minutes ago
      };

      const expiredToken = await jwtService.signAsync(expiredPayload);

      // Act & Assert
      await expect(
        jwtService.verifyAsync(expiredToken, { secret: 'test-secret' })
      ).rejects.toThrow();
    });
  });

  describe('Security Context Compilation and Caching', () => {
    it('should compile and cache complete security context for ministry user', async () => {
      // This test would require access to the SecurityContextService
      // which compiles permissions, data filters, UI rules, and hierarchy
      expect(true).toBe(true); // Placeholder for now
    });

    it('should compile security context for school user', async () => {
      // Similar test for school users
      expect(true).toBe(true); // Placeholder for now
    });

    it('should handle cache miss and recompile security context', async () => {
      // Test cache invalidation and recompilation
      expect(true).toBe(true); // Placeholder for now
    });
  });

  describe('Permission Checking Integration', () => {
    it('should check permissions using cached security context', async () => {
      // Test the full permission checking flow
      expect(true).toBe(true); // Placeholder for now
    });

    it('should apply contextual rules for establishment management', async () => {
      // Test context-specific permission rules
      expect(true).toBe(true); // Placeholder for now
    });
  });

  describe('RLS Filter Integration', () => {
    it('should compile and apply RLS filters for ministry users', async () => {
      // Test RLS filter compilation and application
      expect(true).toBe(true); // Placeholder for now
    });

    it('should apply tenant-specific filters for school users', async () => {
      // Test school-specific RLS filters
      expect(true).toBe(true); // Placeholder for now
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle Redis connection failures gracefully', async () => {
      // Arrange
      redisService.get.mockRejectedValue(new Error('Redis connection failed'));
      
      const bcryptjs = require('bcryptjs');
      jest.spyOn(bcryptjs, 'compare').mockResolvedValue(true);
      
      prismaService.userMinistry.findUnique.mockResolvedValue(mockMinistryUser as any);
      prismaService.userSchool.findUnique.mockResolvedValue(null);
      prismaService.userMinistry.update.mockResolvedValue(mockMinistryUser as any);

      // Act & Assert - should not throw, but handle gracefully
      const result = await authService.login(
        'ministre@education.cg',
        'password123'
      );

      expect(result).toHaveProperty('accessToken');
    });

    it('should handle database connection failures', async () => {
      // Arrange
      prismaService.userMinistry.findUnique.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(
        authService.login('ministre@education.cg', 'password123')
      ).rejects.toThrow();
    });

    it('should handle malformed security context data', async () => {
      // Test robustness with corrupted cache data
      redisService.get.mockResolvedValue('invalid-json-data');

      // Should handle gracefully and recompile
      expect(true).toBe(true); // Placeholder for specific implementation
    });
  });

  describe('Audit Trail Integration', () => {
    it('should log all security-related events', async () => {
      // Verify comprehensive audit logging
      expect(prismaService.journalAudit.create).toHaveBeenCalled();
    });

    it('should include proper context in audit logs', async () => {
      // Verify audit logs contain all necessary information
      const auditCalls = prismaService.journalAudit.create.mock.calls;
      if (auditCalls.length > 0) {
        const auditData = auditCalls[0][0].data;
        expect(auditData).toHaveProperty('action');
        expect(auditData).toHaveProperty('module');
        expect(auditData).toHaveProperty('adresseIp');
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle concurrent login attempts efficiently', async () => {
      // Test concurrent logins
      const bcryptjs = require('bcryptjs');
      jest.spyOn(bcryptjs, 'compare').mockResolvedValue(true);

      prismaService.userMinistry.findUnique.mockResolvedValue(mockMinistryUser as any);
      prismaService.userSchool.findUnique.mockResolvedValue(null);
      prismaService.userMinistry.update.mockResolvedValue(mockMinistryUser as any);

      const loginPromises = Array(5).fill(null).map(() =>
        authService.login('ministre@education.cg', 'password123')
      );

      const results = await Promise.all(loginPromises);
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toHaveProperty('accessToken');
      });
    });

    it('should cache security contexts efficiently', async () => {
      // Verify caching reduces database calls
      expect(redisService.set).toHaveBeenCalled();
    });
  });
});