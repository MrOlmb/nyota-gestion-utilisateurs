import { Injectable, Logger } from '@nestjs/common';
import { SecurityContextService, SecurityContextCache } from '../security-context.service';

export enum UIElementType {
  FIELD = 'FIELD',
  BUTTON = 'BUTTON',
  MENU = 'MENU',
  SECTION = 'SECTION',
  PAGE = 'PAGE'
}

export interface UIElement {
  name: string;
  type: UIElementType;
  visible: boolean;
  enabled: boolean;
  readonly?: boolean;
  conditions?: any;
}

export interface UIRuleEvaluation {
  element: string;
  visible: boolean;
  enabled: boolean;
  readonly: boolean;
  reason?: string;
}

export interface UIContext {
  userId: string;
  page?: string;
  businessObject?: string;
  recordId?: string;
  additionalData?: any;
}

@Injectable()
export class UIVisibilityService {
  private readonly logger = new Logger(UIVisibilityService.name);

  constructor(
    private securityContextService: SecurityContextService,
  ) {}

  /**
   * Évalue la visibilité d'un élément UI pour un utilisateur
   */
  async evaluateElementVisibility(
    userId: string,
    elementName: string,
    context?: any
  ): Promise<UIRuleEvaluation> {
    try {
      // 1. Récupérer le contexte de sécurité
      const securityContext = await this.securityContextService.getSecurityContext(userId);
      
      if (!securityContext) {
        return {
          element: elementName,
          visible: false,
          enabled: false,
          readonly: true,
          reason: 'Contexte de sécurité introuvable'
        };
      }

      // 2. Trouver les règles UI applicables
      const applicableRules = securityContext.uiRules.filter(rule => 
        rule.element === elementName || this.matchesPattern(rule.element, elementName)
      );

      if (applicableRules.length === 0) {
        // Pas de règles spécifiques, utiliser les paramètres par défaut
        return {
          element: elementName,
          visible: true,
          enabled: true,
          readonly: false
        };
      }

      // 3. Évaluer les règles (priorité à la plus restrictive)
      let finalVisible = false;
      let finalEnabled = false;
      let finalReadonly = false;

      for (const rule of applicableRules) {
        const ruleResult = await this.evaluateRule(rule, securityContext, context);
        
        // Agrégation OR pour la visibilité et l'activation
        finalVisible ||= ruleResult.visible;
        finalEnabled ||= ruleResult.enabled;
        finalReadonly ||= ruleResult.readonly;
      }

      return {
        element: elementName,
        visible: finalVisible,
        enabled: finalEnabled,
        readonly: finalReadonly
      };

    } catch (error) {
      this.logger.error(`Error evaluating UI visibility for element ${elementName}:`, error);
      
      // En cas d'erreur, masquer l'élément par sécurité
      return {
        element: elementName,
        visible: false,
        enabled: false,
        readonly: true,
        reason: 'Erreur lors de l\'évaluation des règles UI'
      };
    }
  }

  /**
   * Évalue la visibilité de plusieurs éléments UI en une fois
   */
  async evaluateMultipleElements(
    userId: string,
    elementNames: string[],
    context?: any
  ): Promise<{ [elementName: string]: UIRuleEvaluation }> {
    const results: { [elementName: string]: UIRuleEvaluation } = {};

    // Récupérer le contexte une seule fois
    const securityContext = await this.securityContextService.getSecurityContext(userId);
    
    if (!securityContext) {
      // Masquer tous les éléments si pas de contexte
      elementNames.forEach(elementName => {
        results[elementName] = {
          element: elementName,
          visible: false,
          enabled: false,
          readonly: true,
          reason: 'Contexte de sécurité introuvable'
        };
      });
      return results;
    }

    // Évaluer chaque élément
    for (const elementName of elementNames) {
      const applicableRules = securityContext.uiRules.filter(rule => 
        rule.element === elementName || this.matchesPattern(rule.element, elementName)
      );

      if (applicableRules.length === 0) {
        results[elementName] = {
          element: elementName,
          visible: true,
          enabled: true,
          readonly: false
        };
        continue;
      }

      let finalVisible = false;
      let finalEnabled = false;
      let finalReadonly = false;

      for (const rule of applicableRules) {
        const ruleResult = await this.evaluateRule(rule, securityContext, context);
        finalVisible ||= ruleResult.visible;
        finalEnabled ||= ruleResult.enabled;
        finalReadonly ||= ruleResult.readonly;
      }

      results[elementName] = {
        element: elementName,
        visible: finalVisible,
        enabled: finalEnabled,
        readonly: finalReadonly
      };
    }

    return results;
  }

