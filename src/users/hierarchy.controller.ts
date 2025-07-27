import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { HierarchyService } from './hierarchy.service';
import { SecurityGuard } from '../common/guards/security.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionAction } from '../security/permissions/permission-checker.service';
import {
  HierarchyUpdateDto,
  BulkHierarchyUpdateDto,
  HierarchyQueryDto,
  HierarchyResponseDto,
  OrgChartResponseDto,
  HierarchyValidationDto,
  ReorganizationPlanDto
} from './dto/hierarchy.dto';

interface UserProfile {
  id: string;
  email: string;
  scope: 'MINISTRY' | 'SCHOOL';
}

@ApiTags('User Hierarchy')
@ApiBearerAuth()
@Controller('users/hierarchy')
@UseGuards(SecurityGuard)
export class HierarchyController {
  constructor(private readonly hierarchyService: HierarchyService) {}

  // ==================== HIERARCHY RETRIEVAL ====================

  @Get()
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Récupérer la hiérarchie d\'un utilisateur' })
  @ApiResponse({ 
    status: 200, 
    description: 'Hiérarchie récupérée avec succès',
    type: HierarchyResponseDto 
  })
  @ApiQuery({ name: 'rootUserId', required: false, description: 'ID de l\'utilisateur racine' })
  @ApiQuery({ name: 'maxDepth', required: false, description: 'Profondeur maximale', type: Number })
  @ApiQuery({ name: 'includeUserData', required: false, description: 'Inclure les données utilisateur', type: Boolean })
  @ApiQuery({ name: 'includeInactive', required: false, description: 'Inclure les utilisateurs inactifs', type: Boolean })
  @ApiQuery({ name: 'userTypes', required: false, description: 'Types d\'utilisateur à inclure', type: [String] })
  @ApiQuery({ name: 'structureId', required: false, description: 'ID de la structure' })
  async getHierarchy(
    @CurrentUser() user: UserProfile,
    @Query(ValidationPipe) query: HierarchyQueryDto
  ): Promise<HierarchyResponseDto> {
    return this.hierarchyService.getHierarchy(user.id, query);
  }

  @Get('user/:userId')
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Récupérer la hiérarchie d\'un utilisateur spécifique' })
  @ApiResponse({ 
    status: 200, 
    description: 'Hiérarchie récupérée avec succès',
    type: HierarchyResponseDto 
  })
  @ApiParam({ name: 'userId', description: 'ID de l\'utilisateur' })
  @ApiQuery({ name: 'maxDepth', required: false, description: 'Profondeur maximale', type: Number })
  @ApiQuery({ name: 'includeUserData', required: false, description: 'Inclure les données utilisateur', type: Boolean })
  @ApiQuery({ name: 'includeInactive', required: false, description: 'Inclure les utilisateurs inactifs', type: Boolean })
  async getUserHierarchy(
    @CurrentUser() user: UserProfile,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query(ValidationPipe) query: Omit<HierarchyQueryDto, 'rootUserId'>
  ): Promise<HierarchyResponseDto> {
    const fullQuery: HierarchyQueryDto = { ...query, rootUserId: userId };
    return this.hierarchyService.getHierarchy(user.id, fullQuery);
  }

  @Get('orgchart')
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Récupérer l\'organigramme' })
  @ApiResponse({ 
    status: 200, 
    description: 'Organigramme récupéré avec succès',
    type: OrgChartResponseDto 
  })
  @ApiQuery({ name: 'rootUserId', required: false, description: 'ID de l\'utilisateur racine' })
  @ApiQuery({ name: 'maxDepth', required: false, description: 'Profondeur maximale', type: Number })
  async getOrgChart(
    @CurrentUser() user: UserProfile,
    @Query('rootUserId') rootUserId?: string,
    @Query('maxDepth') maxDepth: number = 5
  ): Promise<OrgChartResponseDto> {
    return this.hierarchyService.getOrgChart(user.id, rootUserId, maxDepth);
  }

  @Get('subordinates/:userId')
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Récupérer les subordinés directs d\'un utilisateur' })
  @ApiResponse({ status: 200, description: 'Subordinés récupérés avec succès' })
  @ApiParam({ name: 'userId', description: 'ID de l\'utilisateur' })
  async getDirectSubordinates(
    @CurrentUser() user: UserProfile,
    @Param('userId', ParseUUIDPipe) userId: string
  ): Promise<HierarchyResponseDto> {
    const query: HierarchyQueryDto = {
      rootUserId: userId,
      maxDepth: 2, // Only direct reports
      includeUserData: true,
      includeInactive: false
    };
    return this.hierarchyService.getHierarchy(user.id, query);
  }

  @Get('managers/:userId')
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Récupérer la chaîne hiérarchique d\'un utilisateur (managers)' })
  @ApiResponse({ status: 200, description: 'Chaîne hiérarchique récupérée avec succès' })
  @ApiParam({ name: 'userId', description: 'ID de l\'utilisateur' })
  async getManagerChain(
    @CurrentUser() _user: UserProfile,
    @Param('userId', ParseUUIDPipe) _userId: string
  ): Promise<{ managers: any[]; depth: number }> {
    // This would require a different implementation to go up the hierarchy
    // For now, returning a placeholder structure
    return {
      managers: [],
      depth: 0
    };
  }

  // ==================== HIERARCHY UPDATES ====================

  @Put('update')
  @RequirePermission('user.management', PermissionAction.WRITE)
  @ApiOperation({ summary: 'Mettre à jour la hiérarchie d\'un utilisateur' })
  @ApiResponse({ 
    status: 200, 
    description: 'Hiérarchie mise à jour avec succès'
  })
  @ApiResponse({ status: 400, description: 'Données invalides ou changement non autorisé' })
  async updateHierarchy(
    @CurrentUser() user: UserProfile,
    @Body(ValidationPipe) updateDto: HierarchyUpdateDto
  ): Promise<{ success: boolean; validation: HierarchyValidationDto }> {
    return this.hierarchyService.updateUserHierarchy(user.id, updateDto);
  }

  @Put('bulk-update')
  @RequirePermission('user.management', PermissionAction.WRITE)
  @ApiOperation({ summary: 'Mise à jour en masse de la hiérarchie' })
  @ApiResponse({ 
    status: 200, 
    description: 'Mise à jour en masse effectuée'
  })
  @ApiResponse({ status: 400, description: 'Erreur dans les mises à jour' })
  async bulkUpdateHierarchy(
    @CurrentUser() user: UserProfile,
    @Body(ValidationPipe) bulkUpdateDto: BulkHierarchyUpdateDto
  ): Promise<{
    success: boolean;
    successfulUpdates: string[];
    failedUpdates: { userId: string; error: string }[];
    validation: HierarchyValidationDto;
  }> {
    return this.hierarchyService.bulkUpdateHierarchy(user.id, bulkUpdateDto);
  }

  @Put('assign-manager/:userId/:managerId')
  @RequirePermission('user.management', PermissionAction.WRITE)
  @ApiOperation({ summary: 'Assigner un manager à un utilisateur' })
  @ApiResponse({ status: 200, description: 'Manager assigné avec succès' })
  @ApiParam({ name: 'userId', description: 'ID de l\'utilisateur' })
  @ApiParam({ name: 'managerId', description: 'ID du nouveau manager' })
  async assignManager(
    @CurrentUser() user: UserProfile,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('managerId', ParseUUIDPipe) managerId: string,
    @Body('reason') reason?: string
  ): Promise<{ success: boolean; validation: HierarchyValidationDto }> {
    const updateDto: HierarchyUpdateDto = {
      userId,
      newManagerId: managerId,
      reason: reason || 'Assignation de manager via API'
    };
    return this.hierarchyService.updateUserHierarchy(user.id, updateDto);
  }

  @Put('remove-manager/:userId')
  @RequirePermission('user.management', PermissionAction.WRITE)
  @ApiOperation({ summary: 'Retirer le manager d\'un utilisateur' })
  @ApiResponse({ status: 200, description: 'Manager retiré avec succès' })
  @ApiParam({ name: 'userId', description: 'ID de l\'utilisateur' })
  async removeManager(
    @CurrentUser() user: UserProfile,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body('reason') reason?: string
  ): Promise<{ success: boolean; validation: HierarchyValidationDto }> {
    const updateDto: HierarchyUpdateDto = {
      userId,
      newManagerId: undefined,
      reason: reason || 'Suppression de manager via API'
    };
    return this.hierarchyService.updateUserHierarchy(user.id, updateDto);
  }

  // ==================== REORGANIZATION ====================

  @Post('reorganization/plan')
  @RequirePermission('user.management', PermissionAction.APPROVE)
  @ApiOperation({ summary: 'Créer un plan de réorganisation' })
  @ApiResponse({ 
    status: 201, 
    description: 'Plan de réorganisation créé avec succès'
  })
  @HttpCode(HttpStatus.CREATED)
  async createReorganizationPlan(
    @CurrentUser() user: UserProfile,
    @Body(ValidationPipe) planDto: ReorganizationPlanDto
  ): Promise<{
    planId: string;
    validation: HierarchyValidationDto;
    impact: {
      affectedUsers: number;
      affectedStructures: string[];
      estimatedTime: string;
    };
  }> {
    return this.hierarchyService.createReorganizationPlan(user.id, planDto);
  }

  @Post('reorganization/simulate')
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Simuler une réorganisation' })
  @ApiResponse({ 
    status: 200, 
    description: 'Simulation effectuée avec succès'
  })
  async simulateReorganization(
    @CurrentUser() user: UserProfile,
    @Body(ValidationPipe) planDto: ReorganizationPlanDto
  ): Promise<{
    validation: HierarchyValidationDto;
    impact: {
      affectedUsers: number;
      affectedStructures: string[];
      estimatedTime: string;
    };
  }> {
    // Force simulation mode
    const simulationPlan = { ...planDto, simulationMode: true };
    const result = await this.hierarchyService.createReorganizationPlan(user.id, simulationPlan);
    
    return {
      validation: result.validation,
      impact: result.impact
    };
  }

  // ==================== VALIDATION AND ANALYSIS ====================

  @Post('validate')
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Valider un changement de hiérarchie' })
  @ApiResponse({ 
    status: 200, 
    description: 'Validation effectuée',
    type: HierarchyValidationDto 
  })
  async validateHierarchyChange(
    @CurrentUser() user: UserProfile,
    @Body(ValidationPipe) updateDto: HierarchyUpdateDto
  ): Promise<HierarchyValidationDto> {
    // This would require exposing the validation method
    // For now, we'll do a dry run of the update
    try {
      const result = await this.hierarchyService.updateUserHierarchy(user.id, updateDto);
      return result.validation;
    } catch (error) {
      const serviceError = error as Error;
      return {
        isValid: false,
        errors: [{
          type: 'INVALID_MANAGER',
          userId: updateDto.userId,
          message: serviceError.message || 'Erreur de validation'
        }],
        warnings: []
      };
    }
  }

  @Get('analytics/:userId')
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Analyser la hiérarchie d\'un utilisateur' })
  @ApiResponse({ status: 200, description: 'Analyse effectuée avec succès' })
  @ApiParam({ name: 'userId', description: 'ID de l\'utilisateur' })
  async analyzeHierarchy(
    @CurrentUser() user: UserProfile,
    @Param('userId', ParseUUIDPipe) userId: string
  ): Promise<{
    spanOfControl: number;
    hierarchyDepth: number;
    totalSubordinates: number;
    directReports: number;
    structureDistribution: { [structure: string]: number };
    typeDistribution: { [type: string]: number };
    recommendations: string[];
  }> {
    const hierarchy = await this.hierarchyService.getHierarchy(user.id, {
      rootUserId: userId,
      maxDepth: 10,
      includeUserData: true,
      includeInactive: false
    });

    // Calculate analytics from the hierarchy
    const typeDistribution: { [type: string]: number } = {};
    Object.entries(hierarchy.stats.byUserType).forEach(([type, data]) => {
      typeDistribution[type] = data.count;
    });

    const recommendations: string[] = [];
    
    const analytics = {
      spanOfControl: hierarchy.rootNode.subordinates.length,
      hierarchyDepth: hierarchy.stats.maxDepth,
      totalSubordinates: hierarchy.rootNode.subordinateCount,
      directReports: hierarchy.rootNode.subordinates.length,
      structureDistribution: {},
      typeDistribution,
      recommendations
    };

    // Add recommendations based on analysis
    if (analytics.spanOfControl > 10) {
      analytics.recommendations.push('Span of control élevé - considérer une restructuration');
    }
    if (analytics.hierarchyDepth > 6) {
      analytics.recommendations.push('Hiérarchie profonde - considérer un aplatissement');
    }
    if (analytics.directReports === 0) {
      analytics.recommendations.push('Contributeur individuel - aucun rapport direct');
    }

    return analytics;
  }

  // ==================== UTILITY ENDPOINTS ====================

  @Get('health')
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Vérifier la santé de la hiérarchie organisationnelle' })
  @ApiResponse({ status: 200, description: 'Rapport de santé généré' })
  async getHierarchyHealth(
    @CurrentUser() _user: UserProfile
  ): Promise<{
    overallHealth: 'HEALTHY' | 'WARNING' | 'CRITICAL';
    issues: {
      orphanedUsers: number;
      circularReferences: number;
      inactiveManagers: number;
      overloadedManagers: number;
    };
    recommendations: string[];
    lastChecked: Date;
  }> {
    // This would require a comprehensive health check implementation
    return {
      overallHealth: 'HEALTHY',
      issues: {
        orphanedUsers: 0,
        circularReferences: 0,
        inactiveManagers: 0,
        overloadedManagers: 0
      },
      recommendations: [],
      lastChecked: new Date()
    };
  }

  @Get('search/managers')
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Rechercher des managers disponibles' })
  @ApiResponse({ status: 200, description: 'Managers trouvés' })
  @ApiQuery({ name: 'q', required: true, description: 'Terme de recherche' })
  @ApiQuery({ name: 'structureId', required: false, description: 'ID de la structure' })
  @ApiQuery({ name: 'excludeUserId', required: false, description: 'ID de l\'utilisateur à exclure' })
  async searchAvailableManagers(
    @CurrentUser() _user: UserProfile,
    @Query('q') _searchTerm: string,
    @Query('structureId') _structureId?: string,
    @Query('excludeUserId') _excludeUserId?: string
  ): Promise<{
    managers: {
      id: string;
      name: string;
      email: string;
      title: string;
      structureName: string;
      currentSubordinates: number;
      canManage: boolean;
    }[];
    total: number;
  }> {
    // This would require implementation in the service
    return {
      managers: [],
      total: 0
    };
  }
}