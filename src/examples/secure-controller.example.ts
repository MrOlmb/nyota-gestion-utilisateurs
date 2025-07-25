/**
 * EXEMPLE D'UTILISATION COMPLÈTE DU SYSTÈME DE SÉCURITÉ NYOTA
 * 
 * Ce fichier montre comment utiliser les 4 couches de sécurité dans un contrôleur NestJS
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  Request,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { SecurityGuard, JwtAuthGuard, PermissionGuard } from '../common/guards/security.guard';
import { RLSInterceptor } from '../common/interceptors/rls.interceptor';
import { 
  RequirePermission, 
  RequireMultiplePermissions,
  RequireAnyPermission,
  AuthenticatedOnly,
  RequireScope,
  RequireUserType 
} from '../common/decorators/require-permission.decorator';
import { ApplyRLS, SkipRLS } from '../common/decorators/apply-rls.decorator';
import { PermissionAction } from '../security/permissions/permission-checker.service';
import { UIVisibilityService } from '../security/ui-rules/ui-visibility.service';
import { RLSFilterService } from '../security/filters/rls-filter.service';

@Controller('etablissements')
@UseGuards(SecurityGuard) // Applique toutes les couches de sécurité
@UseInterceptors(RLSInterceptor) // Applique automatiquement les filtres RLS
export class EtablissementSecureController {
  constructor(
    private prisma: PrismaService,
    private uiVisibilityService: UIVisibilityService,
    private rlsFilterService: RLSFilterService,
  ) {}

  /**
   * EXEMPLE 1: Lecture avec RLS automatique
   * - Couche 1: Authentification JWT automatique (SecurityGuard)
   * - Couche 2: Vérification des permissions de lecture
   * - Couche 3: Filtrage RLS automatique (RLSInterceptor)
   * - Couche 4: N/A (c'est pour l'UI)
   */
  @Get()
  @RequirePermission('etablissement.management', PermissionAction.READ)
  @ApplyRLS('etablissement.management', 'read')
  async getEtablissements(@Request() req: any, @Query() query: any) {
    // Les filtres RLS sont automatiquement appliqués par l'intercepteur
    // req.rlsFilters contient les filtres compilés
    
    const where = {
      ...query.filters,
      ...req.rlsFilters.where // Filtres RLS ajoutés automatiquement
    };

    return await this.prisma.etablissement.findMany({
      where,
      include: {
        departement: true,
        district: true,
        commune: true
      }
    });
  }

  /**
   * EXEMPLE 2: Lecture d'un établissement spécifique avec contexte
   */
  @Get(':id')
  @RequirePermission('etablissement.management', PermissionAction.READ)
  @ApplyRLS('etablissement.management', 'read', 'id') // Utilise l'ID comme contexte
  async getEtablissement(@Param('id') id: string, @Request() req: any) {
    // Le contexte (ID de l'établissement) est automatiquement passé aux filtres RLS
    
    const where = {
      id,
      ...req.rlsFilters.where
    };

    const etablissement = await this.prisma.etablissement.findFirst({
      where,
      include: {
        departement: true,
        usersSchool: {
          where: { estActif: true }
        }
      }
    });

    if (!etablissement) {
      throw new Error('Établissement non trouvé ou accès non autorisé');
    }

    return etablissement;
  }

  /**
   * EXEMPLE 3: Création avec permissions multiples
   */
  @Post()
  @RequireMultiplePermissions([
    { businessObject: 'etablissement.management', action: PermissionAction.CREATE },
    { businessObject: 'workflow.management', action: PermissionAction.WRITE }
  ])
  @ApplyRLS('etablissement.management', 'write')
  async createEtablissement(@Body() data: any, @Request() req: any) {
    // Vérifier que l'utilisateur peut créer dans ce contexte géographique
    const createData = {
      ...data,
      creeParId: req.userId, // Ajouter automatiquement le créateur
    };

    return await this.prisma.etablissement.create({
      data: createData,
      include: {
        departement: true,
        creePar: {
          select: {
            id: true,
            email: true,
            prenom: true,
            nom: true
          }
        }
      }
    });
  }

  /**
   * EXEMPLE 4: Mise à jour avec RLS contextuel
   */
  @Put(':id')
  @RequirePermission('etablissement.management', PermissionAction.WRITE)
  @ApplyRLS('etablissement.management', 'write', 'id')
  async updateEtablissement(
    @Param('id') id: string,
    @Body() data: any,
    @Request() req: any
  ) {
    // Vérifier d'abord que l'établissement existe et est accessible
    const existing = await this.prisma.etablissement.findFirst({
      where: {
        id,
        ...req.rlsFilters.where
      }
    });

    if (!existing) {
      throw new Error('Établissement non trouvé ou modification non autorisée');
    }

    const updateData = {
      ...data,
      modifieParId: req.userId,
      modifieLe: new Date()
    };

    return await this.prisma.etablissement.update({
      where: { id },
      data: updateData,
      include: {
        modifiePar: {
          select: {
            id: true,
            email: true,
            prenom: true,
            nom: true
          }
        }
      }
    });
  }

  /**
   * EXEMPLE 5: Suppression avec permissions strictes
   */
  @Delete(':id')
  @RequirePermission('etablissement.management', PermissionAction.DELETE)
  @RequireUserType('DIRECTEUR', 'SECRETAIRE_GENERAL') // Restriction supplémentaire
  @ApplyRLS('etablissement.management', 'delete', 'id')
  async deleteEtablissement(@Param('id') id: string, @Request() req: any) {
    // Vérifier que l'établissement peut être supprimé
    const etablissement = await this.prisma.etablissement.findFirst({
      where: {
        id,
        ...req.rlsFilters.where
      },
      include: {
        // usersSchool: { where: { estActif: true } },
        // demandes: { where: { statutDemande: { not: 'TERMINEE' } } }
      }
    });

    if (!etablissement) {
      throw new Error('Établissement non trouvé ou suppression non autorisée');
    }

    // Vérifications métier
    // if (etablissement.usersSchool.length > 0) {
    //   throw new Error('Impossible de supprimer un établissement avec des utilisateurs actifs');
    // }

    // if (etablissement.demandes.length > 0) {
    //   throw new Error('Impossible de supprimer un établissement avec des demandes en cours');
    // }

    return await this.prisma.etablissement.delete({
      where: { id }
    });
  }

  /**
   * EXEMPLE 6: Endpoint d'administration sans RLS
   */
  @Get('admin/all')
  @RequirePermission('global.admin', PermissionAction.READ)
  @RequireScope('MINISTRY') // Seulement les utilisateurs ministère
  @RequireUserType('MINISTRE', 'SECRETAIRE_GENERAL')
  @SkipRLS() // Pas de filtrage RLS pour cet endpoint admin
  async getAllEtablissements() {
    // Cet endpoint retourne TOUS les établissements sans filtrage
    // Réservé aux super-administrateurs
    return await this.prisma.etablissement.findMany({
      include: {
        departement: true,
        usersSchool: {
          where: { estActif: true },
          select: { id: true, email: true, typeUtilisateur: true }
        },
        _count: {
          select: {
            usersSchool: true,
            demandes: true,
            inspections: true
          }
        }
      }
    });
  }

  /**
   * EXEMPLE 7: Permission avec alternative (OR logique)
   */
  @Get(':id/statistics')
  @RequireAnyPermission([
    { businessObject: 'etablissement.management', action: PermissionAction.READ },
    { businessObject: 'statistics.national', action: PermissionAction.READ }
  ])
  @ApplyRLS('etablissement.management', 'read', 'id')
  async getEtablissementStatistics(@Param('id') id: string, @Request() req: any) {
    // Accessible si l'utilisateur peut voir l'établissement OU les statistiques nationales
    
    const etablissement = await this.prisma.etablissement.findFirst({
      where: {
        id,
        ...req.rlsFilters.where
      }
    });

    if (!etablissement) {
      throw new Error('Établissement non trouvé');
    }

    // Calculer les statistiques...
    return {
      etablissementId: id,
      totalEleves: etablissement.effectifTotalEleves,
      totalPersonnel: etablissement.effectifTotalPersonnel,
      // ... autres statistiques
    };
  }

  /**
   * EXEMPLE 8: Configuration UI dynamique (Couche 4)
   */
  @Get(':id/ui-config')
  @AuthenticatedOnly() // Seule l'authentification est requise
  async getUIConfig(@Param('id') id: string, @Request() req: any) {
    // Génère la configuration UI selon les permissions de l'utilisateur
    const uiConfig = await this.uiVisibilityService.generateUIConfig(
      req.userId,
      'etablissement-detail',
      { etablissementId: id }
    );

    return {
      page: 'etablissement-detail',
      elements: uiConfig,
      context: { etablissementId: id }
    };
  }

  /**
   * EXEMPLE 9: Endpoint avec authentification simple
   */
  @Get('my-establishments')
  @AuthenticatedOnly()
  async getMyEstablishments(@Request() req: any) {
    // Automatiquement filtré selon le scope de l'utilisateur
    if (req.user.scope === 'SCHOOL') {
      // Utilisateur école - seulement son établissement
      return await this.prisma.etablissement.findUnique({
        where: { id: req.user.establishmentId }
      });
    } else {
      // Utilisateur ministère - ses établissements selon sa structure
      const filterContext = {
        userId: req.userId,
        businessObject: 'etablissement.management',
        operation: 'read' as const
      };

      const rlsFilters = await this.rlsFilterService.compileFilters(filterContext);

      return await this.prisma.etablissement.findMany({
        where: rlsFilters.where
      });
    }
  }
}