  /**
   * Génère un objet de configuration UI pour le frontend
   */
  async generateUIConfig(
    userId: string,
    page: string,
    context?: any
  ): Promise<{ [elementName: string]: UIElement }> {
    const securityContext = await this.securityContextService.getSecurityContext(userId);
    
    if (!securityContext) {
      return {};
    }

    const uiConfig: { [elementName: string]: UIElement } = {};

    // Filtrer les règles par page si spécifiée
    const pageRules = securityContext.uiRules.filter(rule => 
      !page || this.isRuleApplicableToPage(rule, page)
    );

    for (const rule of pageRules) {
      const evaluation = await this.evaluateRule(rule, securityContext, context);
      
      uiConfig[rule.element] = {
        name: rule.element,
        type: rule.type as UIElementType,
        visible: evaluation.visible,
        enabled: evaluation.enabled,
        readonly: evaluation.readonly,
        conditions: rule.conditions
      };
    }

    return uiConfig;
  }

  /**
   * Évalue une règle UI spécifique
   */
  private async evaluateRule(
    rule: any,
    securityContext: SecurityContextCache,
    context?: any
  ): Promise<{ visible: boolean; enabled: boolean; readonly: boolean }> {
    let visible = rule.visible || false;
    let enabled = rule.enabled || false;
    let readonly = false;

    // Évaluer les conditions si présentes
    if (rule.conditions) {
      const conditionResult = await this.evaluateConditions(rule.conditions, securityContext, context);
      
      // Appliquer le résultat des conditions
      visible = visible && conditionResult.visible;
      enabled = enabled && conditionResult.enabled;
      readonly = readonly || conditionResult.readonly;
    }

    // Règles spécifiques par type d'élément
    const typeSpecificResult = this.applyTypeSpecificRules(rule, securityContext, context);
    
    return {
      visible: visible && typeSpecificResult.visible,
      enabled: enabled && typeSpecificResult.enabled,
      readonly: readonly || typeSpecificResult.readonly
    };
  }

  /**
   * Évalue les conditions d'une règle UI
   */
  private async evaluateConditions(
    conditions: any,
    securityContext: SecurityContextCache,
    context?: any
  ): Promise<{ visible: boolean; enabled: boolean; readonly: boolean }> {
    const result = { visible: true, enabled: true, readonly: false };

    // Conditions basées sur le type d'utilisateur
    if (conditions.userTypes) {
      result.visible &&= conditions.userTypes.includes(securityContext.userType);
    }

    // Conditions basées sur le scope (MINISTRY/SCHOOL)
    if (conditions.userScopes) {
      result.visible &&= conditions.userScopes.includes(securityContext.userScope);
    }

    // Conditions basées sur les permissions
    if (conditions.requiredPermissions) {
      for (const [objectName, requiredPerms] of Object.entries(conditions.requiredPermissions)) {
        const userPerms = securityContext.permissions[objectName];
        if (!userPerms) {
          result.visible = false;
          break;
        }

        for (const [action, required] of Object.entries(requiredPerms as any)) {
          if (required && !userPerms[action]) {
            result.visible = false;
            break;
          }
        }
      }
    }

    // Conditions basées sur la hiérarchie
    if (conditions.hierarchyLevel && securityContext.hierarchy) {
      const hasSubordinates = securityContext.hierarchy.subordinates.length > 0;
      
      if (conditions.hierarchyLevel.requiresSubordinates && !hasSubordinates) {
        result.visible = false;
      }
    }

    // Conditions contextuelles dynamiques
    if (conditions.contextual && context) {
      const contextualResult = await this.evaluateContextualConditions(
        conditions.contextual,
        securityContext,
        context
      );
      
      result.visible &&= contextualResult.visible;
      result.enabled &&= contextualResult.enabled;
      result.readonly ||= contextualResult.readonly;
    }

    return result;
  }

