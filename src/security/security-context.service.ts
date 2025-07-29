import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { ConfigService } from '@nestjs/config';
import { UserMinistry, UserSchool, UserMinistryType, UserSchoolType } from '@prisma/client';

export interface SecurityContextCache {
  userId: string;
  userScope: 'MINISTRY' | 'SCHOOL';
  userType: UserMinistryType | UserSchoolType;
  etablissementId?: string;
  structureId?: string;
  permissions: {
    [businessObject: string]: {
      read: boolean;
      write: boolean;
      create: boolean;
      delete: boolean;
      approve: boolean;
    };
  };
  dataFilters: {
    [businessObject: string]: Array<{
      type: string;
      condition: any;
      priority: number;
    }>;
  };
  uiRules: Array<{
    element: string;
    type: string;
    visible: boolean;
    enabled: boolean;
    conditions?: any;
  }>;
  hierarchy?: {
    managerId: string | null;
    subordinates: Array<{
      id: string;
      email: string;
      fullName: string;
      level: number;
    }>;
    level: number;
  };
  lastUpdated: number;
}

type AuthUser = UserMinistry | UserSchool;

@Injectable()
export class SecurityContextService {
  private readonly logger = new Logger(SecurityContextService.name);
  private readonly CACHE_TTL_SECONDS: number;
  private readonly CACHE_PREFIX = 'security_context:';

  constructor(
    private prisma: PrismaService,
    private redisService: RedisService,
    private configService: ConfigService,
  ) {
    this.CACHE_TTL_SECONDS = this.configService.get<number>('SECURITY_CONTEXT_TTL', 3600); // 1 hour
  }

  /**
   * Récupère le contexte de sécurité depuis le cache ou le compile si nécessaire
   */
  async getSecurityContext(userId: string): Promise<SecurityContextCache | null> {
    this.logger.debug(`Getting security context for user: ${userId}`);
    try {
      // 1. Vérifier le cache Redis
      const cachedContext = await this.getCachedContext(userId);
      
      if (cachedContext && this.isContextValid(cachedContext)) {
        this.logger.debug(`Security context retrieved from cache for user ${userId}`);
        return cachedContext;
      }

      // 2. Compiler un nouveau contexte si le cache est invalide ou inexistant
      this.logger.debug(`Compiling new security context for user ${userId}`);
      const newContext = await this.compileSecurityContext(userId);
      
      if (newContext) {
        await this.cacheSecurityContext(userId, newContext);
        this.logger.debug(`New security context compiled and cached for user ${userId}`);
      }

      return newContext;
    } catch (error) {
      this.logger.error(`Error getting security context for user ${userId}:`, error);
      return null;
    }
  }

