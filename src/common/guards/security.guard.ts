import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PermissionCheckerService, PermissionAction } from '../../security/permissions/permission-checker.service';
import { SecurityContextService } from '../../security/security-context.service';
import { PERMISSION_KEY, PermissionRequirement } from '../decorators/require-permission.decorator';

interface JwtPayload {
  sub: string;
  email: string;
  type: string;
  scope: 'MINISTRY' | 'SCHOOL';
  establishmentId?: string;
  structureId?: string;
}

@Injectable()
export class SecurityGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private jwtService: JwtService,
    private configService: ConfigService,
    private permissionChecker: PermissionCheckerService,
    private securityContextService: SecurityContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    console.log(`🔐 SecurityGuard: Processing request to ${request.url}`);
    
    try {
      // 1. Extraire et valider le JWT
      const token = this.extractTokenFromHeader(request);
      if (!token) {
        throw new UnauthorizedException('Token d\'authentification manquant');
      }

      const payload = await this.validateToken(token);
      console.log(`🔐 SecurityGuard: JWT payload decoded, userId=${payload.sub}`);
      
      // 2. Ajouter les informations utilisateur à la requête
      request.user = {
        id: payload.sub,  // Map sub to id for UserProfile interface
        email: payload.email,
        scope: payload.scope,
        type: payload.type,
        structureId: payload.structureId,
        establishmentId: payload.establishmentId
      };
      request.userId = payload.sub;

      // 3. Vérifier si l'endpoint nécessite seulement l'authentification
      const authenticatedOnly = this.reflector.get<boolean>('authenticated_only', context.getHandler());
      if (authenticatedOnly) {
        return true;
      }

      // 4. Vérifier les restrictions de scope
      const requiredScopes = this.reflector.get<string[]>('required_scopes', context.getHandler());
      if (requiredScopes && !requiredScopes.includes(payload.scope)) {
        throw new ForbiddenException(`Accès réservé aux utilisateurs: ${requiredScopes.join(', ')}`);
      }

      // 5. Vérifier les restrictions de type d'utilisateur
      const requiredUserTypes = this.reflector.get<string[]>('required_user_types', context.getHandler());
      if (requiredUserTypes && !requiredUserTypes.includes(payload.type)) {
        throw new ForbiddenException(`Accès réservé aux types d'utilisateurs: ${requiredUserTypes.join(', ')}`);
      }

      // 6. Vérifier les permissions spécifiques
      console.log(`🔐 SecurityGuard: About to check permissions for userId=${payload.sub}`);
      await this.checkPermissions(context, payload.sub);

      console.log(`🔐 SecurityGuard: All permission checks passed for userId=${payload.sub}`);
      return true;

    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      }
      
      throw new UnauthorizedException('Erreur d\'authentification');
    }
  }

  /**
   * Extrait le token JWT de l'en-tête Authorization
   */
  private extractTokenFromHeader(request: any): string | undefined {
    const authHeader = request.headers.authorization;
    if (!authHeader) return undefined;

    const [type, token] = authHeader.split(' ');
    return type === 'Bearer' ? token : undefined;
  }

  /**
   * Valide le token JWT
   */
  private async validateToken(token: string): Promise<JwtPayload> {
    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      return payload as JwtPayload;
    } catch (error) {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }

  /**
   * Vérifie les permissions requises pour l'endpoint
   */
  private async checkPermissions(context: ExecutionContext, userId: string): Promise<void> {
    console.log(`🔐 SecurityGuard.checkPermissions: Called with userId=${userId}`);
    
    // Validate userId is defined
    if (!userId) {
      console.log(`🔐 SecurityGuard.checkPermissions: userId is undefined!`);
      throw new UnauthorizedException('User ID is required for permission checking');
    }

    // Vérifier les permissions normales (toutes requises)
    const permissionRequirements = this.reflector.get<PermissionRequirement | PermissionRequirement[]>(
      PERMISSION_KEY,
      context.getHandler()
    );

    console.log(`🔐 SecurityGuard.checkPermissions: Found permission requirements:`, permissionRequirements);

    if (permissionRequirements) {
      console.log(`🔐 SecurityGuard.checkPermissions: Validating required permissions for userId=${userId}`);
      await this.validateRequiredPermissions(userId, permissionRequirements);
    }

    // Vérifier les permissions "OR" (au moins une requise)
    const anyPermissionRequirements = this.reflector.get<PermissionRequirement[]>(
      PERMISSION_KEY + '_ANY',
      context.getHandler()
    );

    if (anyPermissionRequirements) {
      await this.validateAnyPermissions(userId, anyPermissionRequirements);
    }
  }

  /**
   * Valide que l'utilisateur a toutes les permissions requises
   */
  private async validateRequiredPermissions(
    userId: string,
    requirements: PermissionRequirement | PermissionRequirement[]
  ): Promise<void> {
    const reqArray = Array.isArray(requirements) ? requirements : [requirements];

    for (const requirement of reqArray) {
      const result = await this.permissionChecker.checkPermission(
        userId,
        requirement.businessObject,
        requirement.action
      );

      if (!result.allowed) {
        const message = requirement.message || 
          `Permission requise: ${requirement.action} sur ${requirement.businessObject}`;
        throw new ForbiddenException(message);
      }
    }
  }

  /**
   * Valide que l'utilisateur a au moins une des permissions requises
   */
  private async validateAnyPermissions(
    userId: string,
    requirements: PermissionRequirement[]
  ): Promise<void> {
    for (const requirement of requirements) {
      const result = await this.permissionChecker.checkPermission(
        userId,
        requirement.businessObject,
        requirement.action
      );

      if (result.allowed) {
        return; // Au moins une permission est accordée
      }
    }

    // Aucune permission n'a été accordée
    const permissionList = requirements.map(req => 
      `${req.action} sur ${req.businessObject}`
    ).join(' OU ');
    
    throw new ForbiddenException(`Aucune des permissions requises trouvée: ${permissionList}`);
  }
}

/**
 * Guard simplifié pour vérifier seulement l'authentification JWT
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new UnauthorizedException('Token d\'authentification manquant');
    }

    const [type, token] = authHeader.split(' ');
    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Format de token invalide');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      request.user = payload;
      request.userId = payload.sub;
      
      return true;
    } catch (error) {
      throw new UnauthorizedException('Token invalide ou expiré');
    }
  }
}

/**
 * Guard pour vérifier les permissions sans authentification JWT
 * (utilisé quand l'authentification JWT est déjà validée par un autre guard)
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionChecker: PermissionCheckerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.userId || request.user?.sub;

    if (!userId) {
      throw new UnauthorizedException('Utilisateur non authentifié');
    }

    // Vérifier les permissions
    const permissionRequirements = this.reflector.get<PermissionRequirement | PermissionRequirement[]>(
      PERMISSION_KEY,
      context.getHandler()
    );

    if (permissionRequirements) {
      const reqArray = Array.isArray(permissionRequirements) ? permissionRequirements : [permissionRequirements];

      for (const requirement of reqArray) {
        const result = await this.permissionChecker.checkPermission(
          userId,
          requirement.businessObject,
          requirement.action
        );

        if (!result.allowed) {
          const message = requirement.message || 
            `Permission requise: ${requirement.action} sur ${requirement.businessObject}`;
          throw new ForbiddenException(message);
        }
      }
    }

    return true;
  }
}