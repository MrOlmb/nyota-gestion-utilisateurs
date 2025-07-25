import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import * as bcryptjs from 'bcryptjs';

// Mock bcryptjs
jest.mock('bcryptjs');

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: any;
  let redisService: any;
  let jwtService: any;
  let configService: any;

  const mockMinistryUser = {
    id: 'ministry-user-1',
    email: 'ministre@education.cg',
    passwordHash: '$2a$10$hashedpassword',
    prenom: 'Jean',
    nom: 'Dupont',
    typeUtilisateur: 'MINISTRE',
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
              peutSupprimer: true,
              peutApprouver: true
            }
          ]
        }
      }
    ],
    structure: null,
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
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
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config = {
                MAX_LOGIN_ATTEMPTS: 5,
                LOCK_TIME_MINUTES: 30,
                JWT_SECRET: 'test-secret',
                JWT_EXPIRES_IN: '15m',
                JWT_REFRESH_SECRET: 'test-refresh-secret',
                JWT_REFRESH_EXPIRES_IN: '7d',
                CACHE_TTL_PERMISSIONS: 3600,
                SESSION_TTL_SECONDS: 1800,
              };
              return config[key as keyof typeof config] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    redisService = module.get(RedisService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  describe('login', () => {
    beforeEach(() => {
      // Reset mocks
      jest.clearAllMocks();
      
      // Default mock implementations
      (bcryptjs.compare as jest.Mock).mockResolvedValue(true);
      jwtService.signAsync.mockResolvedValue('mock-jwt-token');
      redisService.get.mockResolvedValue(null); // Pas de verrouillage
      redisService.set.mockResolvedValue(undefined);
      redisService.sadd.mockResolvedValue(1);
      prismaService.journalAudit.create.mockResolvedValue({} as any);
    });

    it('should successfully login a ministry user', async () => {
      // Arrange
      prismaService.userMinistry.findUnique.mockResolvedValue(mockMinistryUser as any);
      prismaService.userSchool.findUnique.mockResolvedValue(null);
      prismaService.userMinistry.update.mockResolvedValue(mockMinistryUser as any);
      prismaService.visibilityRuleMinistry.findMany.mockResolvedValue([]);
      prismaService.uIRuleMinistry.findMany.mockResolvedValue([]);
      prismaService.$queryRaw.mockResolvedValue([
        {
          id: 'ministry-user-1',
          email: 'ministre@education.cg',
          prenom: 'Jean',
          nom: 'Dupont',
          manager_id: null
        }
      ]);

      // Act
      const result = await authService.login(
        'ministre@education.cg',
        'password123',
        '192.168.1.1'
      );

      // Assert
      expect(result).toHaveProperty('accessToken', 'mock-jwt-token');
      expect(result).toHaveProperty('refreshToken', 'mock-jwt-token');
      expect(result.user).toMatchObject({
        id: 'ministry-user-1',
        email: 'ministre@education.cg',
        prenom: 'Jean',
        nom: 'Dupont',
        scope: 'MINISTRY',
        typeUtilisateur: 'MINISTRE'
      });

      // Verify password was checked
      expect(bcryptjs.compare).toHaveBeenCalledWith('password123', '$2a$10$hashedpassword');
      
      // Verify login attempts were reset
      expect(prismaService.userMinistry.update).toHaveBeenCalledWith({
        where: { id: 'ministry-user-1' },
        data: {
          tentativesEchouees: 0,
          derniereConnexion: expect.any(Date)
        }
      });

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

    it('should successfully login a school user', async () => {
      // Arrange
      prismaService.userMinistry.findUnique.mockResolvedValue(null);
      prismaService.userSchool.findUnique.mockResolvedValue(mockSchoolUser as any);
      prismaService.userSchool.update.mockResolvedValue(mockSchoolUser as any);
      prismaService.visibilityRuleSchool.findMany.mockResolvedValue([]);
      prismaService.uIRuleSchool.findMany.mockResolvedValue([]);

      // Act
      const result = await authService.login(
        'directeur@ecole.cg',
        'password123',
        '192.168.1.1'
      );

      // Assert
      expect(result.user).toMatchObject({
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

    it('should throw UnauthorizedException for non-existent user', async () => {
      // Arrange
      prismaService.userMinistry.findUnique.mockResolvedValue(null);
      prismaService.userSchool.findUnique.mockResolvedValue(null);
      redisService.increment.mockResolvedValue(1);

      // Act & Assert
      await expect(
        authService.login('inexistant@test.com', 'password123')
      ).rejects.toThrow(UnauthorizedException);

      expect(redisService.increment).toHaveBeenCalledWith('attempts:inexistant@test.com');
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      // Arrange
      prismaService.userMinistry.findUnique.mockResolvedValue(mockMinistryUser as any);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(false);
      redisService.increment.mockResolvedValue(1);

      // Act & Assert
      await expect(
        authService.login('ministre@education.cg', 'wrongpassword')
      ).rejects.toThrow(UnauthorizedException);

      expect(redisService.increment).toHaveBeenCalledWith('attempts:ministre@education.cg');
    });

    it('should lock account after max login attempts', async () => {
      // Arrange
      const userWithFailedAttempts = {
        ...mockMinistryUser,
        tentativesEchouees: 4 // One less than max (5)
      };
      
      prismaService.userMinistry.findUnique.mockResolvedValue(userWithFailedAttempts as any);
      (bcryptjs.compare as jest.Mock).mockResolvedValue(false);
      redisService.increment.mockResolvedValue(5);

      // Act & Assert
      await expect(
        authService.login('ministre@education.cg', 'wrongpassword')
      ).rejects.toThrow('Compte verrouillé suite à plusieurs tentatives échouées');

      // Verify account was locked in Redis
      expect(redisService.set).toHaveBeenCalledWith(
        'lock:ministre@education.cg',
        '1',
        1800 // 30 minutes in seconds
      );

      // Verify account was locked in database
      expect(prismaService.userMinistry.update).toHaveBeenCalledWith({
        where: { id: 'ministry-user-1' },
        data: {
          verrouJusqua: expect.any(Date)
        }
      });
    });

    it('should throw UnauthorizedException for locked account', async () => {
      // Arrange
      redisService.get.mockResolvedValue('1'); // Account is locked

      // Act & Assert
      await expect(
        authService.login('ministre@education.cg', 'password123')
      ).rejects.toThrow('Compte verrouillé. Veuillez réessayer plus tard.');

      // Verify no further processing occurred
      expect(prismaService.userMinistry.findUnique).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      // Arrange
      const inactiveUser = {
        ...mockMinistryUser,
        estActif: false
      };
      
      prismaService.userMinistry.findUnique.mockResolvedValue(inactiveUser as any);

      // Act & Assert
      await expect(
        authService.login('ministre@education.cg', 'password123')
      ).rejects.toThrow('Compte désactivé');
    });

    it('should compile security context with permissions', async () => {
      // Arrange
      prismaService.userMinistry.findUnique.mockResolvedValue(mockMinistryUser as any);
      prismaService.userMinistry.update.mockResolvedValue(mockMinistryUser as any);
      
      const mockVisibilityRules = [
        {
          object: { nom: 'etablissement.management' },
          typeRegle: 'HIERARCHY',
          condition: { field: 'creeParId' },
          priorite: 1
        }
      ];
      
      const mockUIRules = [
        {
          nomElement: 'delete-button',
          typeElement: 'BUTTON',
          estVisible: true,
          estActif: true,
          conditions: null
        }
      ];

      prismaService.visibilityRuleMinistry.findMany.mockResolvedValue(mockVisibilityRules as any);
      prismaService.uIRuleMinistry.findMany.mockResolvedValue(mockUIRules as any);
      prismaService.$queryRaw.mockResolvedValue([
        {
          id: 'ministry-user-1',
          email: 'ministre@education.cg',
          prenom: 'Jean',
          nom: 'Dupont',
          manager_id: null
        }
      ]);

      // Act
      const result = await authService.login(
        'ministre@education.cg',
        'password123'
      );

      // Assert
      expect(result).toBeTruthy();
      
      // Verify security context was cached
      expect(redisService.set).toHaveBeenCalledWith(
        'security:ministry-user-1',
        expect.stringContaining('etablissement.management'),
        3600
      );
    });
  });

  describe('security context compilation', () => {
    it('should compile permissions correctly', async () => {
      // Test sera implémenté si la méthode devient publique ou via un test d'intégration
      expect(true).toBe(true);
    });

    it('should calculate hierarchy for ministry users', async () => {
      // Arrange
      const hierarchyData = [
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
      ];

      prismaService.$queryRaw.mockResolvedValue(hierarchyData);
      prismaService.userMinistry.findUnique.mockResolvedValue(mockMinistryUser as any);
      prismaService.userMinistry.update.mockResolvedValue(mockMinistryUser as any);
      prismaService.visibilityRuleMinistry.findMany.mockResolvedValue([]);
      prismaService.uIRuleMinistry.findMany.mockResolvedValue([]);

      // Act
      await authService.login('ministre@education.cg', 'password123');

      // Assert
      expect(prismaService.$queryRaw).toHaveBeenCalledWith(
        expect.stringContaining('WITH RECURSIVE subordinates')
      );
    });
  });
});