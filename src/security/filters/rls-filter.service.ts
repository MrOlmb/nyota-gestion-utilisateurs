import { Injectable, Logger } from '@nestjs/common';
import { SecurityContextService, SecurityContextCache } from '../security-context.service';
import { Prisma } from '@prisma/client';

export interface FilterContext {
  userId: string;
  businessObject: string;
  operation: 'read' | 'write' | 'delete';
  additionalContext?: any;
}

export interface CompiledFilter {
  where: any;
  message?: string;
  restrictionLevel: 'NONE' | 'PARTIAL' | 'FULL';
}

export enum RuleType {
  HIERARCHY = 'HIERARCHY',
  GEOGRAPHY = 'GEOGRAPHY', 
  OWNERSHIP = 'OWNERSHIP',
  TENANT = 'TENANT',
  CUSTOM = 'CUSTOM'
}

@Injectable()
export class RLSFilterService {
  private readonly logger = new Logger(RLSFilterService.name);

  constructor(
    private securityContextService: SecurityContextService,
  ) {}

  /**
   * Compile les filtres RLS pour une requête donnée
   */
  async compileFilters(context: FilterContext): Promise<CompiledFilter> {
    try {
      // 1. Récupérer le contexte de sécurité
      const securityContext = await this.securityContextService.getSecurityContext(context.userId);
      
      if (!securityContext) {
        return {
          where: { id: 'never-match' }, // Bloque tout accès
          message: 'Contexte de sécurité introuvable',
          restrictionLevel: 'FULL'
        };
      }

      // 2. Récupérer les règles de visibilité pour cet objet métier
      const dataFilters = securityContext.dataFilters[context.businessObject] || [];
      
      if (dataFilters.length === 0) {
        // Pas de restrictions spécifiques, autoriser tout
        return {
          where: {},
          restrictionLevel: 'NONE'
        };
      }

      // 3. Compiler les filtres selon leur priorité
      const compiledConditions: any[] = [];
      
      for (const filter of dataFilters) {
        const condition = await this.compileRuleCondition(
          filter.type as RuleType,
          filter.condition,
          securityContext,
          context
        );
        
        if (condition) {
          compiledConditions.push(condition);
        }
      }

      // 4. Combiner les conditions (OR logique entre les règles)
      const finalFilter = compiledConditions.length > 0 
        ? { OR: compiledConditions }
        : {};

      return {
        where: finalFilter,
        restrictionLevel: compiledConditions.length > 0 ? 'PARTIAL' : 'NONE'
      };

    } catch (error) {
      this.logger.error(`Error compiling RLS filters for user ${context.userId}:`, error);
      
      // En cas d'erreur, bloquer l'accès par sécurité
      return {
        where: { id: 'never-match' },
        message: 'Erreur lors de la compilation des filtres de sécurité',
        restrictionLevel: 'FULL'
      };
    }
  }

  /**
   * Applique les filtres RLS à une requête Prisma existante
   */
  async applyFiltersToQuery<T>(
    context: FilterContext,
    query: T & { where?: any }
  ): Promise<T & { where: any }> {
    const filters = await this.compileFilters(context);
    
    // Combiner les filtres RLS avec les filtres existants de la requête
    const existingWhere = query.where || {};
    const combinedWhere = {
      AND: [
        existingWhere,
        filters.where
      ]
    };

    return {
      ...query,
      where: combinedWhere
    };
  }

  /**
   * Compile une condition de règle selon son type
   */
  private async compileRuleCondition(
    ruleType: RuleType,
    condition: any,
    securityContext: SecurityContextCache,
    filterContext: FilterContext
  ): Promise<any> {
    switch (ruleType) {
      case RuleType.HIERARCHY:
        return this.compileHierarchyRule(condition, securityContext);
        
      case RuleType.GEOGRAPHY:
        return this.compileGeographyRule(condition, securityContext);
        
      case RuleType.OWNERSHIP:
        return this.compileOwnershipRule(condition, securityContext);
        
      case RuleType.TENANT:
        return this.compileTenantRule(condition, securityContext);
        
      case RuleType.CUSTOM:
        return this.compileCustomRule(condition, securityContext, filterContext);
        
      default:
        this.logger.warn(`Unknown rule type: ${ruleType}`);
        return null;
    }
  }