  /**
   * Évalue les conditions contextuelles
   */
  private async evaluateContextualConditions(
    contextualConditions: any,
    securityContext: SecurityContextCache,
    context: any
  ): Promise<{ visible: boolean; enabled: boolean; readonly: boolean }> {
    const result = { visible: true, enabled: true, readonly: false };

    // Condition: propriétaire de l'enregistrement
    if (contextualConditions.ownRecordOnly && context.recordOwnerId) {
      result.visible &&= context.recordOwnerId === securityContext.userId;
    }

    // Condition: même établissement
    if (contextualConditions.sameEstablishmentOnly && context.recordEstablissementId) {
      if (securityContext.userScope === 'SCHOOL') {
        result.visible &&= context.recordEstablissementId === securityContext.etablissementId;
      }
    }

    // Condition: statut de l'enregistrement
    if (contextualConditions.recordStatus && context.recordStatus) {
      const allowedStatuses = contextualConditions.recordStatus.allowed || [];
      const forbiddenStatuses = contextualConditions.recordStatus.forbidden || [];
      
      if (allowedStatuses.length > 0) {
        result.visible &&= allowedStatuses.includes(context.recordStatus);
      }
      
      if (forbiddenStatuses.length > 0) {
        result.visible &&= !forbiddenStatuses.includes(context.recordStatus);
      }

      // Lecture seule selon le statut
      if (contextualConditions.recordStatus.readOnlyWhen) {
        result.readonly ||= contextualConditions.recordStatus.readOnlyWhen.includes(context.recordStatus);
      }
    }

    return result;
  }

  /**
   * Applique des règles spécifiques selon le type d'élément UI
   */
  private applyTypeSpecificRules(
    rule: any,
    securityContext: SecurityContextCache,
    context?: any
  ): { visible: boolean; enabled: boolean; readonly: boolean } {
    const result = { visible: true, enabled: true, readonly: false };

    switch (rule.type) {
      case UIElementType.BUTTON:
        return this.applyButtonRules(rule, securityContext, context);
        
      case UIElementType.FIELD:
        return this.applyFieldRules(rule, securityContext, context);
        
      case UIElementType.MENU:
        return this.applyMenuRules(rule, securityContext, context);
        
      case UIElementType.SECTION:
        return this.applySectionRules(rule, securityContext, context);
        
      case UIElementType.PAGE:
        return this.applyPageRules(rule, securityContext, context);
        
      default:
        return result;
    }
  }

  /**
   * Règles spécifiques pour les boutons
   */
  private applyButtonRules(
    rule: any,
    securityContext: SecurityContextCache,
    context?: any
  ): { visible: boolean; enabled: boolean; readonly: boolean } {
    const result = { visible: true, enabled: true, readonly: false };

    // Boutons d'action selon les permissions
    if (rule.element.includes('save') || rule.element.includes('create')) {
      // Vérifier la permission de création/écriture
      const hasCreatePermission = Object.values(securityContext.permissions)
        .some((perms: any) => perms.create || perms.write);
      result.visible &&= hasCreatePermission;
    }

    if (rule.element.includes('delete')) {
      // Vérifier la permission de suppression
      const hasDeletePermission = Object.values(securityContext.permissions)
        .some((perms: any) => perms.delete);
      result.visible &&= hasDeletePermission;
    }

    if (rule.element.includes('approve')) {
      // Vérifier la permission d'approbation
      const hasApprovePermission = Object.values(securityContext.permissions)
        .some((perms: any) => perms.approve);
      result.visible &&= hasApprovePermission;
    }

    return result;
  }

  /**
   * Règles spécifiques pour les champs
   */
  private applyFieldRules(
    rule: any,
    securityContext: SecurityContextCache,
    context?: any
  ): { visible: boolean; enabled: boolean; readonly: boolean } {
    const result = { visible: true, enabled: true, readonly: false };

    // Champs sensibles masqués pour certains types d'utilisateurs
    if (rule.element.includes('password') || rule.element.includes('secret')) {
      result.visible = false; // Masquer les champs de mot de passe dans l'UI
    }

    // Champs financiers restreints
    if (rule.element.includes('salary') || rule.element.includes('budget')) {
      const canViewFinancials = securityContext.userType === 'DIRECTEUR' || 
                               securityContext.userType === 'SECRETAIRE_GENERAL';
      result.visible &&= canViewFinancials;
    }

    return result;
  }

