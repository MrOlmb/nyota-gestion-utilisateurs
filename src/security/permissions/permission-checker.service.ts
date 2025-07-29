import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import { SecurityContextService, SecurityContextCache } from '../security-context.service';

export enum PermissionAction {
  READ = 'read',
  WRITE = 'write',
  CREATE = 'create',
  DELETE = 'delete',
  APPROVE = 'approve'
}

export interface PermissionCheck {
  businessObject: string;
  action: PermissionAction;
  context?: any; // Additional context for permission evaluation
}

export interface PermissionResult {
  allowed: boolean;
  reason?: string;
  restrictions?: any;
}

@Injectable()
export class PermissionCheckerService {
  private readonly logger = new Logger(PermissionCheckerService.name);

  constructor(
    private securityContextService: SecurityContextService,
  ) {}

  /**
   * Vérifie si un utilisateur a la permission d'effectuer une action sur un objet métier
   */
  async checkPermission(
    userId: string,
    businessObject: string,
    action: PermissionAction,
    context?: any
  ): Promise<PermissionResult> {
    this.logger.log(`checkPermission called: userId=${userId}, businessObject=${businessObject}, action=${action}`);
    try {
      // 1. Récupérer le contexte de sécurité de l'utilisateur
      this.logger.log(`Calling getSecurityContext for user ${userId}`);
      const securityContext = await this.securityContextService.getSecurityContext(userId);
      this.logger.log(`SecurityContext result: ${securityContext ? 'FOUND' : 'NULL'}`);
      
      if (!securityContext) {
        this.logger.warn(`Security context not found for user ${userId}`);
        return { 
          allowed: false, 
          reason: 'Contexte de sécurité introuvable' 
        };
      }

      this.logger.log(`Security context permissions: ${JSON.stringify(securityContext.permissions)}`);

      // 2. Vérifier les permissions de base (Layer 2 - ACL)
      const basePermissionResult = this.checkBasePermissions(
        securityContext,
        businessObject,
        action
      );

      if (!basePermissionResult.allowed) {
        return basePermissionResult;
      }

      // 3. Appliquer les règles contextuelles si fournies
      if (context) {
        const contextualResult = await this.checkContextualPermissions(
          securityContext,
          businessObject,
          action,
          context
        );

        if (!contextualResult.allowed) {
          return contextualResult;
        }
      }

      this.logger.debug(
        `Permission granted for user ${userId} on ${businessObject}.${action}`
      );

      return { allowed: true };

    } catch (error) {
      this.logger.error(
        `Error checking permission for user ${userId}:`,
        error
      );
      return { 
        allowed: false, 
        reason: 'Erreur lors de la vérification des permissions' 
      };
    }
  }

  /**
   * Vérifie plusieurs permissions en une seule fois
   */
  async checkMultiplePermissions(
    userId: string,
    checks: PermissionCheck[]
  ): Promise<{ [key: string]: PermissionResult }> {
    const results: { [key: string]: PermissionResult } = {};

    // Récupérer le contexte une seule fois pour toutes les vérifications
    const securityContext = await this.securityContextService.getSecurityContext(userId);
    
    if (!securityContext) {
      // Toutes les permissions sont refusées si pas de contexte
      checks.forEach(check => {
        const key = `${check.businessObject}.${check.action}`;
        results[key] = { 
          allowed: false, 
          reason: 'Contexte de sécurité introuvable' 
        };
      });
      return results;
    }

    // Vérifier chaque permission
    for (const check of checks) {
      const key = `${check.businessObject}.${check.action}`;
      
      const baseResult = this.checkBasePermissions(
        securityContext,
        check.businessObject,
        check.action
      );

      if (!baseResult.allowed) {
        results[key] = baseResult;
        continue;
      }

      if (check.context) {
        const contextualResult = await this.checkContextualPermissions(
          securityContext,
          check.businessObject,
          check.action,
          check.context
        );
        results[key] = contextualResult;
      } else {
        results[key] = { allowed: true };
      }
    }

    return results;
  }

  /**
   * Lève une exception si l'utilisateur n'a pas la permission
   */
  async requirePermission(
    userId: string,
    businessObject: string,
    action: PermissionAction,
    context?: any
  ): Promise<void> {
    const result = await this.checkPermission(userId, businessObject, action, context);
    
    if (!result.allowed) {
      throw new ForbiddenException(
        result.reason || `Permission refusée pour ${businessObject}.${action}`
      );
    }
  }

  /**
   * Retourne toutes les permissions d'un utilisateur pour un objet métier
   */
  async getUserPermissions(
    userId: string,
    businessObject: string
  ): Promise<{ [action: string]: boolean }> {
    const securityContext = await this.securityContextService.getSecurityContext(userId);
    
    if (!securityContext || !securityContext.permissions[businessObject]) {
      return {
        read: false,
        write: false,
        create: false,
        delete: false,
        approve: false
      };
    }

    return securityContext.permissions[businessObject];
  }

  /**
   * Retourne tous les objets métier auxquels un utilisateur a accès
   */
  async getUserAccessibleObjects(userId: string): Promise<string[]> {
    const securityContext = await this.securityContextService.getSecurityContext(userId);
    
    if (!securityContext) {
      return [];
    }

    return Object.keys(securityContext.permissions).filter(objectName => {
      const perms = securityContext.permissions[objectName];
      // L'utilisateur a accès s'il a au moins une permission
      return perms.read || perms.write || perms.create || perms.delete || perms.approve;
    });
  }

