import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { SecurityGuard, JwtAuthGuard, PermissionGuard } from './security.guard';
import { PermissionCheckerService, PermissionAction } from '../../security/permissions/permission-checker.service';
import { SecurityContextService } from '../../security/security-context.service';

describe('Security Guards', () => {
  let securityGuard: SecurityGuard;
  let jwtAuthGuard: JwtAuthGuard;
  let permissionGuard: PermissionGuard;
  let reflector: jest.Mocked<Reflector>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let permissionChecker: jest.Mocked<PermissionCheckerService>;
  let securityContextService: jest.Mocked<SecurityContextService>;

  const mockExecutionContext = {
    switchToHttp: () => ({
      getRequest: () => mockRequest,
    }),
    getHandler: () => mockHandler,
  } as ExecutionContext;

  let mockRequest: any;
  let mockHandler: any;

  const validJwtPayload = {
    sub: 'user-1',
    email: 'test@education.cg',
    type: 'DIRECTEUR',
    scope: 'MINISTRY',
    structureId: 'structure-1',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SecurityGuard,
        JwtAuthGuard,
        PermissionGuard,
        {
          provide: Reflector,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const config: Record<string, any> = {
                JWT_SECRET: 'test-secret',
              };
              return config[key];
            }),
          },
        },
        {
          provide: PermissionCheckerService,
          useValue: {
            checkPermission: jest.fn(),
          },
        },
        {
          provide: SecurityContextService,
          useValue: {
            getSecurityContext: jest.fn(),
          },
        },
      ],
    }).compile();

    securityGuard = module.get<SecurityGuard>(SecurityGuard);
    jwtAuthGuard = module.get<JwtAuthGuard>(JwtAuthGuard);
    permissionGuard = module.get<PermissionGuard>(PermissionGuard);
    reflector = module.get(Reflector);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    permissionChecker = module.get(PermissionCheckerService);
    securityContextService = module.get(SecurityContextService);

    // Reset mocks
    jest.clearAllMocks();

    // Setup default mock request
    mockRequest = {
      headers: {
        authorization: 'Bearer valid-jwt-token',
      },
    };

    mockHandler = jest.fn();
  });

  describe('JwtAuthGuard', () => {
    it('should allow access with valid JWT token', async () => {
      // Arrange
      jwtService.verifyAsync.mockResolvedValue(validJwtPayload);

      // Act
      const result = await jwtAuthGuard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
      expect(mockRequest.user).toEqual(validJwtPayload);
      expect(mockRequest.userId).toBe('user-1');
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('valid-jwt-token', {
        secret: 'test-secret',
      });
    });

    it('should reject request without authorization header', async () => {
      // Arrange
      mockRequest.headers = {};

      // Act & Assert
      await expect(jwtAuthGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        UnauthorizedException
      );
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('should reject request with invalid authorization format', async () => {
      // Arrange
      mockRequest.headers.authorization = 'Invalid format';

      // Act & Assert
      await expect(jwtAuthGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        UnauthorizedException
      );
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('should reject request with expired token', async () => {
      // Arrange
      jwtService.verifyAsync.mockRejectedValue(new Error('Token expired'));

      // Act & Assert
      await expect(jwtAuthGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('PermissionGuard', () => {
    beforeEach(() => {
      mockRequest.userId = 'user-1';
      mockRequest.user = validJwtPayload;
    });

    it('should allow access when user has required permission', async () => {
      // Arrange
      const permissionRequirement = {
        businessObject: 'etablissement.management',
        action: PermissionAction.READ,
      };
      reflector.get.mockReturnValue(permissionRequirement);
      permissionChecker.checkPermission.mockResolvedValue({ allowed: true });

      // Act
      const result = await permissionGuard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
      expect(permissionChecker.checkPermission).toHaveBeenCalledWith(
        'user-1',
        'etablissement.management',
        PermissionAction.READ
      );
    });

    it('should deny access when user lacks required permission', async () => {
      // Arrange
      const permissionRequirement = {
        businessObject: 'etablissement.management',
        action: PermissionAction.DELETE,
        message: 'Custom error message',
      };
      reflector.get.mockReturnValue(permissionRequirement);
      permissionChecker.checkPermission.mockResolvedValue({
        allowed: false,
        reason: 'Insufficient permissions',
      });

      // Act & Assert
      await expect(permissionGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should handle multiple permission requirements', async () => {
      // Arrange
      const permissionRequirements = [
        {
          businessObject: 'etablissement.management',
          action: PermissionAction.READ,
        },
        {
          businessObject: 'user.management',
          action: PermissionAction.WRITE,
        },
      ];
      reflector.get.mockReturnValue(permissionRequirements);
      permissionChecker.checkPermission
        .mockResolvedValueOnce({ allowed: true })
        .mockResolvedValueOnce({ allowed: true });

      // Act
      const result = await permissionGuard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
      expect(permissionChecker.checkPermission).toHaveBeenCalledTimes(2);
    });

    it('should deny access if any permission check fails', async () => {
      // Arrange
      const permissionRequirements = [
        {
          businessObject: 'etablissement.management',
          action: PermissionAction.READ,
        },
        {
          businessObject: 'user.management',
          action: PermissionAction.DELETE,
        },
      ];
      reflector.get.mockReturnValue(permissionRequirements);
      permissionChecker.checkPermission
        .mockResolvedValueOnce({ allowed: true })
        .mockResolvedValueOnce({ allowed: false, reason: 'No delete permission' });

      // Act & Assert
      await expect(permissionGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should throw UnauthorizedException when user is not authenticated', async () => {
      // Arrange
      mockRequest.userId = undefined;
      mockRequest.user = undefined;

      // Act & Assert
      await expect(permissionGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('SecurityGuard (Full Integration)', () => {
    beforeEach(() => {
      jwtService.verifyAsync.mockResolvedValue(validJwtPayload);
    });

    it('should allow access when all security checks pass', async () => {
      // Arrange
      const permissionRequirement = {
        businessObject: 'etablissement.management',
        action: PermissionAction.READ,
      };
      reflector.get
        .mockReturnValueOnce(undefined) // authenticated_only
        .mockReturnValueOnce(undefined) // required_scopes
        .mockReturnValueOnce(undefined) // required_user_types
        .mockReturnValueOnce(permissionRequirement); // permissions

      permissionChecker.checkPermission.mockResolvedValue({ allowed: true });

      // Act
      const result = await securityGuard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
      expect(mockRequest.user).toEqual(validJwtPayload);
      expect(mockRequest.userId).toBe('user-1');
    });

    it('should allow access for authenticated-only endpoints', async () => {
      // Arrange
      reflector.get.mockReturnValueOnce(true); // authenticated_only

      // Act
      const result = await securityGuard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
      expect(permissionChecker.checkPermission).not.toHaveBeenCalled();
    });

    it('should enforce scope restrictions', async () => {
      // Arrange
      reflector.get
        .mockReturnValueOnce(undefined) // authenticated_only
        .mockReturnValueOnce(['SCHOOL']); // required_scopes (user has MINISTRY)

      // Act & Assert
      await expect(securityGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should enforce user type restrictions', async () => {
      // Arrange
      reflector.get
        .mockReturnValueOnce(undefined) // authenticated_only
        .mockReturnValueOnce(undefined) // required_scopes
        .mockReturnValueOnce(['MINISTRE']); // required_user_types (user is DIRECTEUR)

      // Act & Assert
      await expect(securityGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should handle ANY permission requirements', async () => {
      // Arrange
      const anyPermissionRequirements = [
        {
          businessObject: 'etablissement.management',
          action: PermissionAction.DELETE,
        },
        {
          businessObject: 'user.management',
          action: PermissionAction.READ,
        },
      ];

      reflector.get
        .mockReturnValueOnce(undefined) // authenticated_only
        .mockReturnValueOnce(undefined) // required_scopes
        .mockReturnValueOnce(undefined) // required_user_types
        .mockReturnValueOnce(undefined) // permissions
        .mockReturnValueOnce(anyPermissionRequirements); // permissions_ANY

      permissionChecker.checkPermission
        .mockResolvedValueOnce({ allowed: false })
        .mockResolvedValueOnce({ allowed: true });

      // Act
      const result = await securityGuard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true); // Should pass because second permission is allowed
    });

    it('should deny access when no ANY permissions are satisfied', async () => {
      // Arrange
      const anyPermissionRequirements = [
        {
          businessObject: 'etablissement.management',
          action: PermissionAction.DELETE,
        },
        {
          businessObject: 'user.management',
          action: PermissionAction.DELETE,
        },
      ];

      reflector.get
        .mockReturnValueOnce(undefined) // authenticated_only
        .mockReturnValueOnce(undefined) // required_scopes
        .mockReturnValueOnce(undefined) // required_user_types
        .mockReturnValueOnce(undefined) // permissions
        .mockReturnValueOnce(anyPermissionRequirements); // permissions_ANY

      permissionChecker.checkPermission
        .mockResolvedValueOnce({ allowed: false })
        .mockResolvedValueOnce({ allowed: false });

      // Act & Assert
      await expect(securityGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException
      );
    });

    it('should handle JWT verification errors', async () => {
      // Arrange
      jwtService.verifyAsync.mockRejectedValue(new Error('Invalid token'));

      // Act & Assert
      await expect(securityGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should handle permission checking errors', async () => {
      // Arrange
      const permissionRequirement = {
        businessObject: 'etablissement.management',
        action: PermissionAction.READ,
      };
      reflector.get
        .mockReturnValueOnce(undefined) // authenticated_only
        .mockReturnValueOnce(undefined) // required_scopes
        .mockReturnValueOnce(undefined) // required_user_types
        .mockReturnValueOnce(permissionRequirement); // permissions

      permissionChecker.checkPermission.mockRejectedValue(new Error('Permission service error'));

      // Act & Assert
      await expect(securityGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should handle missing authorization header', async () => {
      // Arrange
      mockRequest.headers = {};

      // Act & Assert
      await expect(securityGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should validate scope correctly for SCHOOL users', async () => {
      // Arrange
      const schoolUserPayload = {
        ...validJwtPayload,
        scope: 'SCHOOL',
        establishmentId: 'etablissement-1',
      };
      jwtService.verifyAsync.mockResolvedValue(schoolUserPayload);

      reflector.get
        .mockReturnValueOnce(undefined) // authenticated_only
        .mockReturnValueOnce(['SCHOOL']); // required_scopes

      // Act
      const result = await securityGuard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed JWT payload', async () => {
      // Arrange
      jwtService.verifyAsync.mockResolvedValue({ invalid: 'payload' });

      // Act
      const result = await securityGuard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true); // Should still work with incomplete payload
      expect(mockRequest.user).toEqual({ invalid: 'payload' });
    });

    it('should handle empty permission requirements gracefully', async () => {
      // Arrange
      jwtService.verifyAsync.mockResolvedValue(validJwtPayload);
      reflector.get.mockReturnValue(undefined); // No decorators/requirements

      // Act
      const result = await securityGuard.canActivate(mockExecutionContext);

      // Assert
      expect(result).toBe(true);
      expect(permissionChecker.checkPermission).not.toHaveBeenCalled();
    });

    it('should handle permission checker returning undefined', async () => {
      // Arrange
      const permissionRequirement = {
        businessObject: 'etablissement.management',
        action: PermissionAction.READ,
      };
      reflector.get
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce(permissionRequirement);

      permissionChecker.checkPermission.mockResolvedValue(undefined as any);

      // Act & Assert
      await expect(securityGuard.canActivate(mockExecutionContext)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });
});