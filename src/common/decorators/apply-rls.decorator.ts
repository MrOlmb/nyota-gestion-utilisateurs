import { SetMetadata } from '@nestjs/common';

export const RLS_FILTER_KEY = 'rls_filter';

export interface RLSConfig {
  businessObject: string;
  operation: 'read' | 'write' | 'delete';
  contextFrom?: string; // Nom du paramètre ou propriété à utiliser comme contexte
  skipRLS?: boolean; // Pour ignorer RLS sur certains endpoints
}

/**
 * Décorateur pour appliquer automatiquement les filtres RLS
 * 
 * @example
 * ```typescript
 * @ApplyRLS('etablissement.management', 'read')
 * @Get('etablissements')
 * async getEstablishments(@Query() query: any) {
 *   // Les résultats seront automatiquement filtrés selon les règles RLS
 *   // de l'utilisateur pour l'objet etablissement.management
 * }
 * 
 * @ApplyRLS('etablissement.management', 'write', 'etablissementId')
 * @Put('etablissements/:id')
 * async updateEstablishment(@Param('id') etablissementId: string, @Body() data: any) {
 *   // L'accès sera vérifié selon les règles RLS avec le contexte de l'établissement
 * }
 * ```
 */
export const ApplyRLS = (
  businessObject: string,
  operation: 'read' | 'write' | 'delete',
  contextFrom?: string
) => {
  const config: RLSConfig = {
    businessObject,
    operation,
    contextFrom
  };
  
  return SetMetadata(RLS_FILTER_KEY, config);
};

/**
 * Décorateur pour ignorer les filtres RLS sur un endpoint spécifique
 * Utile pour les endpoints d'administration qui doivent voir toutes les données
 * 
 * @example
 * ```typescript
 * @SkipRLS()
 * @RequirePermission('global.admin', PermissionAction.READ)
 * @Get('all-etablissements')
 * async getAllEstablishments() {
 *   // Retourne tous les établissements sans filtrage RLS
 *   // Nécessite des permissions d'administration globale
 * }
 * ```
 */
export const SkipRLS = () => {
  const config: RLSConfig = {
    businessObject: '',
    operation: 'read',
    skipRLS: true
  };
  
  return SetMetadata(RLS_FILTER_KEY, config);
};

/**
 * Décorateur pour appliquer des filtres RLS personnalisés
 * 
 * @example
 * ```typescript
 * @ApplyCustomRLS({
 *   businessObject: 'inspection.management',
 *   operation: 'read',
 *   contextFrom: 'filters.departementId'
 * })
 * @Post('inspections/search')
 * async searchInspections(@Body() filters: any) {
 *   // Utilise filters.departementId comme contexte pour les règles RLS
 * }
 * ```
 */
export const ApplyCustomRLS = (config: RLSConfig) => {
  return SetMetadata(RLS_FILTER_KEY, config);
};