  /**
   * Vérification des permissions de base (Layer 2 - ACL)
   */
  private checkBasePermissions(
    securityContext: SecurityContextCache,
    businessObject: string,
    action: PermissionAction
  ): PermissionResult {
    const objectPermissions = securityContext.permissions[businessObject];
    
    if (!objectPermissions) {
      return { 
        allowed: false, 
        reason: `Aucune permission définie pour l'objet ${businessObject}` 
      };
    }

    const hasPermission = objectPermissions[action];
    
    if (!hasPermission) {
      return { 
        allowed: false, 
        reason: `Permission ${action} refusée pour l'objet ${businessObject}` 
      };
    }

    return { allowed: true };
  }

  /**
   * Vérification des permissions contextuelles
   * Ici on peut ajouter des règles spécifiques selon le contexte
   */
  private async checkContextualPermissions(
    securityContext: SecurityContextCache,
    businessObject: string,
    action: PermissionAction,
    context: any
  ): Promise<PermissionResult> {
    // Règles spécifiques par type d'objet métier
    switch (businessObject) {
      case 'etablissement.management':
        return this.checkEstablishmentPermissions(securityContext, action, context);
      
      case 'user.management':
        return this.checkUserManagementPermissions(securityContext, action, context);
      
      case 'inspection.management':
        return this.checkInspectionPermissions(securityContext, action, context);
      
      default:
        // Par défaut, autoriser si les permissions de base sont OK
        return { allowed: true };
    }
  }

  /**
   * Règles spécifiques pour la gestion des établissements
   */
  private checkEstablishmentPermissions(
    securityContext: SecurityContextCache,
    action: PermissionAction,
    context: any
  ): PermissionResult {
    // Si l'utilisateur est d'une école, il ne peut agir que sur son établissement
    if (securityContext.userScope === 'SCHOOL') {
      if (context.etablissementId && context.etablissementId !== securityContext.etablissementId) {
        return { 
          allowed: false, 
          reason: 'Accès autorisé uniquement pour votre établissement' 
        };
      }
    }

    // Si c'est un utilisateur ministère avec restriction géographique
    if (securityContext.userScope === 'MINISTRY' && context.departementId) {
      // Vérifier si l'utilisateur a une restriction géographique
      // Cette logique peut être étendue selon les besoins
    }

    return { allowed: true };
  }

  /**
   * Règles spécifiques pour la gestion des utilisateurs
   */
  private checkUserManagementPermissions(
    securityContext: SecurityContextCache,
    action: PermissionAction,
    context: any
  ): PermissionResult {
    // Un utilisateur ne peut pas se modifier/supprimer lui-même dans certains cas
    if (context.targetUserId === securityContext.userId) {
      if (action === PermissionAction.DELETE) {
        return { 
          allowed: false, 
          reason: 'Impossible de supprimer son propre compte' 
        };
      }
    }

    // Vérification de la hiérarchie pour les utilisateurs ministère
    if (securityContext.userScope === 'MINISTRY' && securityContext.hierarchy) {
      const subordinateIds = securityContext.hierarchy.subordinates.map(s => s.id);
      
      // L'utilisateur peut gérer ses subordinés directs
      if (context.targetUserId && !subordinateIds.includes(context.targetUserId)) {
        // Vérifier si c'est un admin ou super-admin qui peut gérer tous les utilisateurs
        const hasGlobalUserManagement = this.hasGlobalPermission(
          securityContext,
          'global.user.management'
        );
        
        if (!hasGlobalUserManagement) {
          return { 
            allowed: false, 
            reason: 'Gestion autorisée uniquement pour vos subordinés directs' 
          };
        }
      }
    }

    return { allowed: true };
  }

  /**
   * Règles spécifiques pour les inspections
   */
  private checkInspectionPermissions(
    securityContext: SecurityContextCache,
    action: PermissionAction,
    context: any
  ): PermissionResult {
    // Les inspections ne peuvent être faites que par des utilisateurs ministère
    if (securityContext.userScope !== 'MINISTRY') {
      return { 
        allowed: false, 
        reason: 'Les inspections sont réservées au personnel du ministère' 
      };
    }

    // Vérifier le type d'utilisateur pour certaines actions
    if (action === PermissionAction.APPROVE) {
      const allowedTypes = ['INSPECTEUR', 'DIRECTEUR', 'SECRETAIRE_GENERAL'];
      if (!allowedTypes.includes(securityContext.userType as string)) {
        return { 
          allowed: false, 
          reason: 'Seuls les inspecteurs et cadres supérieurs peuvent approuver les inspections' 
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Vérifie si l'utilisateur a une permission globale spéciale
   */
  private hasGlobalPermission(
    securityContext: SecurityContextCache,
    permission: string
  ): boolean {
    return securityContext.permissions[permission]?.read || false;
  }

  /**
   * Fonction utilitaire pour créer un middleware de permission
   */
  createPermissionMiddleware(businessObject: string, action: PermissionAction) {
    return async (userId: string, context?: any) => {
      await this.requirePermission(userId, businessObject, action, context);
    };
  }
}