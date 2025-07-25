import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PermissionCheckerService, PermissionAction } from './permission-checker.service';
import { SecurityContextService, SecurityContextCache } from '../security-context.service';

describe('PermissionCheckerService', () => {
  let permissionChecker: PermissionCheckerService;
  let securityContextService: jest.Mocked<SecurityContextService>;

  const mockMinistrySecurityContext: SecurityContextCache = {
    userId: 'ministry-user-1',
    userScope: 'MINISTRY',
    userType: 'DIRECTEUR',
    structureId: 'structure-1',
    permissions: {
      'etablissement.management': {
        read: true,
        write: true,
        create: true,
        delete: false,
        approve: true
      },
      'user.management': {
        read: true,
        write: true,
        create: false,
        delete: false,
        approve: false
      },
      'global.admin': {
        read: false,
        write: false,
        create: false,
        delete: false,
        approve: false
      }
    },
    dataFilters: {
      'etablissement.management': [
        {
          type: 'HIERARCHY',
          condition: { field: 'creeParId' },
          priority: 1
        }
      ]
    },
    uiRules: [],
    hierarchy: {
      managerId: null,
      subordinates: [
        {
          id: 'subordinate-1',
          email: 'subordinate@ministere.cg',
          fullName: 'Jean Subordinate',
          level: 1
        }
      ],
      level: 0
    },
    lastUpdated: Date.now()
  };

  const mockSchoolSecurityContext: SecurityContextCache = {
    userId: 'school-user-1',
    userScope: 'SCHOOL',
    userType: 'DIRECTEUR',
    etablissementId: 'etablissement-1',
    permissions: {
      'student.management': {
        read: true,
        write: true,
        create: true,
        delete: false,
        approve: false
      },
      'teacher.management': {
        read: true,
        write: false,
        create: false,
        delete: false,
        approve: false
      }
    },
    dataFilters: {},
    uiRules: [],
    lastUpdated: Date.now()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionCheckerService,
        {
          provide: SecurityContextService,
          useValue: {
            getSecurityContext: jest.fn(),
          },
        },
      ],
    }).compile();

    permissionChecker = module.get<PermissionCheckerService>(PermissionCheckerService);
    securityContextService = module.get(SecurityContextService);
  });

  describe('checkPermission', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should allow access when user has required permission', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockMinistrySecurityContext);

      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-1',
        'etablissement.management',
        PermissionAction.READ
      );

      // Assert
      expect(result.allowed).toBe(true);
      expect(securityContextService.getSecurityContext).toHaveBeenCalledWith('ministry-user-1');
    });

    it('should deny access when user lacks required permission', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockMinistrySecurityContext);

      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-1',
        'etablissement.management',
        PermissionAction.DELETE
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Permission delete refusée');
    });

    it('should deny access when user has no permissions for business object', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockMinistrySecurityContext);

      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-1',
        'unknown.object',
        PermissionAction.READ
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Aucune permission définie pour l\'objet unknown.object');
    });

    it('should deny access when security context is not found', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(null);

      // Act
      const result = await permissionChecker.checkPermission(
        'unknown-user',
        'etablissement.management',
        PermissionAction.READ
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Contexte de sécurité introuvable');
    });

    it('should apply establishment context rules for school users', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockSchoolSecurityContext);

      // Act
      const result = await permissionChecker.checkPermission(
        'school-user-1',
        'etablissement.management',
        PermissionAction.READ,
        { etablissementId: 'other-etablissement' }
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Accès autorisé uniquement pour votre établissement');
    });

    it('should allow access when school user accesses own establishment', async () => {
      // Arrange
      const contextWithPermission = {
        ...mockSchoolSecurityContext,
        permissions: {
          ...mockSchoolSecurityContext.permissions,
          'etablissement.management': {
            read: true,
            write: false,
            create: false,
            delete: false,
            approve: false
          }
        }
      };
      securityContextService.getSecurityContext.mockResolvedValue(contextWithPermission);

      // Act
      const result = await permissionChecker.checkPermission(
        'school-user-1',
        'etablissement.management',
        PermissionAction.READ,
        { etablissementId: 'etablissement-1' }
      );

      // Assert
      expect(result.allowed).toBe(true);
    });
  });

  describe('checkMultiplePermissions', () => {
    it('should check multiple permissions efficiently', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockMinistrySecurityContext);

      const checks = [
        { businessObject: 'etablissement.management', action: PermissionAction.READ },
        { businessObject: 'etablissement.management', action: PermissionAction.WRITE },
        { businessObject: 'etablissement.management', action: PermissionAction.DELETE },
        { businessObject: 'user.management', action: PermissionAction.READ }
      ];

      // Act
      const results = await permissionChecker.checkMultiplePermissions('ministry-user-1', checks);

      // Assert
      expect(securityContextService.getSecurityContext).toHaveBeenCalledTimes(1); // Efficient caching
      expect(results['etablissement.management.read'].allowed).toBe(true);
      expect(results['etablissement.management.write'].allowed).toBe(true);
      expect(results['etablissement.management.delete'].allowed).toBe(false);
      expect(results['user.management.read'].allowed).toBe(true);
    });

    it('should deny all permissions when no security context', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(null);

      const checks = [
        { businessObject: 'etablissement.management', action: PermissionAction.READ },
        { businessObject: 'user.management', action: PermissionAction.WRITE }
      ];

      // Act
      const results = await permissionChecker.checkMultiplePermissions('unknown-user', checks);

      // Assert
      expect(results['etablissement.management.read'].allowed).toBe(false);
      expect(results['user.management.write'].allowed).toBe(false);
      expect(results['etablissement.management.read'].reason).toBe('Contexte de sécurité introuvable');
    });
  });

  describe('requirePermission', () => {
    it('should not throw when user has permission', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockMinistrySecurityContext);

      // Act & Assert
      await expect(
        permissionChecker.requirePermission(
          'ministry-user-1',
          'etablissement.management',
          PermissionAction.READ
        )
      ).resolves.not.toThrow();
    });

    it('should throw ForbiddenException when user lacks permission', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockMinistrySecurityContext);

      // Act & Assert
      await expect(
        permissionChecker.requirePermission(
          'ministry-user-1',
          'etablissement.management',
          PermissionAction.DELETE
        )
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getUserPermissions', () => {
    it('should return user permissions for business object', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockMinistrySecurityContext);

      // Act
      const permissions = await permissionChecker.getUserPermissions(
        'ministry-user-1',
        'etablissement.management'
      );

      // Assert
      expect(permissions).toEqual({
        read: true,
        write: true,
        create: true,
        delete: false,
        approve: true
      });
    });

    it('should return default permissions when object not found', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockMinistrySecurityContext);

      // Act
      const permissions = await permissionChecker.getUserPermissions(
        'ministry-user-1',
        'unknown.object'
      );

      // Assert
      expect(permissions).toEqual({
        read: false,
        write: false,
        create: false,
        delete: false,
        approve: false
      });
    });

    it('should return default permissions when no security context', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(null);

      // Act
      const permissions = await permissionChecker.getUserPermissions(
        'unknown-user',
        'etablissement.management'
      );

      // Assert
      expect(permissions).toEqual({
        read: false,
        write: false,
        create: false,
        delete: false,
        approve: false
      });
    });
  });

  describe('getUserAccessibleObjects', () => {
    it('should return objects user has access to', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockMinistrySecurityContext);

      // Act
      const objects = await permissionChecker.getUserAccessibleObjects('ministry-user-1');

      // Assert
      expect(objects).toContain('etablissement.management');
      expect(objects).toContain('user.management');
      expect(objects).not.toContain('global.admin'); // No permissions
    });

    it('should return empty array when no security context', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(null);

      // Act
      const objects = await permissionChecker.getUserAccessibleObjects('unknown-user');

      // Assert
      expect(objects).toEqual([]);
    });
  });

  describe('contextual permission rules', () => {
    it('should prevent user from deleting their own account', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue({
        ...mockMinistrySecurityContext,
        permissions: {
          'user.management': {
            read: true,
            write: true,
            create: true,
            delete: true,
            approve: false
          }
        }
      });

      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-1',
        'user.management',
        PermissionAction.DELETE,
        { targetUserId: 'ministry-user-1' }
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Impossible de supprimer son propre compte');
    });

    it('should allow hierarchy-based user management', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockMinistrySecurityContext);

      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-1',
        'user.management',
        PermissionAction.WRITE,
        { targetUserId: 'subordinate-1' }
      );

      // Assert
      expect(result.allowed).toBe(true);
    });

    it('should deny access to non-subordinate user management', async () => {
      // Arrange
      const contextWithoutGlobalPermission = {
        ...mockMinistrySecurityContext,
        permissions: {
          ...mockMinistrySecurityContext.permissions,
          'global.user.management': {
            read: false,
            write: false,
            create: false,
            delete: false,
            approve: false
          }
        }
      };
      securityContextService.getSecurityContext.mockResolvedValue(contextWithoutGlobalPermission);

      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-1',
        'user.management',
        PermissionAction.WRITE,
        { targetUserId: 'other-user-not-subordinate' }
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Gestion autorisée uniquement pour vos subordinés directs');
    });

    it('should restrict inspections to ministry users only', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockSchoolSecurityContext);

      // Act
      const result = await permissionChecker.checkPermission(
        'school-user-1',
        'inspection.management',
        PermissionAction.READ
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Les inspections sont réservées au personnel du ministère');
    });

    it('should restrict inspection approval to authorized user types', async () => {
      // Arrange
      const analystContext = {
        ...mockMinistrySecurityContext,
        userType: 'ANALYSTE' as any,
        permissions: {
          'inspection.management': {
            read: true,
            write: true,
            create: true,
            delete: false,
            approve: true // Permission granted but should be denied by type
          }
        }
      };
      securityContextService.getSecurityContext.mockResolvedValue(analystContext);

      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-1',
        'inspection.management',
        PermissionAction.APPROVE
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Seuls les inspecteurs et cadres supérieurs peuvent approuver');
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockRejectedValue(new Error('Service error'));

      // Act
      const result = await permissionChecker.checkPermission(
        'ministry-user-1',
        'etablissement.management',
        PermissionAction.READ
      );

      // Assert
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Erreur lors de la vérification des permissions');
    });
  });
});