  /**
   * Règles spécifiques pour les menus
   */
  private applyMenuRules(
    rule: any,
    securityContext: SecurityContextCache,
    context?: any
  ): { visible: boolean; enabled: boolean; readonly: boolean } {
    const result = { visible: true, enabled: true, readonly: false };

    // Menus d'administration réservés aux administrateurs
    if (rule.element.includes('admin') || rule.element.includes('settings')) {
      const isAdmin = securityContext.userType === 'DIRECTEUR' || 
                     securityContext.userType === 'SECRETAIRE_GENERAL';
      result.visible &&= isAdmin;
    }

    // Menus spécifiques au scope
    if (rule.element.includes('ministry')) {
      result.visible &&= securityContext.userScope === 'MINISTRY';
    }

    if (rule.element.includes('school')) {
      result.visible &&= securityContext.userScope === 'SCHOOL';
    }

    return result;
  }

  /**
   * Règles spécifiques pour les sections
   */
  private applySectionRules(
    rule: any,
    securityContext: SecurityContextCache,
    context?: any
  ): { visible: boolean; enabled: boolean; readonly: boolean } {
    // Les sections suivent généralement les mêmes règles que les menus
    return this.applyMenuRules(rule, securityContext, context);
  }

  /**
   * Règles spécifiques pour les pages
   */
  private applyPageRules(
    rule: any,
    securityContext: SecurityContextCache,
    context?: any
  ): { visible: boolean; enabled: boolean; readonly: boolean } {
    const result = { visible: true, enabled: true, readonly: false };

    // Pages d'administration
    if (rule.element.includes('user-management') || rule.element.includes('system-config')) {
      const hasUserManagement = securityContext.permissions['user.management']?.read;
      result.visible &&= hasUserManagement || false;
    }

    // Pages d'inspection (ministère seulement)
    if (rule.element.includes('inspection')) {
      result.visible &&= securityContext.userScope === 'MINISTRY';
    }

    return result;
  }

  /**
   * Vérifie si un motif correspond à un nom d'élément
   */
  private matchesPattern(pattern: string, elementName: string): boolean {
    // Support pour des patterns simples avec wildcards
    if (pattern.includes('*')) {
      const regexPattern = pattern.replace(/\*/g, '.*');
      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(elementName);
    }

    return pattern === elementName;
  }

  /**
   * Vérifie si une règle s'applique à une page donnée
   */
  private isRuleApplicableToPage(rule: any, page: string): boolean {
    if (!rule.conditions?.pages) {
      return true; // Règle globale
    }

    return rule.conditions.pages.includes(page);
  }

  /**
   * Check visibility of a specific UI element
   */
  async checkElementVisibility(
    userId: string,
    elementName: string,
    elementType: string,
    context?: Record<string, any>
  ): Promise<boolean> {
    const evaluation = await this.evaluateElementVisibility(userId, elementName, context);
    return evaluation.visible;
  }

  /**
   * Get element rules for a specific page/context
   */
  async getElementRules(
    userId: string,
    pageName: string,
    context?: Record<string, any>
  ): Promise<Record<string, { visible: boolean; enabled: boolean }>> {
    const uiConfig = await this.generateUIConfig(userId, pageName, context);
    
    const rules: Record<string, { visible: boolean; enabled: boolean }> = {};
    
    Object.entries(uiConfig).forEach(([elementName, element]) => {
      rules[elementName] = {
        visible: element.visible,
        enabled: element.enabled
      };
    });

    return rules;
  }

  /**
   * Crée un middleware pour vérifier l'accès à une page
   */
  createPageAccessMiddleware(pageName: string) {
    return async (userId: string) => {
      const evaluation = await this.evaluateElementVisibility(userId, pageName);
      
      if (!evaluation.visible) {
        throw new Error(`Accès refusé à la page ${pageName}`);
      }
    };
  }
}