  /**
   * Règles hiérarchiques - L'utilisateur ne voit que ses données et celles de ses subordinés
   */
  private compileHierarchyRule(condition: any, securityContext: SecurityContextCache): any {
    if (securityContext.userScope !== 'MINISTRY' || !securityContext.hierarchy) {
      return null;
    }

    const subordinateIds = securityContext.hierarchy.subordinates.map(s => s.id);
    const allowedUserIds = [securityContext.userId, ...subordinateIds];

    // Le champ à filtrer peut être configuré dans la condition
    const targetField = condition.field || 'creeParId';
    
    return {
      [targetField]: {
        in: allowedUserIds
      }
    };
  }

  /**
   * Règles géographiques - Filtrage par département/région
   */
  private compileGeographyRule(condition: any, securityContext: SecurityContextCache): any {
    const filters: any[] = [];

    // Filtrage par département géographique (pour les utilisateurs ministère)
    if (securityContext.userScope === 'MINISTRY' && condition.restrictByDepartement) {
      // Si l'utilisateur a une restriction géographique
      if (securityContext.structureId) {
        filters.push({
          departementId: securityContext.structureId
        });
      }
    }

    // Filtrage par établissement (pour les utilisateurs école)
    if (securityContext.userScope === 'SCHOOL' && condition.restrictByEtablissement) {
      if (securityContext.etablissementId) {
        filters.push({
          etablissementId: securityContext.etablissementId
        });
      }
    }

    return filters.length > 0 ? { OR: filters } : null;
  }

  /**
   * Règles de propriété - L'utilisateur ne voit que ce qu'il a créé/modifié
   */
  private compileOwnershipRule(condition: any, securityContext: SecurityContextCache): any {
    const ownershipFields: any[] = [];

    // Données créées par l'utilisateur
    if (condition.includeCreated) {
      ownershipFields.push({
        creeParId: securityContext.userId
      });
    }

    // Données modifiées par l'utilisateur
    if (condition.includeModified) {
      ownershipFields.push({
        modifieParId: securityContext.userId
      });
    }

    // Données assignées à l'utilisateur
    if (condition.includeAssigned) {
      ownershipFields.push({
        assigneId: securityContext.userId
      });
    }

    return ownershipFields.length > 0 ? { OR: ownershipFields } : null;
  }

  /**
   * Règles de tenant - Isolation stricte par établissement
   */
  private compileTenantRule(condition: any, securityContext: SecurityContextCache): any {
    if (securityContext.userScope === 'SCHOOL') {
      // Les utilisateurs école ne voient que les données de leur établissement
      return {
        etablissementId: securityContext.etablissementId
      };
    }

    // Les utilisateurs ministère peuvent voir plusieurs établissements selon leurs permissions
    if (condition.allowMultipleEstablishments && securityContext.userScope === 'MINISTRY') {
      // Logique spécifique selon le rôle ministériel
      return this.getMinistryEstablishmentFilter(securityContext);
    }

    return null;
  }

  /**
   * Règles personnalisées - Logique métier spécifique
   */
  private compileCustomRule(
    condition: any,
    securityContext: SecurityContextCache,
    filterContext: FilterContext
  ): any {
    // Règles spécifiques par objet métier
    switch (filterContext.businessObject) {
      case 'etablissement.management':
        return this.compileEstablishmentCustomRules(condition, securityContext);
        
      case 'inspection.management':
        return this.compileInspectionCustomRules(condition, securityContext);
        
      case 'user.management':
        return this.compileUserManagementCustomRules(condition, securityContext);
        
      default:
        // Appliquer la condition directement si elle est en format Prisma
        return condition.prismaCondition || null;
    }
  }

  /**
   * Règles personnalisées pour la gestion des établissements
   */
  private compileEstablishmentCustomRules(condition: any, securityContext: SecurityContextCache): any {
    const filters: any[] = [];

    // Les directeurs d'académie ne voient que leur région
    if (securityContext.userType === 'DIRECTEUR' && condition.restrictByRegion) {
      // Cette logique dépend de votre modèle de données
      // filters.push({ region: userRegion });
    }

    // Les inspecteurs ne voient que leurs établissements assignés
    if (securityContext.userType === 'INSPECTEUR' && condition.restrictByAssignment) {
      // Requête pour récupérer les établissements assignés à cet inspecteur
      // Cette logique peut être étendue selon vos besoins
    }

    return filters.length > 0 ? { OR: filters } : null;
  }