/**
 * EXEMPLE D'UTILISATION AVEC GUARDS SÉPARÉS
 * Pour des cas où vous voulez plus de contrôle sur l'ordre des vérifications
 */
@Controller('users')
@UseGuards(JwtAuthGuard) // Seulement l'authentification JWT
export class UserControllerWithSeparateGuards {
  constructor(private prisma: PrismaService) {}

  @Get()
  @UseGuards(PermissionGuard) // Permission séparée
  @RequirePermission('user.management', PermissionAction.READ)
  async getUsers(@Request() req: any) {
    // Implémentation...
    return [];
  }

  @Post()
  @UseGuards(PermissionGuard)
  @RequirePermission('user.management', PermissionAction.CREATE)
  @RequireScope('MINISTRY') // Seuls les utilisateurs ministère peuvent créer
  async createUser(@Body() userData: any, @Request() req: any) {
    // Implémentation...
    return {};
  }
}

/**
 * NOTES D'UTILISATION:
 * 
 * 1. Le SecurityGuard combine toutes les vérifications (JWT + Permissions + Scope + UserType)
 * 2. Le RLSInterceptor applique automatiquement les filtres de données
 * 3. Les décorateurs de permission sont expressifs et lisibles
 * 4. Le système est flexible - vous pouvez utiliser les guards séparément si nécessaire
 * 5. La configuration UI peut être générée dynamiquement pour le frontend
 * 
 * ARCHITECTURE DE SÉCURITÉ:
 * 
 * Couche 1 (Authentification): Gérée par JwtAuthGuard ou SecurityGuard
 * Couche 2 (Permissions ACL): Gérée par les décorateurs @RequirePermission
 * Couche 3 (RLS): Gérée par RLSInterceptor et les décorateurs @ApplyRLS
 * Couche 4 (UI): Gérée par UIVisibilityService (appelé manuellement ou via endpoints dédiés)
 */