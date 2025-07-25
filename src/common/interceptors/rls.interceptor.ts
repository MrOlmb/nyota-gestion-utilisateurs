import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { RLSFilterService, FilterContext } from '../../security/filters/rls-filter.service';
import { RLS_FILTER_KEY, RLSConfig } from '../decorators/apply-rls.decorator';

@Injectable()
export class RLSInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RLSInterceptor.name);

  constructor(
    private reflector: Reflector,
    private rlsFilterService: RLSFilterService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const userId = request.userId || request.user?.sub;

    // Récupérer la configuration RLS du décorateur
    const rlsConfig = this.reflector.get<RLSConfig>(RLS_FILTER_KEY, context.getHandler());

    // Si pas de configuration RLS ou RLS désactivé, continuer normalement
    if (!rlsConfig || rlsConfig.skipRLS || !userId) {
      return next.handle();
    }

    try {
      // Construire le contexte du filtre
      const filterContext: FilterContext = {
        userId,
        businessObject: rlsConfig.businessObject,
        operation: rlsConfig.operation,
        additionalContext: this.extractAdditionalContext(request, rlsConfig)
      };

      // Compiler les filtres RLS
      const compiledFilters = await this.rlsFilterService.compileFilters(filterContext);

      // Ajouter les filtres à la requête pour utilisation dans le service
      request.rlsFilters = compiledFilters;
      request.rlsConfig = rlsConfig;

      this.logger.debug(
        `RLS filters applied for user ${userId} on ${rlsConfig.businessObject}.${rlsConfig.operation}`,
        { filters: compiledFilters }
      );

    } catch (error) {
      this.logger.error('Error applying RLS filters:', error);
      // En cas d'erreur, bloquer l'accès par sécurité
      request.rlsFilters = { 
        where: { id: 'never-match' },
        restrictionLevel: 'FULL',
        message: 'Erreur de sécurité - accès bloqué'
      };
    }

    return next.handle().pipe(
      map((data) => {
        // Ici on pourrait appliquer des filtres supplémentaires au niveau des réponses
        // si nécessaire (par exemple pour masquer certains champs)
        return this.filterResponseData(data, request.rlsConfig, request.user);
      })
    );
  }

  /**
   * Extrait le contexte additionnel depuis la requête
   */
  private extractAdditionalContext(request: any, rlsConfig: RLSConfig): any {
    if (!rlsConfig.contextFrom) {
      return {};
    }

    const context: any = {};

    // Support pour les chemins de propriété (ex: "filters.departementId")
    const contextPath = rlsConfig.contextFrom.split('.');
    
    // Chercher dans les paramètres d'URL
    if (request.params && this.hasNestedProperty(request.params, contextPath)) {
      context.fromParams = this.getNestedProperty(request.params, contextPath);
    }

    // Chercher dans les paramètres de requête
    if (request.query && this.hasNestedProperty(request.query, contextPath)) {
      context.fromQuery = this.getNestedProperty(request.query, contextPath);
    }

    // Chercher dans le corps de la requête
    if (request.body && this.hasNestedProperty(request.body, contextPath)) {
      context.fromBody = this.getNestedProperty(request.body, contextPath);
    }

    return context;
  }

  /**
   * Vérifie si un objet a une propriété imbriquée
   */
  private hasNestedProperty(obj: any, path: string[]): boolean {
    let current = obj;
    for (const prop of path) {
      if (current === null || current === undefined || !(prop in current)) {
        return false;
      }
      current = current[prop];
    }
    return true;
  }

  /**
   * Récupère une propriété imbriquée
   */
  private getNestedProperty(obj: any, path: string[]): any {
    let current = obj;
    for (const prop of path) {
      current = current[prop];
    }
    return current;
  }

  /**
   * Filtre les données de réponse selon les règles de sécurité
   */
  private filterResponseData(data: any, rlsConfig: RLSConfig, user: any): any {
    // Ici on pourrait implémenter des règles de filtrage des réponses
    // Par exemple, masquer certains champs selon le type d'utilisateur

    if (!data || !rlsConfig) {
      return data;
    }

    // Exemple: masquer les champs sensibles pour les utilisateurs non-administrateurs
    if (this.shouldMaskSensitiveFields(user)) {
      return this.maskSensitiveFields(data);
    }

    return data;
  }

  /**
   * Détermine si les champs sensibles doivent être masqués
   */
  private shouldMaskSensitiveFields(user: any): boolean {
    if (!user) return true;

    // Les administrateurs voient tout
    const adminTypes = ['MINISTRE', 'SECRETAIRE_GENERAL', 'DIRECTEUR'];
    return !adminTypes.includes(user.type);
  }

  /**
   * Masque les champs sensibles dans les données
   */
  private maskSensitiveFields(data: any): any {
    if (!data) return data;

    // Liste des champs à masquer
    const sensitiveFields = [
      'passwordHash',
      'password_hash',
      'motDePasseHash',
      'numeroTelephone',
      'numero_telephone',
      'emailPersonnel'
    ];

    if (Array.isArray(data)) {
      return data.map(item => this.removeSensitiveFields(item, sensitiveFields));
    } else if (typeof data === 'object') {
      return this.removeSensitiveFields(data, sensitiveFields);
    }

    return data;
  }

  /**
   * Supprime les champs sensibles d'un objet
   */
  private removeSensitiveFields(obj: any, sensitiveFields: string[]): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const filtered = { ...obj };

    for (const field of sensitiveFields) {
      if (field in filtered) {
        delete filtered[field];
      }
    }

    // Appliquer récursivement aux propriétés d'objet
    for (const key in filtered) {
      if (filtered[key] && typeof filtered[key] === 'object') {
        if (Array.isArray(filtered[key])) {
          filtered[key] = filtered[key].map((item: any) => 
            this.removeSensitiveFields(item, sensitiveFields)
          );
        } else {
          filtered[key] = this.removeSensitiveFields(filtered[key], sensitiveFields);
        }
      }
    }

    return filtered;
  }
}

/**
 * Décorateur pour appliquer l'intercepteur RLS à une classe ou méthode
 */
export const UseRLSInterceptor = () => {
  return (target: any, propertyKey?: string, descriptor?: PropertyDescriptor) => {
    // Cette implémentation dépend de la façon dont vous souhaitez intégrer l'intercepteur
    // Généralement, vous l'appliqueriez au niveau du contrôleur avec @UseInterceptors(RLSInterceptor)
  };
};