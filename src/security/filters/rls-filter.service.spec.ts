import { Test, TestingModule } from '@nestjs/testing';
import { RLSFilterService, FilterContext, RuleType } from './rls-filter.service';
import { SecurityContextService, SecurityContextCache } from '../security-context.service';

describe('RLSFilterService', () => {
  let rlsFilterService: RLSFilterService;
  let securityContextService: jest.Mocked<SecurityContextService>;

  const mockMinistrySecurityContext: SecurityContextCache = {
    userId: 'ministry-user-1',
    userScope: 'MINISTRY',
    userType: 'DIRECTEUR',
    structureId: 'structure-1',
    permissions: {},
    dataFilters: {
      'etablissement.management': [
        {
          type: 'HIERARCHY',
          condition: { field: 'creeParId' },
          priority: 1
        },
        {
          type: 'GEOGRAPHY',
          condition: { restrictByDepartement: true },
          priority: 2
        }
      ],
      'user.management': [
        {
          type: 'OWNERSHIP',
          condition: { includeCreated: true, includeAssigned: true },
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
        },
        {
          id: 'subordinate-2',
          email: 'subordinate2@ministere.cg',
          fullName: 'Marie Subordinate',
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
    permissions: {},
    dataFilters: {
      'student.management': [
        {
          type: 'TENANT',
          condition: { allowMultipleEstablishments: false },
          priority: 1
        }
      ],
      'etablissement.management': [
        {
          type: 'GEOGRAPHY',
          condition: { restrictByEtablissement: true },
          priority: 1
        }
      ]
    },
    uiRules: [],
    lastUpdated: Date.now()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RLSFilterService,
        {
          provide: SecurityContextService,
          useValue: {
            getSecurityContext: jest.fn(),
          },
        },
      ],
    }).compile();

    rlsFilterService = module.get<RLSFilterService>(RLSFilterService);
    securityContextService = module.get(SecurityContextService);
  });

  describe('compileFilters', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return no restrictions when no data filters exist', async () => {
      // Arrange
      const contextWithoutFilters = {
        ...mockMinistrySecurityContext,
        dataFilters: {}
      };
      securityContextService.getSecurityContext.mockResolvedValue(contextWithoutFilters);

      const filterContext: FilterContext = {
        userId: 'ministry-user-1',
        businessObject: 'some.object',
        operation: 'read'
      };

      // Act
      const result = await rlsFilterService.compileFilters(filterContext);

      // Assert
      expect(result.where).toEqual({});
      expect(result.restrictionLevel).toBe('NONE');
    });

    it('should block all access when no security context', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(null);

      const filterContext: FilterContext = {
        userId: 'unknown-user',
        businessObject: 'etablissement.management',
        operation: 'read'
      };

      // Act
      const result = await rlsFilterService.compileFilters(filterContext);

      // Assert
      expect(result.where).toEqual({ id: 'never-match' });
      expect(result.restrictionLevel).toBe('FULL');
      expect(result.message).toContain('Contexte de sécurité introuvable');
    });

    it('should compile hierarchy rules correctly for ministry users', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockMinistrySecurityContext);

      const filterContext: FilterContext = {
        userId: 'ministry-user-1',
        businessObject: 'etablissement.management',
        operation: 'read'
      };

      // Act
      const result = await rlsFilterService.compileFilters(filterContext);

      // Assert
      expect(result.restrictionLevel).toBe('PARTIAL');
      expect(result.where).toHaveProperty('OR');
      
      const orConditions = result.where.OR;
      expect(orConditions).toBeInstanceOf(Array);
      
      // Should include hierarchy rule (user + subordinates)
      const hierarchyCondition = orConditions.find((condition: any) => 
        condition.creeParId && condition.creeParId.in
      );
      expect(hierarchyCondition).toBeDefined();
      expect(hierarchyCondition.creeParId.in).toContain('ministry-user-1');
      expect(hierarchyCondition.creeParId.in).toContain('subordinate-1');
      expect(hierarchyCondition.creeParId.in).toContain('subordinate-2');
    });

    it('should compile geography rules for ministry users with structure restriction', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockMinistrySecurityContext);

      const filterContext: FilterContext = {
        userId: 'ministry-user-1',
        businessObject: 'etablissement.management',
        operation: 'read'
      };

      // Act
      const result = await rlsFilterService.compileFilters(filterContext);

      // Assert
      const orConditions = result.where.OR;
      
      // Should include geography rule
      const geographyCondition = orConditions.find((condition: any) => 
        condition.OR && condition.OR.some((subCondition: any) => subCondition.departementId)
      );
      expect(geographyCondition).toBeDefined();
    });

    it('should compile tenant rules for school users', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockSchoolSecurityContext);

      const filterContext: FilterContext = {
        userId: 'school-user-1',
        businessObject: 'student.management',
        operation: 'read'
      };

      // Act
      const result = await rlsFilterService.compileFilters(filterContext);

      // Assert
      expect(result.restrictionLevel).toBe('PARTIAL');
      
      const orConditions = result.where.OR;
      const tenantCondition = orConditions.find((condition: any) => 
        condition.etablissementId === 'etablissement-1'
      );
      expect(tenantCondition).toBeDefined();
    });

    it('should compile ownership rules correctly', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockMinistrySecurityContext);

      const filterContext: FilterContext = {
        userId: 'ministry-user-1',
        businessObject: 'user.management',
        operation: 'read'
      };

      // Act
      const result = await rlsFilterService.compileFilters(filterContext);

      // Assert
      const orConditions = result.where.OR;
      
      // Should include ownership conditions
      const ownershipCondition = orConditions.find((condition: any) => 
        condition.OR && condition.OR.some((subCondition: any) => 
          subCondition.creeParId === 'ministry-user-1' || 
          subCondition.assigneId === 'ministry-user-1'
        )
      );
      expect(ownershipCondition).toBeDefined();
    });

    it('should handle custom rules for specific business objects', async () => {
      // Arrange
      const contextWithCustomRules = {
        ...mockMinistrySecurityContext,
        dataFilters: {
          'inspection.management': [
            {
              type: 'CUSTOM',
              condition: { customRule: 'inspection_visibility' },
              priority: 1
            }
          ]
        }
      };
      securityContextService.getSecurityContext.mockResolvedValue(contextWithCustomRules);

      const filterContext: FilterContext = {
        userId: 'ministry-user-1',
        businessObject: 'inspection.management',
        operation: 'read'
      };

      // Act
      const result = await rlsFilterService.compileFilters(filterContext);

      // Assert
      expect(result.restrictionLevel).toBe('PARTIAL');
      
      // Should include inspection-specific rules
      const orConditions = result.where.OR;
      const inspectionCondition = orConditions.find((condition: any) => 
        condition.OR && condition.OR.some((subCondition: any) => 
          subCondition.inspecteurPrincipalId === 'ministry-user-1'
        )
      );
      expect(inspectionCondition).toBeDefined();
    });

    it('should block school users from inspection data', async () => {
      // Arrange
      const contextWithInspectionRules = {
        ...mockSchoolSecurityContext,
        dataFilters: {
          'inspection.management': [
            {
              type: 'CUSTOM',
              condition: {},
              priority: 1
            }
          ]
        }
      };
      securityContextService.getSecurityContext.mockResolvedValue(contextWithInspectionRules);

      const filterContext: FilterContext = {
        userId: 'school-user-1',
        businessObject: 'inspection.management',
        operation: 'read'
      };

      // Act
      const result = await rlsFilterService.compileFilters(filterContext);

      // Assert
      expect(result.where.OR).toContainEqual({ id: 'never-match' });
    });

    it('should handle service errors gracefully', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockRejectedValue(new Error('Service error'));

      const filterContext: FilterContext = {
        userId: 'ministry-user-1',
        businessObject: 'etablissement.management',
        operation: 'read'
      };

      // Act
      const result = await rlsFilterService.compileFilters(filterContext);

      // Assert
      expect(result.where).toEqual({ id: 'never-match' });
      expect(result.restrictionLevel).toBe('FULL');
      expect(result.message).toContain('Erreur lors de la compilation des filtres de sécurité');
    });
  });

  describe('applyFiltersToQuery', () => {
    it('should combine RLS filters with existing query filters', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockMinistrySecurityContext);

      const filterContext: FilterContext = {
        userId: 'ministry-user-1',
        businessObject: 'etablissement.management',
        operation: 'read'
      };

      const existingQuery = {
        where: {
          estActif: true,
          typeEtablissement: 'PRIMAIRE'
        },
        include: {
          departement: true
        }
      };

      // Act
      const result = await rlsFilterService.applyFiltersToQuery(filterContext, existingQuery);

      // Assert
      expect(result.where).toHaveProperty('AND');
      expect(result.where.AND).toHaveLength(2);
      expect(result.where.AND[0]).toEqual(existingQuery.where);
      expect(result.where.AND[1]).toHaveProperty('OR'); // RLS filters
      expect(result.include).toEqual(existingQuery.include);
    });

    it('should handle empty existing query', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockMinistrySecurityContext);

      const filterContext: FilterContext = {
        userId: 'ministry-user-1',
        businessObject: 'etablissement.management',
        operation: 'read'
      };

      const emptyQuery = {};

      // Act
      const result = await rlsFilterService.applyFiltersToQuery(filterContext, emptyQuery);

      // Assert
      expect(result.where).toHaveProperty('AND');
      expect(result.where.AND[0]).toEqual({});
      expect(result.where.AND[1]).toHaveProperty('OR');
    });
  });

  describe('testVisibilityRule', () => {
    it('should test if data passes visibility rules', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockMinistrySecurityContext);

      const sampleData = {
        id: 'etablissement-1',
        creeParId: 'ministry-user-1',
        nom: 'École Test'
      };

      // Act
      const result = await rlsFilterService.testVisibilityRule(
        'ministry-user-1',
        'etablissement.management',
        sampleData
      );

      // Assert
      expect(result).toBe(true); // Should pass since user created the data
    });

    it('should handle test errors gracefully', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockRejectedValue(new Error('Test error'));

      const sampleData = {
        id: 'etablissement-1',
        nom: 'École Test'
      };

      // Act
      const result = await rlsFilterService.testVisibilityRule(
        'ministry-user-1',
        'etablissement.management',
        sampleData
      );

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('rule compilation edge cases', () => {
    it('should handle users without hierarchy', async () => {
      // Arrange
      const contextWithoutHierarchy = {
        ...mockMinistrySecurityContext,
        hierarchy: null
      };
      securityContextService.getSecurityContext.mockResolvedValue(contextWithoutHierarchy);

      const filterContext: FilterContext = {
        userId: 'ministry-user-1',
        businessObject: 'etablissement.management',
        operation: 'read'
      };

      // Act
      const result = await rlsFilterService.compileFilters(filterContext);

      // Assert
      expect(result.restrictionLevel).toBe('PARTIAL');
      // Should still apply geography rules even without hierarchy
      expect(result.where.OR).toBeDefined();
    });

    it('should handle school users with geography rules', async () => {
      // Arrange
      securityContextService.getSecurityContext.mockResolvedValue(mockSchoolSecurityContext);

      const filterContext: FilterContext = {
        userId: 'school-user-1',
        businessObject: 'etablissement.management',
        operation: 'read'
      };

      // Act
      const result = await rlsFilterService.compileFilters(filterContext);

      // Assert
      expect(result.restrictionLevel).toBe('PARTIAL');
      expect(result.where).toHaveProperty('OR');
      
      const orConditions = result.where.OR;
      expect(orConditions).toBeInstanceOf(Array);
      expect(orConditions.length).toBeGreaterThan(0);
      
      // The exact structure may vary based on implementation
      // Just verify that some geographic restriction is applied
      const hasGeographicRestriction = orConditions.some((condition: any) => 
        condition.etablissementId === 'etablissement-1' ||
        (condition.OR && condition.OR.some((subCondition: any) => 
          subCondition.etablissementId === 'etablissement-1'))
      );
      expect(hasGeographicRestriction).toBe(true);
    });

    it('should apply ministry establishment filters for different user types', async () => {
      // Arrange
      const ministreContext = {
        ...mockMinistrySecurityContext,
        userType: 'MINISTRE' as any
      };
      securityContextService.getSecurityContext.mockResolvedValue(ministreContext);

      const filterContext: FilterContext = {
        userId: 'ministry-user-1',
        businessObject: 'etablissement.management',
        operation: 'read'
      };

      // Act
      const result = await rlsFilterService.compileFilters(filterContext);

      // Assert
      expect(result.restrictionLevel).toBe('PARTIAL');
      // Ministre should have broader access
      expect(result.where.OR).toBeDefined();
    });
  });
});