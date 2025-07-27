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
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ValidationPipe
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { SecurityGuard } from '../common/guards/security.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PermissionAction } from '../security/permissions/permission-checker.service';
import {
  CreateMinistryUserDto,
  CreateSchoolUserDto,
  UpdateMinistryUserDto,
  UpdateSchoolUserDto,
  MinistryUserResponseDto,
  SchoolUserResponseDto,
  MinistryUserQueryDto,
  SchoolUserQueryDto,
  UserListResponseDto
} from './dto';

interface UserProfile {
  id: string;
  email: string;
  scope: 'MINISTRY' | 'SCHOOL';
}

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(SecurityGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ==================== MINISTRY USERS ====================

  @Post('ministry')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('user.management', PermissionAction.CREATE)
  @ApiOperation({ summary: 'Créer un utilisateur du ministère' })
  @ApiResponse({ 
    status: 201, 
    description: 'Utilisateur créé avec succès',
    type: MinistryUserResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  async createMinistryUser(
    @CurrentUser() user: UserProfile,
    @Body(ValidationPipe) createUserDto: CreateMinistryUserDto
  ): Promise<MinistryUserResponseDto> {
    return this.usersService.createMinistryUser(user.id, createUserDto);
  }

  @Get('ministry')
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Lister les utilisateurs du ministère' })
  @ApiResponse({ 
    status: 200, 
    description: 'Liste des utilisateurs récupérée avec succès'
  })
  @ApiQuery({ name: 'search', required: false, description: 'Terme de recherche' })
  @ApiQuery({ name: 'typeUtilisateur', required: false, description: 'Type d\'utilisateur' })
  @ApiQuery({ name: 'structureId', required: false, description: 'ID de la structure' })
  @ApiQuery({ name: 'departementGeoId', required: false, description: 'ID du département' })
  @ApiQuery({ name: 'managerId', required: false, description: 'ID du manager' })
  @ApiQuery({ name: 'estActif', required: false, description: 'Statut actif', type: Boolean })
  @ApiQuery({ name: 'includeSubordinates', required: false, description: 'Inclure les subordinés', type: Boolean })
  @ApiQuery({ name: 'page', required: false, description: 'Numéro de page', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Nombre d\'éléments par page', type: Number })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Champ de tri' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Ordre de tri', enum: ['asc', 'desc'] })
  async findMinistryUsers(
    @CurrentUser() user: UserProfile,
    @Query(ValidationPipe) query: MinistryUserQueryDto
  ): Promise<UserListResponseDto<MinistryUserResponseDto>> {
    return this.usersService.findMinistryUsers(user.id, query);
  }

  @Get('ministry/:id')
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Récupérer un utilisateur du ministère par ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Utilisateur récupéré avec succès',
    type: MinistryUserResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  async findMinistryUserById(
    @CurrentUser() user: UserProfile,
    @Param('id', ParseUUIDPipe) userId: string
  ): Promise<MinistryUserResponseDto> {
    return this.usersService.findMinistryUserById(user.id, userId);
  }

  @Put('ministry/:id')
  @RequirePermission('user.management', PermissionAction.WRITE)
  @ApiOperation({ summary: 'Mettre à jour un utilisateur du ministère' })
  @ApiResponse({ 
    status: 200, 
    description: 'Utilisateur mis à jour avec succès',
    type: MinistryUserResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  async updateMinistryUser(
    @CurrentUser() user: UserProfile,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body(ValidationPipe) updateUserDto: UpdateMinistryUserDto
  ): Promise<MinistryUserResponseDto> {
    return this.usersService.updateMinistryUser(user.id, userId, updateUserDto);
  }

  @Delete('ministry/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('user.management', PermissionAction.DELETE)
  @ApiOperation({ summary: 'Supprimer un utilisateur du ministère (soft delete)' })
  @ApiResponse({ status: 204, description: 'Utilisateur supprimé avec succès' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  async deleteMinistryUser(
    @CurrentUser() user: UserProfile,
    @Param('id', ParseUUIDPipe) userId: string
  ): Promise<void> {
    return this.usersService.deleteMinistryUser(user.id, userId);
  }

  // ==================== SCHOOL USERS ====================

  @Post('school')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermission('user.management', PermissionAction.CREATE)
  @ApiOperation({ summary: 'Créer un utilisateur d\'école' })
  @ApiResponse({ 
    status: 201, 
    description: 'Utilisateur créé avec succès',
    type: SchoolUserResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  async createSchoolUser(
    @CurrentUser() user: UserProfile,
    @Body(ValidationPipe) createUserDto: CreateSchoolUserDto
  ): Promise<SchoolUserResponseDto> {
    return this.usersService.createSchoolUser(user.id, createUserDto);
  }

  @Get('school')
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Lister les utilisateurs d\'école' })
  @ApiResponse({ 
    status: 200, 
    description: 'Liste des utilisateurs récupérée avec succès'
  })
  @ApiQuery({ name: 'search', required: false, description: 'Terme de recherche' })
  @ApiQuery({ name: 'typeUtilisateur', required: false, description: 'Type d\'utilisateur' })
  @ApiQuery({ name: 'etablissementId', required: false, description: 'ID de l\'établissement' })
  @ApiQuery({ name: 'classe', required: false, description: 'Classe' })
  @ApiQuery({ name: 'matierePrincipale', required: false, description: 'Matière principale' })
  @ApiQuery({ name: 'estActif', required: false, description: 'Statut actif', type: Boolean })
  @ApiQuery({ name: 'page', required: false, description: 'Numéro de page', type: Number })
  @ApiQuery({ name: 'limit', required: false, description: 'Nombre d\'éléments par page', type: Number })
  @ApiQuery({ name: 'sortBy', required: false, description: 'Champ de tri' })
  @ApiQuery({ name: 'sortOrder', required: false, description: 'Ordre de tri', enum: ['asc', 'desc'] })
  async findSchoolUsers(
    @CurrentUser() user: UserProfile,
    @Query(ValidationPipe) query: SchoolUserQueryDto
  ): Promise<UserListResponseDto<SchoolUserResponseDto>> {
    return this.usersService.findSchoolUsers(user.id, query);
  }

  @Get('school/:id')
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Récupérer un utilisateur d\'école par ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Utilisateur récupéré avec succès',
    type: SchoolUserResponseDto 
  })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  async findSchoolUserById(
    @CurrentUser() user: UserProfile,
    @Param('id', ParseUUIDPipe) userId: string
  ): Promise<SchoolUserResponseDto> {
    return this.usersService.findSchoolUserById(user.id, userId);
  }

  @Put('school/:id')
  @RequirePermission('user.management', PermissionAction.WRITE)
  @ApiOperation({ summary: 'Mettre à jour un utilisateur d\'école' })
  @ApiResponse({ 
    status: 200, 
    description: 'Utilisateur mis à jour avec succès',
    type: SchoolUserResponseDto 
  })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  async updateSchoolUser(
    @CurrentUser() user: UserProfile,
    @Param('id', ParseUUIDPipe) userId: string,
    @Body(ValidationPipe) updateUserDto: UpdateSchoolUserDto
  ): Promise<SchoolUserResponseDto> {
    return this.usersService.updateSchoolUser(user.id, userId, updateUserDto);
  }

  @Delete('school/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('user.management', PermissionAction.DELETE)
  @ApiOperation({ summary: 'Supprimer un utilisateur d\'école (soft delete)' })
  @ApiResponse({ status: 204, description: 'Utilisateur supprimé avec succès' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  async deleteSchoolUser(
    @CurrentUser() user: UserProfile,
    @Param('id', ParseUUIDPipe) userId: string
  ): Promise<void> {
    return this.usersService.deleteSchoolUser(user.id, userId);
  }

  // ==================== UTILITY ENDPOINTS ====================

  @Get('profile')
  @ApiOperation({ summary: 'Récupérer le profil de l\'utilisateur connecté' })
  @ApiResponse({ status: 200, description: 'Profil utilisateur récupéré avec succès' })
  async getCurrentUserProfile(
    @CurrentUser() user: UserProfile
  ): Promise<MinistryUserResponseDto | SchoolUserResponseDto> {
    if (user.scope === 'MINISTRY') {
      return this.usersService.findMinistryUserById(user.id, user.id);
    } else {
      return this.usersService.findSchoolUserById(user.id, user.id);
    }
  }

  @Get('ministry/:id/subordinates')
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Récupérer les subordinés d\'un utilisateur du ministère' })
  @ApiResponse({ status: 200, description: 'Subordinés récupérés avec succès' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  async getMinistryUserSubordinates(
    @CurrentUser() user: UserProfile,
    @Param('id', ParseUUIDPipe) userId: string,
    @Query(ValidationPipe) query: MinistryUserQueryDto
  ): Promise<UserListResponseDto<MinistryUserResponseDto>> {
    const queryWithManager = { ...query, managerId: userId };
    return this.usersService.findMinistryUsers(user.id, queryWithManager);
  }

  @Get('school/:id/children')
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Récupérer les enfants d\'un utilisateur d\'école (parent)' })
  @ApiResponse({ status: 200, description: 'Enfants récupérés avec succès' })
  @ApiResponse({ status: 404, description: 'Utilisateur introuvable' })
  async getSchoolUserChildren(
    @CurrentUser() user: UserProfile,
    @Param('id', ParseUUIDPipe) parentId: string,
    @Query(ValidationPipe) query: SchoolUserQueryDto
  ): Promise<UserListResponseDto<SchoolUserResponseDto>> {
    // First verify the parent exists and user has access
    await this.usersService.findSchoolUserById(user.id, parentId);
    
    // Then find children with a custom query
    const queryWithParent = { 
      ...query, 
      search: undefined // Reset search to avoid conflicts
    };
    
    // Create a custom where clause for parent lookup
    const children = await this.usersService.findSchoolUsers(user.id, queryWithParent);
    
    // Filter results by parentId (this would be more efficient with a dedicated service method)
    children.data = children.data.filter(child => child.parentId === parentId);
    children.pagination.total = children.data.length;
    
    return children;
  }

  // ==================== SEARCH AND STATISTICS ====================

  @Get('search')
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Recherche globale d\'utilisateurs' })
  @ApiResponse({ status: 200, description: 'Résultats de recherche récupérés avec succès' })
  @ApiQuery({ name: 'q', required: true, description: 'Terme de recherche' })
  @ApiQuery({ name: 'scope', required: false, description: 'Portée de recherche', enum: ['MINISTRY', 'SCHOOL', 'ALL'] })
  @ApiQuery({ name: 'limit', required: false, description: 'Nombre de résultats', type: Number })
  async searchUsers(
    @CurrentUser() user: UserProfile,
    @Query('q') searchTerm: string,
    @Query('scope') scope: 'MINISTRY' | 'SCHOOL' | 'ALL' = 'ALL',
    @Query('limit') limit: number = 20
  ) {
    const results = {
      ministry: [] as MinistryUserResponseDto[],
      school: [] as SchoolUserResponseDto[],
      total: 0
    };

    if (scope === 'MINISTRY' || scope === 'ALL') {
      const ministryQuery: MinistryUserQueryDto = {
        search: searchTerm,
        page: 1,
        limit: scope === 'ALL' ? Math.ceil(limit / 2) : limit,
        sortBy: 'creeLe',
        sortOrder: 'desc'
      };
      
      const ministryResults = await this.usersService.findMinistryUsers(user.id, ministryQuery);
      results.ministry = ministryResults.data;
      results.total += ministryResults.pagination.total;
    }

    if (scope === 'SCHOOL' || scope === 'ALL') {
      const schoolQuery: SchoolUserQueryDto = {
        search: searchTerm,
        page: 1,
        limit: scope === 'ALL' ? Math.ceil(limit / 2) : limit,
        sortBy: 'creeLe',
        sortOrder: 'desc'
      };
      
      const schoolResults = await this.usersService.findSchoolUsers(user.id, schoolQuery);
      results.school = schoolResults.data;
      results.total += schoolResults.pagination.total;
    }

    return results;
  }

  @Get('statistics')
  @RequirePermission('user.management', PermissionAction.READ)
  @ApiOperation({ summary: 'Statistiques des utilisateurs' })
  @ApiResponse({ status: 200, description: 'Statistiques récupérées avec succès' })
  async getUserStatistics(@CurrentUser() _user: UserProfile) {
    // This would typically be implemented with aggregation queries
    // For now, we'll return a basic structure
    return {
      ministry: {
        total: 0,
        active: 0,
        byType: {},
        byStructure: {}
      },
      school: {
        total: 0,
        active: 0,
        byType: {},
        byEstablishment: {}
      },
      lastUpdated: new Date()
    };
  }
}