  /**
   * Règles personnalisées pour les inspections
   */
  private compileInspectionCustomRules(condition: any, securityContext: SecurityContextCache): any {
    if (securityContext.userScope !== 'MINISTRY') {
      // Les utilisateurs école ne peuvent pas voir les inspections
      return { id: 'never-match' };
    }

    const filters: any[] = [];

    // L'inspecteur principal peut voir ses inspections
    filters.push({
      inspecteurPrincipalId: securityContext.userId
    });

    // Les supérieurs hiérarchiques peuvent voir les inspections de leurs subordinés
    if (securityContext.hierarchy && securityContext.hierarchy.subordinates.length > 0) {
      const subordinateIds = securityContext.hierarchy.subordinates.map(s => s.id);
      filters.push({
        inspecteurPrincipalId: { in: subordinateIds }
      });
    }

    return { OR: filters };
  }

  /**
   * Règles personnalisées pour la gestion des utilisateurs
   */
  private compileUserManagementCustomRules(condition: any, securityContext: SecurityContextCache): any {
    const filters: any[] = [];

    if (securityContext.userScope === 'MINISTRY') {
      // Les utilisateurs ministère peuvent gérer d'autres utilisateurs ministère
      if (condition.allowMinistryUsers) {
        filters.push({
          // Cette condition dépend de votre structure de données
          userScope: 'MINISTRY'
        });
      }
    } else {
      // Les utilisateurs école ne peuvent gérer que les utilisateurs de leur établissement
      filters.push({
        etablissementId: securityContext.etablissementId
      });
    }

    return filters.length > 0 ? { OR: filters } : null;
  }

  /**
   * Détermine les établissements accessibles pour un utilisateur ministère
   */
  private getMinistryEstablishmentFilter(securityContext: SecurityContextCache): any {
    // Logique selon le type d'utilisateur ministère
    switch (securityContext.userType) {
      case 'MINISTRE':
      case 'SECRETAIRE_GENERAL':
        // Accès à tous les établissements
        return {};
        
      case 'DIRECTEUR':
        // Accès selon la structure administrative
        if (securityContext.structureId) {
          return {
            // Établissements de la structure/région
            // Cette logique dépend de votre modèle de données
          };
        }
        break;
        
      case 'INSPECTEUR':
        // Établissements assignés pour inspection
        return {
          // Cette logique nécessite une table de liaison inspecteur-établissement
        };
        
      default:
        // Accès restreint par défaut
        return { id: 'never-match' };
    }

    return {};
  }

  /**
   * Utilitaire pour tester une règle de visibilité
   */
  async testVisibilityRule(
    userId: string,
    businessObject: string,
    sampleData: any
  ): Promise<boolean> {
    const filterContext: FilterContext = {
      userId,
      businessObject,
      operation: 'read'
    };

    const filters = await this.compileFilters(filterContext);
    
    // Simuler une requête Prisma pour voir si les données passent le filtre
    try {
      // Cette logique est simplifiée - dans un vrai test, 
      // vous devriez utiliser Prisma pour vérifier le filtre
      return this.evaluateFilterCondition(filters.where, sampleData);
    } catch (error) {
      this.logger.error('Error testing visibility rule:', error);
      return false;
    }
  }

  /**
   * Évalue si des données correspondent à une condition de filtre
   */
  private evaluateFilterCondition(filterCondition: any, data: any): boolean {
    // Si pas de condition de filtrage, autoriser
    if (!filterCondition || Object.keys(filterCondition).length === 0) {
      return true;
    }

    // Si condition contient "never-match", c'est un blocage complet
    if (filterCondition.id === 'never-match') {
      return false;
    }

    // Logique simplifiée pour les tests
    // Dans une vraie implémentation, ceci serait fait par Prisma
    return this.evaluateConditionRecursive(filterCondition, data);
  }

  /**
   * Évalue récursivement une condition de filtre
   */
  private evaluateConditionRecursive(condition: any, data: any): boolean {
    if (condition.OR && Array.isArray(condition.OR)) {
      return condition.OR.some((subCondition: any) => 
        this.evaluateConditionRecursive(subCondition, data)
      );
    }

    if (condition.AND && Array.isArray(condition.AND)) {
      return condition.AND.every((subCondition: any) => 
        this.evaluateConditionRecursive(subCondition, data)
      );
    }

    // Évaluer les conditions simples
    for (const [field, value] of Object.entries(condition)) {
      if (typeof value === 'object' && value !== null) {
        if ('in' in value && Array.isArray(value.in)) {
          if (!value.in.includes(data[field])) {
            return false;
          }
        } else if ('equals' in value) {
          if (data[field] !== value.equals) {
            return false;
          }
        }
      } else {
        if (data[field] !== value) {
          return false;
        }
      }
    }

    return true;
  }
}