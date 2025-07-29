import { Injectable, ConflictException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { PermissionCheckerService, PermissionAction } from '../security/permissions/permission-checker.service';
import { RLSFilterService } from '../security/filters/rls-filter.service';
import { SecurityContextService } from '../security/security-context.service';
import * as bcryptjs from 'bcryptjs';
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
import { Prisma } from '@prisma/client';
import { MinistryUserWithRelations, SchoolUserWithRelations, ServiceError } from './types/user.types';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionChecker: PermissionCheckerService,
    private readonly rlsFilterService: RLSFilterService,
    private readonly securityContextService: SecurityContextService,
  ) {}

  // ==================== MINISTRY USERS ====================

  async createMinistryUser(
    requestUserId: string,
    createUserDto: CreateMinistryUserDto
  ): Promise<MinistryUserResponseDto> {
    // Layer 2: Check permission
    await this.permissionChecker.requirePermission(
      requestUserId,
      'user.management',
      PermissionAction.CREATE
    );

    // Check if email already exists
    await this.checkEmailUniqueness(createUserDto.email);

    // Hash password
    const passwordHash = await bcryptjs.hash(createUserDto.password, 10);

    // Validate manager hierarchy if provided
    if (createUserDto.managerId) {
      await this.validateManagerHierarchy(requestUserId, createUserDto.managerId);
    }

    // Validate structure access if provided
    if (createUserDto.structureId) {
      await this.validateStructureAccess(requestUserId, createUserDto.structureId);
    }

    try {
      const user = await this.prisma.userMinistry.create({
        data: {
          email: createUserDto.email,
          passwordHash,
          prenom: createUserDto.prenom,
          nom: createUserDto.nom,
          typeUtilisateur: createUserDto.typeUtilisateur,
          titre: createUserDto.titre,
          managerId: createUserDto.managerId,
          structureId: createUserDto.structureId,
          departementGeoId: createUserDto.departementGeoId,
          estActif: createUserDto.estActif ?? true,
        },
        include: {
          manager: {
            select: { id: true, prenom: true, nom: true, email: true }
          },
          structure: {
            select: { id: true, nom: true, code: true }
          }
        }
      });

      // Assign security groups if provided
      if (createUserDto.securityGroupIds && createUserDto.securityGroupIds.length > 0) {
        await this.assignSecurityGroupsToMinistryUser(user.id, createUserDto.securityGroupIds);
      }

      // Audit log
      await this.logUserAction(requestUserId, 'CREATE_MINISTRY_USER', user.id);

      return this.mapMinistryUserToResponse(user);
    } catch (error) {
      const serviceError = error as ServiceError;
      this.logger.error(`Error creating ministry user: ${serviceError.message}`, serviceError);
      throw new BadRequestException('Erreur lors de la création de l\'utilisateur');
    }
  }

  async createSchoolUser(
    requestUserId: string,
    createUserDto: CreateSchoolUserDto
  ): Promise<SchoolUserResponseDto> {
    // Layer 2: Check permission
    await this.permissionChecker.requirePermission(
      requestUserId,
      'user.management',
      PermissionAction.CREATE
    );

    // Check if email already exists
    await this.checkEmailUniqueness(createUserDto.email);

    // Validate establishment access
    await this.validateEstablishmentAccess(requestUserId, createUserDto.etablissementId);

    // Hash password
    const passwordHash = await bcryptjs.hash(createUserDto.password, 10);

    try {
      const user = await this.prisma.userSchool.create({
        data: {
          email: createUserDto.email,
          passwordHash,
          prenom: createUserDto.prenom,
          nom: createUserDto.nom,
          typeUtilisateur: createUserDto.typeUtilisateur,
          etablissementId: createUserDto.etablissementId,
          matricule: createUserDto.matricule,
          dateNaissance: createUserDto.dateNaissance ? new Date(createUserDto.dateNaissance) : null,
          classe: createUserDto.classe,
          matierePrincipale: createUserDto.matierePrincipale,
          parentId: createUserDto.parentId,
          estActif: createUserDto.estActif ?? true,
        },
        include: {
          etablissement: {
            select: { id: true, nom: true, codeEtablissement: true }
          },
          parent: {
            select: { id: true, prenom: true, nom: true, email: true }
          }
        }
      });

      // Assign security groups if provided
      if (createUserDto.securityGroupIds && createUserDto.securityGroupIds.length > 0) {
        await this.assignSecurityGroupsToSchoolUser(user.id, createUserDto.securityGroupIds);
      }

      // Audit log
      await this.logUserAction(requestUserId, 'CREATE_SCHOOL_USER', user.id);

      return this.mapSchoolUserToResponse(user);
    } catch (error) {
      const serviceError = error as ServiceError;
      this.logger.error(`Error creating school user: ${serviceError.message}`, serviceError);
      throw new BadRequestException('Erreur lors de la création de l\'utilisateur');
    }
  }

  async findMinistryUsers(
    requestUserId: string,
    query: MinistryUserQueryDto
  ): Promise<UserListResponseDto<MinistryUserResponseDto>> {
    // Layer 2: Check permission
    await this.permissionChecker.requirePermission(
      requestUserId,
      'user.management',
      PermissionAction.READ
    );

    // Build base query
    const where: Prisma.UserMinistryWhereInput = {
      estActif: query.estActif,
      typeUtilisateur: query.typeUtilisateur,
      structureId: query.structureId,
      departementGeoId: query.departementGeoId,
      managerId: query.managerId,
    };

    // Add search functionality
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { prenom: { contains: query.search, mode: 'insensitive' } },
        { nom: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Layer 3: Apply RLS filters
    const filteredQuery = await this.rlsFilterService.applyFiltersToQuery(
      {
        userId: requestUserId,
        businessObject: 'user.management',
        operation: 'read'
      },
      { where }
    );

    // Calculate pagination - ensure values are properly set
    const page = query.page || 1;
    const limit = query.limit || 20;
    const sortBy = query.sortBy || 'creeLe';
    const sortOrder = query.sortOrder || 'desc';
    
    const skip = (page - 1) * limit;
    const take = limit;

    // Get total count
    const total = await this.prisma.userMinistry.count(filteredQuery);

    // Get users with relations
    const users = await this.prisma.userMinistry.findMany({
      ...filteredQuery,
      include: {
        manager: {
          select: { id: true, prenom: true, nom: true, email: true }
        },
        structure: {
          select: { id: true, nom: true, code: true }
        },
        subordonnes: query.includeSubordinates ? {
          select: { id: true, prenom: true, nom: true, email: true },
          where: { estActif: true }
        } : false,
        groupesSecurite: {
          include: {
            group: {
              select: { id: true, nom: true, description: true }
            }
          },
          where: { estActif: true }
        }
      },
      skip,
      take,
      orderBy: { [sortBy]: sortOrder }
    });

    return {
      data: users.map(user => this.mapMinistryUserToResponse(user)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: skip + take < total,
        hasPrev: page > 1
      }
    };
  }

  async findSchoolUsers(
    requestUserId: string,
    query: SchoolUserQueryDto
  ): Promise<UserListResponseDto<SchoolUserResponseDto>> {
    // Layer 2: Check permission
    await this.permissionChecker.requirePermission(
      requestUserId,
      'user.management',
      PermissionAction.READ
    );

    // Build base query
    const where: Prisma.UserSchoolWhereInput = {
      estActif: query.estActif,
      typeUtilisateur: query.typeUtilisateur,
      etablissementId: query.etablissementId,
      classe: query.classe,
      matierePrincipale: query.matierePrincipale,
    };

    // Add search functionality
    if (query.search) {
      where.OR = [
        { email: { contains: query.search, mode: 'insensitive' } },
        { prenom: { contains: query.search, mode: 'insensitive' } },
        { nom: { contains: query.search, mode: 'insensitive' } },
        { matricule: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // Layer 3: Apply RLS filters
    const filteredQuery = await this.rlsFilterService.applyFiltersToQuery(
      {
        userId: requestUserId,
        businessObject: 'user.management',
        operation: 'read'
      },
      { where }
    );

    // Calculate pagination
    const skip = (query.page! - 1) * query.limit!;
    const take = query.limit!;

    // Get total count
    const total = await this.prisma.userSchool.count(filteredQuery);

    // Get users with relations
    const users = await this.prisma.userSchool.findMany({
      ...filteredQuery,
      include: {
        etablissement: {
          select: { id: true, nom: true, codeEtablissement: true }
        },
        parent: {
          select: { id: true, prenom: true, nom: true, email: true }
        },
        enfants: {
          select: { id: true, prenom: true, nom: true, email: true },
          where: { estActif: true }
        },
        groupesSecurite: {
          include: {
            group: {
              select: { id: true, nom: true, description: true }
            }
          },
          where: { estActif: true }
        }
      },
      skip,
      take,
      orderBy: { [query.sortBy!]: query.sortOrder }
    });

    return {
      data: users.map(user => this.mapSchoolUserToResponse(user)),
      pagination: {
        page: query.page!,
        limit: query.limit!,
        total,
        totalPages: Math.ceil(total / query.limit!),
        hasNext: skip + take < total,
        hasPrev: query.page! > 1
      }
    };
  }

  async findMinistryUserById(
    requestUserId: string,
    userId: string
  ): Promise<MinistryUserResponseDto> {
    // Layer 2: Check permission
    await this.permissionChecker.requirePermission(
      requestUserId,
      'user.management',
      PermissionAction.READ
    );

    // Layer 3: Apply RLS filters
    const filteredQuery = await this.rlsFilterService.applyFiltersToQuery(
      {
        userId: requestUserId,
        businessObject: 'user.management',
        operation: 'read'
      },
      { where: { id: userId } }
    );

    const user = await this.prisma.userMinistry.findFirst({
      ...filteredQuery,
      include: {
        manager: {
          select: { id: true, prenom: true, nom: true, email: true }
        },
        structure: {
          select: { id: true, nom: true, code: true }
        },
        subordonnes: {
          select: { id: true, prenom: true, nom: true, email: true },
          where: { estActif: true }
        },
        groupesSecurite: {
          include: {
            group: {
              select: { id: true, nom: true, description: true }
            }
          },
          where: { estActif: true }
        }
      }
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    return this.mapMinistryUserToResponse(user);
  }

  async findSchoolUserById(
    requestUserId: string,
    userId: string
  ): Promise<SchoolUserResponseDto> {
    // Layer 2: Check permission
    await this.permissionChecker.requirePermission(
      requestUserId,
      'user.management',
      PermissionAction.READ
    );

    // Layer 3: Apply RLS filters
    const filteredQuery = await this.rlsFilterService.applyFiltersToQuery(
      {
        userId: requestUserId,
        businessObject: 'user.management',
        operation: 'read'
      },
      { where: { id: userId } }
    );

    const user = await this.prisma.userSchool.findFirst({
      ...filteredQuery,
      include: {
        etablissement: {
          select: { id: true, nom: true, codeEtablissement: true }
        },
        parent: {
          select: { id: true, prenom: true, nom: true, email: true }
        },
        enfants: {
          select: { id: true, prenom: true, nom: true, email: true },
          where: { estActif: true }
        },
        groupesSecurite: {
          include: {
            group: {
              select: { id: true, nom: true, description: true }
            }
          },
          where: { estActif: true }
        }
      }
    });

    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }

    return this.mapSchoolUserToResponse(user);
  }

  async updateMinistryUser(
    requestUserId: string,
    userId: string,
    updateUserDto: UpdateMinistryUserDto
  ): Promise<MinistryUserResponseDto> {
    // Layer 2: Check permission
    await this.permissionChecker.requirePermission(
      requestUserId,
      'user.management',
      PermissionAction.WRITE,
      { targetUserId: userId }
    );

    // Check if user exists and can be accessed
    const existingUser = await this.findMinistryUserById(requestUserId, userId);

    // Check email uniqueness if email is being changed
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      await this.checkEmailUniqueness(updateUserDto.email);
    }

    // Validate manager hierarchy if being changed
    if (updateUserDto.managerId) {
      await this.validateManagerHierarchy(requestUserId, updateUserDto.managerId);
    }

    // Validate structure access if being changed
    if (updateUserDto.structureId) {
      await this.validateStructureAccess(requestUserId, updateUserDto.structureId);
    }

    try {
      const user = await this.prisma.userMinistry.update({
        where: { id: userId },
        data: {
          email: updateUserDto.email,
          prenom: updateUserDto.prenom,
          nom: updateUserDto.nom,
          typeUtilisateur: updateUserDto.typeUtilisateur,
          titre: updateUserDto.titre,
          managerId: updateUserDto.managerId,
          structureId: updateUserDto.structureId,
          departementGeoId: updateUserDto.departementGeoId,
          estActif: updateUserDto.estActif,
          modifieLe: new Date(),
        },
        include: {
          manager: {
            select: { id: true, prenom: true, nom: true, email: true }
          },
          structure: {
            select: { id: true, nom: true, code: true }
          },
          subordonnes: {
            select: { id: true, prenom: true, nom: true, email: true },
            where: { estActif: true }
          },
          groupesSecurite: {
            include: {
              group: {
                select: { id: true, nom: true, description: true }
              }
            },
            where: { estActif: true }
          }
        }
      });

      // Update security groups if provided
      if (updateUserDto.securityGroupIds) {
        await this.updateMinistryUserSecurityGroups(userId, updateUserDto.securityGroupIds);
      }

      // Invalidate security context cache
      await this.securityContextService.invalidateSecurityContext(userId);

      // Audit log
      await this.logUserAction(requestUserId, 'UPDATE_MINISTRY_USER', userId);

      return this.mapMinistryUserToResponse(user);
    } catch (error) {
      const serviceError = error as ServiceError;
      this.logger.error(`Error updating ministry user: ${serviceError.message}`, serviceError);
      throw new BadRequestException('Erreur lors de la mise à jour de l\'utilisateur');
    }
  }

  async updateSchoolUser(
    requestUserId: string,
    userId: string,
    updateUserDto: UpdateSchoolUserDto
  ): Promise<SchoolUserResponseDto> {
    // Layer 2: Check permission
    await this.permissionChecker.requirePermission(
      requestUserId,
      'user.management',
      PermissionAction.WRITE,
      { targetUserId: userId }
    );

    // Check if user exists and can be accessed
    const existingUser = await this.findSchoolUserById(requestUserId, userId);

    // Check email uniqueness if email is being changed
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      await this.checkEmailUniqueness(updateUserDto.email);
    }

    // Validate establishment access if being changed
    if (updateUserDto.etablissementId) {
      await this.validateEstablishmentAccess(requestUserId, updateUserDto.etablissementId);
    }

    try {
      const user = await this.prisma.userSchool.update({
        where: { id: userId },
        data: {
          email: updateUserDto.email,
          prenom: updateUserDto.prenom,
          nom: updateUserDto.nom,
          typeUtilisateur: updateUserDto.typeUtilisateur,
          etablissementId: updateUserDto.etablissementId,
          matricule: updateUserDto.matricule,
          dateNaissance: updateUserDto.dateNaissance ? new Date(updateUserDto.dateNaissance) : undefined,
          classe: updateUserDto.classe,
          matierePrincipale: updateUserDto.matierePrincipale,
          parentId: updateUserDto.parentId,
          estActif: updateUserDto.estActif,
          modifieLe: new Date(),
        },
        include: {
          etablissement: {
            select: { id: true, nom: true, codeEtablissement: true }
          },
          parent: {
            select: { id: true, prenom: true, nom: true, email: true }
          },
          enfants: {
            select: { id: true, prenom: true, nom: true, email: true },
            where: { estActif: true }
          },
          groupesSecurite: {
            include: {
              group: {
                select: { id: true, nom: true, description: true }
              }
            },
            where: { estActif: true }
          }
        }
      });

      // Update security groups if provided
      if (updateUserDto.securityGroupIds) {
        await this.updateSchoolUserSecurityGroups(userId, updateUserDto.securityGroupIds);
      }

      // Invalidate security context cache
      await this.securityContextService.invalidateSecurityContext(userId);

      // Audit log
      await this.logUserAction(requestUserId, 'UPDATE_SCHOOL_USER', userId);

      return this.mapSchoolUserToResponse(user);
    } catch (error) {
      const serviceError = error as ServiceError;
      this.logger.error(`Error updating school user: ${serviceError.message}`, serviceError);
      throw new BadRequestException('Erreur lors de la mise à jour de l\'utilisateur');
    }
  }

  async deleteMinistryUser(requestUserId: string, userId: string): Promise<void> {
    // Layer 2: Check permission
    await this.permissionChecker.requirePermission(
      requestUserId,
      'user.management',
      PermissionAction.DELETE,
      { targetUserId: userId }
    );

    // Check if user exists and can be accessed
    await this.findMinistryUserById(requestUserId, userId);

    // Soft delete (deactivate) the user
    await this.prisma.userMinistry.update({
      where: { id: userId },
      data: {
        estActif: false,
        modifieLe: new Date(),
      }
    });

    // Invalidate security context cache
    await this.securityContextService.invalidateSecurityContext(userId);

    // Audit log
    await this.logUserAction(requestUserId, 'DELETE_MINISTRY_USER', userId);
  }

  async deleteSchoolUser(requestUserId: string, userId: string): Promise<void> {
    // Layer 2: Check permission
    await this.permissionChecker.requirePermission(
      requestUserId,
      'user.management',
      PermissionAction.DELETE,
      { targetUserId: userId }
    );

    // Check if user exists and can be accessed
    await this.findSchoolUserById(requestUserId, userId);

    // Soft delete (deactivate) the user
    await this.prisma.userSchool.update({
      where: { id: userId },
      data: {
        estActif: false,
        modifieLe: new Date(),
      }
    });

    // Invalidate security context cache
    await this.securityContextService.invalidateSecurityContext(userId);

    // Audit log
    await this.logUserAction(requestUserId, 'DELETE_SCHOOL_USER', userId);
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async checkEmailUniqueness(email: string): Promise<void> {
    const [ministryUser, schoolUser] = await Promise.all([
      this.prisma.userMinistry.findUnique({ where: { email } }),
      this.prisma.userSchool.findUnique({ where: { email } })
    ]);

    if (ministryUser || schoolUser) {
      throw new ConflictException('Cette adresse email est déjà utilisée');
    }
  }

  private async validateManagerHierarchy(_requestUserId: string, managerId: string): Promise<void> {
    // Ensure the manager exists and is active
    const manager = await this.prisma.userMinistry.findUnique({
      where: { id: managerId },
      select: { id: true, estActif: true }
    });

    if (!manager || !manager.estActif) {
      throw new BadRequestException('Manager invalide ou inactif');
    }

    // Additional hierarchy validation can be added here
    // e.g., preventing circular references, ensuring proper hierarchy levels
  }

  private async validateStructureAccess(_requestUserId: string, structureId: string): Promise<void> {
    // Check if structure exists
    const structure = await this.prisma.structureAdministrative.findUnique({
      where: { id: structureId },
      select: { id: true, estActif: true }
    });

    if (!structure || !structure.estActif) {
      throw new BadRequestException('Structure invalide ou inactive');
    }

    // Additional access validation based on requester's permissions
    // This would typically check if the requester has access to assign users to this structure
  }

  private async validateEstablishmentAccess(_requestUserId: string, etablissementId: string): Promise<void> {
    // Check if establishment exists
    const etablissement = await this.prisma.etablissement.findUnique({
      where: { id: etablissementId },
      select: { id: true, estActif: true }
    });

    if (!etablissement || !etablissement.estActif) {
      throw new BadRequestException('Établissement invalide ou inactif');
    }

    // Additional access validation based on requester's permissions
    // This would typically check if the requester has access to assign users to this establishment
  }

  private async assignSecurityGroupsToMinistryUser(userId: string, groupIds: string[]): Promise<void> {
    const assignments = groupIds.map(groupId => ({
      userId,
      groupId,
      assignedAt: new Date(),
      estActif: true
    }));

    await this.prisma.userMinistrySecurityGroup.createMany({
      data: assignments,
      skipDuplicates: true
    });
  }

  private async assignSecurityGroupsToSchoolUser(userId: string, groupIds: string[]): Promise<void> {
    const assignments = groupIds.map(groupId => ({
      userId,
      groupId,
      assignedAt: new Date(),
      estActif: true
    }));

    await this.prisma.userSchoolSecurityGroup.createMany({
      data: assignments,
      skipDuplicates: true
    });
  }

  private async updateMinistryUserSecurityGroups(userId: string, groupIds: string[]): Promise<void> {
    // Deactivate existing assignments
    await this.prisma.userMinistrySecurityGroup.updateMany({
      where: { userId },
      data: { estActif: false }
    });

    // Create new assignments
    if (groupIds.length > 0) {
      await this.assignSecurityGroupsToMinistryUser(userId, groupIds);
    }
  }

  private async updateSchoolUserSecurityGroups(userId: string, groupIds: string[]): Promise<void> {
    // Deactivate existing assignments
    await this.prisma.userSchoolSecurityGroup.updateMany({
      where: { userId },
      data: { estActif: false }
    });

    // Create new assignments
    if (groupIds.length > 0) {
      await this.assignSecurityGroupsToSchoolUser(userId, groupIds);
    }
  }

  private mapMinistryUserToResponse(user: MinistryUserWithRelations): MinistryUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      prenom: user.prenom,
      nom: user.nom,
      typeUtilisateur: user.typeUtilisateur,
      titre: user.titre,
      managerId: user.managerId,
      structureId: user.structureId,
      departementGeoId: user.departementGeoId,
      estActif: user.estActif,
      derniereConnexion: user.derniereConnexion,
      creeLe: user.creeLe,
      modifieLe: user.modifieLe,
      manager: user.manager,
      subordinates: user.subordonnes,
      structure: user.structure,
      securityGroups: user.groupesSecurite?.map(ug => ug.group)
    };
  }

  private mapSchoolUserToResponse(user: SchoolUserWithRelations): SchoolUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      prenom: user.prenom,
      nom: user.nom,
      typeUtilisateur: user.typeUtilisateur,
      etablissementId: user.etablissementId,
      matricule: user.matricule,
      dateNaissance: user.dateNaissance,
      classe: user.classe,
      matierePrincipale: user.matierePrincipale,
      parentId: user.parentId,
      estActif: user.estActif,
      derniereConnexion: user.derniereConnexion,
      creeLe: user.creeLe,
      modifieLe: user.modifieLe,
      etablissement: user.etablissement,
      parent: user.parent,
      enfants: user.enfants,
      securityGroups: user.groupesSecurite?.map(ug => ug.group)
    };
  }

  private async logUserAction(requestUserId: string, action: string, targetUserId: string): Promise<void> {
    try {
      // Determine if requester is ministry or school user
      const ministryUser = await this.prisma.userMinistry.findUnique({
        where: { id: requestUserId },
        select: { id: true }
      });

      await this.prisma.journalAudit.create({
        data: {
          userMinistryId: ministryUser ? requestUserId : null,
          userSchoolId: ministryUser ? null : requestUserId,
          action,
          module: 'USER_MANAGEMENT',
          idRessource: targetUserId,
          typeRessource: 'USER',
          creeLe: new Date()
        }
      });
    } catch (error) {
      const serviceError = error as ServiceError;
      this.logger.error(`Error logging user action: ${serviceError.message}`, serviceError);
      // Don't throw error for audit logging failures
    }
  }
}