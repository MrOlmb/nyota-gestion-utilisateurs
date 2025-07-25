import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import * as bcryptjs from 'bcryptjs';

// Mock bcryptjs
jest.mock('bcryptjs');

describe('AuthService - Simple Tests', () => {
  let authService: AuthService;
  let prismaService: any;
  let redisService: any;
  let jwtService: any;

  const mockUser = {
    id: 'user-1',
    email: 'test@education.cg',
    passwordHash: 'hashedpassword',
    prenom: 'Test',
    nom: 'User',
    typeUtilisateur: 'DIRECTEUR',
    estActif: true,
    tentativesEchouees: 0,
    groupesSecurite: [{
      groupId: 'group-1',
      group: {
        permissions: [{
          object: { nom: 'etablissement.management' },
          peutLire: true,
          peutEcrire: true,
          peutCreer: true,
          peutSupprimer: false,
          peutApprouver: true
        }]
      }
    }],
    structure: { id: 'structure-1' },
    departementGeo: null
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
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                JWT_SECRET: 'test-secret',
                JWT_EXPIRES_IN: '15m',
                MAX_LOGIN_ATTEMPTS: 5,
                LOCK_TIME_MINUTES: 30,
                CACHE_TTL_PERMISSIONS: 3600,
                SESSION_TTL_SECONDS: 1800,
              };
              return config[key];
            }),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    prismaService = module.get(PrismaService);
    redisService = module.get(RedisService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('Authentication Flow', () => {
    it('should be defined', () => {
      expect(authService).toBeDefined();
    });

    it('should successfully authenticate a valid user', async () => {
      // Arrange
      (bcryptjs.compare as jest.Mock).mockResolvedValue(true);
      prismaService.userMinistry.findUnique.mockResolvedValue(mockUser);
      prismaService.userSchool.findUnique.mockResolvedValue(null);
      prismaService.userMinistry.update.mockResolvedValue(mockUser);
      prismaService.journalAudit.create.mockResolvedValue({});
      prismaService.visibilityRuleMinistry.findMany.mockResolvedValue([]);
      prismaService.uIRuleMinistry.findMany.mockResolvedValue([]);
      prismaService.$queryRaw.mockResolvedValue([]);
      
      redisService.get.mockResolvedValue(null);
      redisService.set.mockResolvedValue(undefined);
      redisService.sadd.mockResolvedValue(1);
      
      jwtService.signAsync.mockResolvedValue('mock-jwt-token');

      // Act
      const result = await authService.login('test@education.cg', 'password123');

      // Assert
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user).toHaveProperty('id', 'user-1');
      expect(result.user).toHaveProperty('scope', 'MINISTRY');
      
      // Verify password was checked
      expect(bcryptjs.compare).toHaveBeenCalledWith('password123', 'hashedpassword');
      
      // Verify audit log was created
      expect(prismaService.journalAudit.create).toHaveBeenCalled();
    });

    it('should reject invalid credentials', async () => {
      // Arrange
      (bcryptjs.compare as jest.Mock).mockResolvedValue(false);
      prismaService.userMinistry.findUnique.mockResolvedValue(mockUser);
      prismaService.userSchool.findUnique.mockResolvedValue(null);
      redisService.get.mockResolvedValue(null);
      redisService.increment.mockResolvedValue(1);

      // Act & Assert
      await expect(
        authService.login('test@education.cg', 'wrongpassword')
      ).rejects.toThrow('Email ou mot de passe incorrect');
      
      // Verify attempt was recorded
      expect(redisService.increment).toHaveBeenCalledWith('attempts:test@education.cg');
    });

    it('should reject non-existent user', async () => {
      // Arrange
      prismaService.userMinistry.findUnique.mockResolvedValue(null);
      prismaService.userSchool.findUnique.mockResolvedValue(null);
      redisService.get.mockResolvedValue(null);
      redisService.increment.mockResolvedValue(1);

      // Act & Assert
      await expect(
        authService.login('nonexistent@education.cg', 'password123')
      ).rejects.toThrow('Email ou mot de passe incorrect');
    });

    it('should reject locked account', async () => {
      // Arrange
      redisService.get.mockResolvedValue('1'); // Account is locked

      // Act & Assert
      await expect(
        authService.login('test@education.cg', 'password123')
      ).rejects.toThrow('Compte verrouillé');
      
      // Verify no further processing
      expect(prismaService.userMinistry.findUnique).not.toHaveBeenCalled();
    });

    it('should reject inactive user', async () => {
      // Arrange
      (bcryptjs.compare as jest.Mock).mockResolvedValue(true); // Password is correct
      const inactiveUser = { ...mockUser, estActif: false };
      prismaService.userMinistry.findUnique.mockResolvedValue(inactiveUser);
      prismaService.userSchool.findUnique.mockResolvedValue(null);
      redisService.get.mockResolvedValue(null);

      // Act & Assert
      await expect(
        authService.login('test@education.cg', 'password123')
      ).rejects.toThrow('Compte désactivé');
    });
  });
});