  /**
   * Invalide le contexte de sécurité d'un utilisateur
   */
  async invalidateSecurityContext(userId: string): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${userId}`;
      await this.redisService.del(cacheKey);
      this.logger.debug(`Security context invalidated for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error invalidating security context for user ${userId}:`, error);
    }
  }

  /**
   * Invalide tous les contextes de sécurité (utile après mise à jour des permissions)
   */
  async invalidateAllContexts(): Promise<void> {
    try {
      const pattern = `${this.CACHE_PREFIX}*`;
      const client = this.redisService.getClient();
      const keys = await client.keys(pattern);
      
      if (keys.length > 0) {
        await client.del(...keys);
        this.logger.debug(`Invalidated ${keys.length} security contexts`);
      }
    } catch (error) {
      this.logger.error('Error invalidating all security contexts:', error);
    }
  }

  /**
   * Compile le contexte de sécurité complet pour un utilisateur
   */
  private async compileSecurityContext(userId: string): Promise<SecurityContextCache | null> {
    if (!userId || typeof userId !== 'string') {
      this.logger.warn('Invalid userId provided to compileSecurityContext:', userId);
      return null;
    }

    // 1. Trouver l'utilisateur dans les deux tables
    let user: AuthUser | null = null;
    let userScope: 'MINISTRY' | 'SCHOOL';

    // Essayer d'abord UserMinistry
    const ministryUser = await this.prisma.userMinistry.findUnique({
      where: { id: userId, estActif: true },
      include: {
        groupesSecurite: {
          include: {
            group: {
              include: {
                permissions: {
                  include: {
                    object: true
                  }
                }
              }
            }
          },
          where: {
            estActif: true,
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: new Date() } }
            ]
          }
        },
        structure: true
      }
    });

    if (ministryUser) {
      user = ministryUser;
      userScope = 'MINISTRY';
    } else {
      // Essayer UserSchool
      const schoolUser = await this.prisma.userSchool.findUnique({
        where: { id: userId, estActif: true },
        include: {
          groupesSecurite: {
            include: {
              group: {
                include: {
                  permissions: {
                    include: {
                      object: true
                    }
                  }
                }
              }
            },
            where: {
              estActif: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gte: new Date() } }
              ]
            }
          },
          etablissement: true
        }
      });

      if (schoolUser) {
        user = schoolUser;
        userScope = 'SCHOOL';
      }
    }

    if (!user) {
      this.logger.warn(`User ${userId} not found or inactive`);
      return null;
    }

    // 2. Compiler le contexte
    const context: SecurityContextCache = {
      userId: user.id,
      userScope,
      userType: user.typeUtilisateur,
      etablissementId: userScope === 'SCHOOL' ? (user as any).etablissementId : undefined,
      structureId: userScope === 'MINISTRY' ? (user as any).structureId : undefined,
      permissions: {},
      dataFilters: {},
      uiRules: [],
      lastUpdated: Date.now()
    };

    const userGroups = (user as any).groupesSecurite || [];

    // 3. Compiler les permissions
    await this.compilePermissions(context, userGroups);

    // 4. Compiler les règles de visibilité
    await this.compileVisibilityRules(context, userGroups, userScope);

    // 5. Compiler les règles UI
    await this.compileUIRules(context, userGroups, userScope);

    // 6. Calculer la hiérarchie (pour Ministry seulement)
    if (userScope === 'MINISTRY') {
      context.hierarchy = await this.calculateHierarchy(user.id);
    }

    return context;
  }

  /**
   * Compile les permissions par objet métier
   */
  private async compilePermissions(
    context: SecurityContextCache, 
    userGroups: any[]
  ): Promise<void> {
    for (const userGroup of userGroups) {
      for (const permission of userGroup.group.permissions) {
        const objectName = permission.object.nom;
        
        if (!context.permissions[objectName]) {
          context.permissions[objectName] = {
            read: false,
            write: false,
            create: false,
            delete: false,
            approve: false
          };
        }

        // Agrégation des permissions (OR logique)
        context.permissions[objectName].read ||= permission.peutLire;
        context.permissions[objectName].write ||= permission.peutEcrire;
        context.permissions[objectName].create ||= permission.peutCreer;
        context.permissions[objectName].delete ||= permission.peutSupprimer;
        context.permissions[objectName].approve ||= permission.peutApprouver || false;
      }
    }
  }

  /**
   * Compile les règles de visibilité (Row-Level Security)
   */
  private async compileVisibilityRules(
    context: SecurityContextCache,
    userGroups: any[],
    userScope: 'MINISTRY' | 'SCHOOL'
  ): Promise<void> {
    const groupIds = userGroups.map(ug => ug.groupId);
    
    if (groupIds.length === 0) return;

    let visibilityRules;
    if (userScope === 'MINISTRY') {
      visibilityRules = await this.prisma.visibilityRuleMinistry.findMany({
        where: {
          groupId: { in: groupIds },
          estActive: true
        },
        include: {
          object: true
        },
        orderBy: {
          priorite: 'desc'
        }
      });
    } else {
      visibilityRules = await this.prisma.visibilityRuleSchool.findMany({
        where: {
          groupId: { in: groupIds },
          estActive: true
        },
        include: {
          object: true
        },
        orderBy: {
          priorite: 'desc'
        }
      });
    }

    for (const rule of visibilityRules) {
      const objectName = rule.object.nom;
      
      if (!context.dataFilters[objectName]) {
        context.dataFilters[objectName] = [];
      }

      context.dataFilters[objectName].push({
        type: rule.typeRegle,
        condition: rule.condition,
        priority: rule.priorite
      });
    }
  }

  /**
   * Compile les règles d'interface utilisateur
   */
  private async compileUIRules(
    context: SecurityContextCache,
    userGroups: any[],
    userScope: 'MINISTRY' | 'SCHOOL'
  ): Promise<void> {
    const groupIds = userGroups.map(ug => ug.groupId);
    
    if (groupIds.length === 0) return;

    let uiRules;
    if (userScope === 'MINISTRY') {
      uiRules = await this.prisma.uIRuleMinistry.findMany({
        where: {
          groupId: { in: groupIds }
        }
      });
    } else {
      uiRules = await this.prisma.uIRuleSchool.findMany({
        where: {
          groupId: { in: groupIds }
        }
      });
    }

    context.uiRules = uiRules.map((rule: any) => ({
      element: rule.nomElement,
      type: rule.typeElement,
      visible: rule.estVisible,
      enabled: rule.estActif,
      conditions: rule.conditions
    }));
  }

  /**
   * Calcule la hiérarchie pour les utilisateurs du ministère
   */
  private async calculateHierarchy(userId: string): Promise<any> {
    const hierarchy = {
      managerId: null,
      subordinates: [],
      level: 0
    };

    try {
      // Get the user's manager
      const user = await this.prisma.userMinistry.findUnique({
        where: { id: userId },
        select: { managerId: true }
      });

      if (user?.managerId) {
        hierarchy.managerId = user.managerId;
      }

      // Get direct subordinates
      const subordinates = await this.prisma.userMinistry.findMany({
        where: {
          managerId: userId,
          estActif: true
        },
        select: {
          id: true,
          email: true,
          prenom: true,
          nom: true
        }
      });

      hierarchy.subordinates = subordinates.map(sub => ({
        id: sub.id,
        email: sub.email,
        fullName: `${sub.prenom} ${sub.nom}`,
        level: 1
      }));

    } catch (error) {
      this.logger.error(`Error calculating hierarchy for user ${userId}:`, error);
    }

    return hierarchy;
  }

  /**
   * Récupère le contexte mis en cache
   */
  private async getCachedContext(userId: string): Promise<SecurityContextCache | null> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${userId}`;
      const cachedData = await this.redisService.get(cacheKey);
      
      if (cachedData && typeof cachedData === 'string') {
        const parsed = JSON.parse(cachedData);
        return parsed;
      }
    } catch (error) {
      this.logger.error(`Error getting cached context for user ${userId}:`, error);
    }
    
    return null;
  }

  /**
   * Met en cache le contexte de sécurité
   */
  private async cacheSecurityContext(userId: string, context: SecurityContextCache): Promise<void> {
    try {
      const cacheKey = `${this.CACHE_PREFIX}${userId}`;
      await this.redisService.set(cacheKey, JSON.stringify(context), this.CACHE_TTL_SECONDS);
      this.logger.debug(`Security context cached for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error caching security context for user ${userId}:`, error);
    }
  }

  /**
   * Vérifie si le contexte en cache est encore valide
   */
  private isContextValid(context: SecurityContextCache): boolean {
    const maxAge = this.configService.get<number>('SECURITY_CONTEXT_MAX_AGE', 3600 * 1000); // 1 hour in ms
    const age = Date.now() - context.lastUpdated;
    return age < maxAge;
  }
}