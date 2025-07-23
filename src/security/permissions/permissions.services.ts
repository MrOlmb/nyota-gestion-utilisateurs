import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { ConfigService } from '@nestjs/config';

export interface PermissionCheck {
  userId: string;
  businessObject: string;
  action: 'read' | 'write' | 'create' | 'delete' | 'approve';
  resourceId?: string;
  establishmentId?: string;
}

export interface DataFilter {
  field: string;
  operator: string;
  value: any;
}

export interface PermissionResult {
  allowed: boolean;
  dataFilters?: DataFilter[];
  uiRestrictions?: any[];
  reason?: string;
}

@Injectable()
export class PermissionsService {
  private readonly CACHE_TTL: number;

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private configService: ConfigService,
  ) {
    this.CACHE_TTL = this.configService.get<number>('CACHE_TTL_PERMISSIONS', 3600);
  }

  /**
   * Algorithme principal de vérification des permissions (4 couches)
   */
  async checkPermission(check: PermissionCheck): Promise<PermissionResult> {
    console.log(`🔐 Vérification permission: ${check.action} sur ${check.businessObject}`);

    // COUCHE 1: Authentification
    const user = await this.verifyAuthentication(check.userId);
    if (!user) {
      return {
        allowed: false,
        reason: 'Utilisateur non authentifié'
      };
    }

    // Récupérer le contexte de sécurité depuis le cache
    let securityContext = await this.getSecurityContext(check.userId);
    
    // Si pas en cache, le recompiler
    if (!securityContext) {
      securityContext = await this.recompileSecurityContext(check.userId);
    }

    // COUCHE 2: Contrôle d'Accès (ACL)
    const aclResult = this.checkACL(securityContext, check);
    if (!aclResult.allowed) {
      return aclResult;
    }

    // COUCHE 3: Règles de Visibilité (RLS)
    const rlsResult = await this.checkRLS(securityContext, check);
    if (!rlsResult.allowed) {
      return rlsResult;
    }

    // COUCHE 4: Contrôle UI
    const uiRules = this.getUIRules(securityContext, check.businessObject);

    return {
      allowed: true,
      dataFilters: rlsResult.dataFilters,
      uiRestrictions: uiRules
    };
  }

  /**
   * COUCHE 1: Vérification de l'authentification
   */
  private async verifyAuthentication(userId: string): Promise<any> {
    // Vérifier si l'utilisateur existe et est actif
    const user = await this.prisma.user.findUnique({
      where: { 
        id: userId,
        isActive: true
      }
    });

    if (!user) {
      return null;
    }

    // Vérifier si le compte n'est pas verrouillé
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return null;
    }

    return user;
  }

  /**
   * COUCHE 2: Vérification ACL (Access Control List)
   */
  private checkACL(context: any, check: PermissionCheck): PermissionResult {
    const permissions = context.permissions[check.businessObject];

    if (!permissions) {
      return {
        allowed: false,
        reason: `Aucune permission définie pour l'objet ${check.businessObject}`
      };
    }

    const hasPermission = permissions[check.action] === true;

    if (!hasPermission) {
      return {
        allowed: false,
        reason: `Action ${check.action} non autorisée sur ${check.businessObject}`
      };
    }

    return { allowed: true };
  }

  /**
   * COUCHE 3: Vérification RLS (Row Level Security)
   */
  private async checkRLS(context: any, check: PermissionCheck): Promise<PermissionResult> {
    const filters = context.dataFilters[check.businessObject];

    if (!filters || filters.length === 0) {
      // Pas de filtres = accès à toutes les données
      return { allowed: true, dataFilters: [] };
    }

    const compiledFilters: DataFilter[] = [];

    for (const filter of filters) {
      switch (filter.type) {
        case 'HIERARCHY':
          const hierarchyFilter = await this.compileHierarchyFilter(context, check);
          if (hierarchyFilter) {
            compiledFilters.push(...hierarchyFilter);
          }
          break;

        case 'GEOGRAPHY':
          const geoFilter = await this.compileGeographyFilter(context, check);
          if (geoFilter) {
            compiledFilters.push(...geoFilter);
          }
          break;

        case 'TENANT':
          const tenantFilter = this.compileTenantFilter(context, check);
          if (tenantFilter) {
            compiledFilters.push(...tenantFilter);
          }
          break;

        case 'OWNERSHIP':
          const ownershipFilter = this.compileOwnershipFilter(context, check);
          if (ownershipFilter) {
            compiledFilters.push(...ownershipFilter);
          }
          break;

        case 'CUSTOM':
          const customFilter = this.compileCustomFilter(filter.condition, context);
          if (customFilter) {
            compiledFilters.push(...customFilter);
          }
          break;
      }
    }

    // Si un resourceId est fourni, vérifier l'accès spécifique
    if (check.resourceId) {
      const hasAccess = await this.verifyResourceAccess(
        check.businessObject,
        check.resourceId,
        compiledFilters
      );

      if (!hasAccess) {
        return {
          allowed: false,
          reason: 'Accès refusé à cette ressource spécifique'
        };
      }
    }

    return {
      allowed: true,
      dataFilters: compiledFilters
    };
  }

  /**
   * Compilation du filtre hiérarchique
   */
  private async compileHierarchyFilter(context: any, check: PermissionCheck): Promise<DataFilter[]> {
    const hierarchy = context.hierarchy;

    if (!hierarchy || hierarchy.subordinates.length === 0) {
      // L'utilisateur n'a pas de subordinés
      return [{
        field: 'assigneeId',
        operator: 'equals',
        value: context.userId
      }];
    }

    // L'utilisateur peut voir ses propres données + celles de ses subordinés
    const subordinateIds = hierarchy.subordinates.map(s => s.id);
    subordinateIds.push(context.userId);

    return [{
      field: 'assigneeId',
      operator: 'in',
      value: subordinateIds
    }];
  }

  /**
   * Compilation du filtre géographique
   */
  private async compileGeographyFilter(context: any, check: PermissionCheck): Promise<DataFilter[]> {
    // Récupérer la zone géographique de l'utilisateur
    const user = await this.prisma.user.findUnique({
      where: { id: context.userId },
      include: {
        establishment: {
          include: {
            region: true,
            department: true
          }
        }
      }
    });

    if (!user?.establishment) {
      return [];
    }

    // Appliquer le filtre selon le niveau géographique
    if (context.userType === 'MINISTRY_STAFF') {
      // Le personnel du ministère peut avoir des restrictions par région
      const userProfile = await this.getUserMinistryProfile(context.userId);
      
      if (userProfile?.regionRestrictions) {
        return [{
          field: 'regionId',
          operator: 'in',
          value: userProfile.regionRestrictions
        }];
      }
    }

    // Par défaut, limiter à l'établissement
    return [{
      field: 'establishmentId',
      operator: 'equals',
      value: user.establishment.id
    }];
  }

  /**
   * Compilation du filtre multi-tenant
   */
  private compileTenantFilter(context: any, check: PermissionCheck): DataFilter[] {
    if (!context.establishmentId) {
      // Utilisateur du ministère - pas de filtre tenant
      return [];
    }

    return [{
      field: 'establishmentId',
      operator: 'equals',
      value: context.establishmentId
    }];
  }

  /**
   * Compilation du filtre de propriété
   */
  private compileOwnershipFilter(context: any, check: PermissionCheck): DataFilter[] {
    return [{
      field: 'createdById',
      operator: 'equals',
      value: context.userId
    }];
  }

  /**
   * Compilation des filtres personnalisés
   */
  private compileCustomFilter(condition: any, context: any): DataFilter[] {
    // Remplacer les variables dans la condition
    const processedCondition = this.processConditionVariables(condition, context);
    
    // Convertir en format DataFilter
    if (Array.isArray(processedCondition)) {
      return processedCondition;
    }

    return [processedCondition];
  }

  /**
   * COUCHE 4: Récupération des règles UI
   */
  private getUIRules(context: any, businessObject: string): any[] {
    return context.uiRules.filter(rule => {
      // Filtrer les règles pertinentes pour l'objet métier
      return rule.element.startsWith(businessObject) || rule.element === '*';
    });
  }

  /**
   * Vérification de l'accès à une ressource spécifique
   */
  private async verifyResourceAccess(
    businessObject: string,
    resourceId: string,
    filters: DataFilter[]
  ): Promise<boolean> {
    // Construire la requête dynamique selon l'objet métier
    let query: any = {
      where: {
        id: resourceId
      }
    };

    // Appliquer les filtres
    for (const filter of filters) {
      if (filter.operator === 'equals') {
        query.where[filter.field] = filter.value;
      } else if (filter.operator === 'in') {
        query.where[filter.field] = { in: filter.value };
      }
    }

    // Mapper l'objet métier vers le modèle Prisma
    const modelMap = {
      'user.profile': 'user',
      'establishment.management': 'establishment',
      'establishment.request': 'establishmentRequest',
      // ... autres mappings
    };

    const model = modelMap[businessObject];
    if (!model) {
      return false;
    }

    // Exécuter la requête
    const result = await this.prisma[model].findUnique(query);
    
    return result !== null;
  }

  /**
   * Récupération du contexte de sécurité depuis le cache
   */
  private async getSecurityContext(userId: string): Promise<any> {
    const key = `security:${userId}`;
    const cached = await this.redisService.get(key);
    
    if (cached) {
      return JSON.parse(cached);
    }
    
    return null;
  }

  /**
   * Recompilation du contexte de sécurité
   */
  private async recompileSecurityContext(userId: string): Promise<any> {
    // Récupérer l'utilisateur avec toutes ses relations
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        userGroups: {
          include: {
            group: {
              include: {
                permissions: {
                  include: {
                    object: true
                  }
                },
                visibilityRules: {
                  include: {
                    object: true
                  },
                  where: {
                    isActive: true
                  }
                },
                uiRules: true
              }
            }
          },
          where: {
            isActive: true,
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: new Date() } }
            ]
          }
        }
      }
    });

    // Compiler le contexte
    const context = await this.compileFullContext(user);

    // Mettre en cache
    await this.cacheContext(userId, context);

    return context;
  }

  /**
   * Traitement des variables dans les conditions
   */
  private processConditionVariables(condition: any, context: any): any {
    let processed = JSON.stringify(condition);
    
    // Remplacer les variables contextuelles
    processed = processed.replace(/\$userId/g, `"${context.userId}"`);
    processed = processed.replace(/\$establishmentId/g, `"${context.establishmentId}"`);
    processed = processed.replace(/\$userType/g, `"${context.userType}"`);
    
    return JSON.parse(processed);
  }

  /**
   * Compilation complète du contexte
   */
  private async compileFullContext(user: any): Promise<any> {
    // Implémentation similaire à celle dans AuthService
    // mais réutilisable ici pour la recompilation
    return {
      userId: user.id,
      userType: user.userType,
      establishmentId: user.establishmentId,
      permissions: this.aggregatePermissions(user.userGroups),
      dataFilters: this.aggregateDataFilters(user.userGroups),
      uiRules: this.aggregateUIRules(user.userGroups),
      hierarchy: await this.getUserHierarchy(user.id),
      lastUpdated: Date.now()
    };
  }

  /**
   * Agrégation des permissions
   */
  private aggregatePermissions(userGroups: any[]): any {
    const permissions = {};
    
    for (const ug of userGroups) {
      for (const perm of ug.group.permissions) {
        const objName = perm.object.name;
        
        if (!permissions[objName]) {
          permissions[objName] = {
            read: false,
            write: false,
            create: false,
            delete: false,
            approve: false
          };
        }
        
        permissions[objName].read ||= perm.canRead;
        permissions[objName].write ||= perm.canWrite;
        permissions[objName].create ||= perm.canCreate;
        permissions[objName].delete ||= perm.canDelete;
        permissions[objName].approve ||= perm.canApprove;
      }
    }
    
    return permissions;
  }

  /**
   * Agrégation des filtres de données
   */
  private aggregateDataFilters(userGroups: any[]): any {
    const filters = {};
    
    for (const ug of userGroups) {
      for (const rule of ug.group.visibilityRules) {
        const objName = rule.object.name;
        
        if (!filters[objName]) {
          filters[objName] = [];
        }
        
        filters[objName].push({
          type: rule.ruleType,
          condition: rule.condition,
          priority: rule.priority
        });
      }
    }
    
    // Trier par priorité
    for (const objName in filters) {
      filters[objName].sort((a, b) => b.priority - a.priority);
    }
    
    return filters;
  }

  /**
   * Agrégation des règles UI
   */
  private aggregateUIRules(userGroups: any[]): any[] {
    const rules = [];
    
    for (const ug of userGroups) {
      for (const rule of ug.group.uiRules) {
        rules.push({
          element: rule.elementName,
          type: rule.elementType,
          visible: rule.isVisible,
          enabled: rule.isEnabled,
          conditions: rule.conditions
        });
      }
    }
    
    return rules;
  }

  /**
   * Récupération de la hiérarchie utilisateur
   */
  private async getUserHierarchy(userId: string): Promise<any> {
    // Utiliser une requête récursive pour obtenir tous les subordinés
    const hierarchy = await this.prisma.$queryRaw`
      WITH RECURSIVE subordinates AS (
        SELECT id, manager_id, 0 as level
        FROM users
        WHERE manager_id = ${userId}::uuid
        
        UNION ALL
        
        SELECT u.id, u.manager_id, s.level + 1
        FROM users u
        INNER JOIN subordinates s ON u.manager_id = s.id
        WHERE u.is_active = true
      )
      SELECT id, level FROM subordinates;
    `;

    return {
      subordinates: hierarchy
    };
  }

  /**
   * Récupération du profil ministériel
   */
  private async getUserMinistryProfile(userId: string): Promise<any> {
    // Implémentation spécifique pour récupérer les restrictions
    // géographiques d'un utilisateur du ministère
    return null; // À implémenter selon les besoins
  }

  /**
   * Mise en cache du contexte
   */
  private async cacheContext(userId: string, context: any): Promise<void> {
    const key = `security:${userId}`;
    await this.redisService.set(key, JSON.stringify(context), this.CACHE_TTL);
  }
}