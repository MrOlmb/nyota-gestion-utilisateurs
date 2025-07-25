import { SetMetadata } from '@nestjs/common';
import { PermissionAction } from '../../security/permissions/permission-checker.service';

export const PERMISSION_KEY = 'permissions';

export interface PermissionRequirement {
  businessObject: string;
  action: PermissionAction;
  message?: string;
}

/**
 * Décorateur pour exiger des permissions spécifiques sur un endpoint
 * 
 * @example
 * ```typescript
 * @RequirePermission('etablissement.management', PermissionAction.READ)
 * @Get('etablissements')
 * async getEstablishments() {
 *   // Cette méthode ne sera accessible qu'aux utilisateurs ayant 
 *   // la permission de lecture sur etablissement.management
 * }
 * ```
 */
export const RequirePermission = (
  businessObject: string, 
  action: PermissionAction,
  message?: string
) => {
  const requirement: PermissionRequirement = {
    businessObject,
    action,
    message
  };
  
  return SetMetadata(PERMISSION_KEY, requirement);
};

/**
 * Décorateur pour exiger plusieurs permissions (toutes requises)
 * 
 * @example
 * ```typescript
 * @RequireMultiplePermissions([
 *   { businessObject: 'etablissement.management', action: PermissionAction.READ },
 *   { businessObject: 'user.management', action: PermissionAction.WRITE }
 * ])
 * @Post('bulk-update')
 * async bulkUpdate() {
 *   // Nécessite les deux permissions
 * }
 * ```
 */
export const RequireMultiplePermissions = (requirements: PermissionRequirement[]) => {
  return SetMetadata(PERMISSION_KEY, requirements);
};

/**
 * Décorateur pour exiger au moins une permission parmi plusieurs (OR logique)
 * 
 * @example
 * ```typescript
 * @RequireAnyPermission([
 *   { businessObject: 'etablissement.management', action: PermissionAction.READ },
 *   { businessObject: 'inspection.management', action: PermissionAction.READ }
 * ])
 * @Get('dashboard')
 * async getDashboard() {
 *   // Accessible si l'utilisateur a au moins une de ces permissions
 * }
 * ```
 */
export const RequireAnyPermission = (requirements: PermissionRequirement[]) => {
  return SetMetadata(PERMISSION_KEY + '_ANY', requirements);
};

/**
 * Décorateur pour les opérations qui ne nécessitent que l'authentification
 */
export const AuthenticatedOnly = () => {
  return SetMetadata('authenticated_only', true);
};

/**
 * Décorateur pour restreindre l'accès selon le scope utilisateur
 */
export const RequireScope = (...scopes: ('MINISTRY' | 'SCHOOL')[]) => {
  return SetMetadata('required_scopes', scopes);
};

/**
 * Décorateur pour restreindre l'accès selon le type d'utilisateur
 */
export const RequireUserType = (...userTypes: string[]) => {
  return SetMetadata('required_user_types', userTypes);
};