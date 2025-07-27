import { Injectable, BadRequestException, NotFoundException, Logger, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { PermissionCheckerService, PermissionAction } from '../security/permissions/permission-checker.service';
import { SecurityContextService } from '../security/security-context.service';
import {
  HierarchyNode,
  OrgChartNode,
  HierarchyUpdateDto,
  BulkHierarchyUpdateDto,
  HierarchyQueryDto,
  HierarchyStatsDto,
  HierarchyResponseDto,
  OrgChartResponseDto,
  HierarchyValidationDto,
  ReorganizationPlanDto
} from './dto/hierarchy.dto';
import { UserMinistry, UserMinistryType } from '@prisma/client';
import { ServiceError } from './types/user.types';

@Injectable()
export class HierarchyService {
  private readonly logger = new Logger(HierarchyService.name);
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly MAX_HIERARCHY_DEPTH = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly permissionChecker: PermissionCheckerService,
    private readonly securityContextService: SecurityContextService,
  ) {}

  // ==================== HIERARCHY RETRIEVAL ====================

  async getHierarchy(
    requestUserId: string,
    query: HierarchyQueryDto
  ): Promise<HierarchyResponseDto> {
    // Layer 2: Check permission
    await this.permissionChecker.requirePermission(
      requestUserId,
      'user.management',
      PermissionAction.READ
    );

    const rootUserId = query.rootUserId || requestUserId;

    // Check cache first
    const cacheKey = `hierarchy:${rootUserId}:${JSON.stringify(query)}`;
    const cached = await this.getCachedHierarchy(cacheKey);
    if (cached) {
      return cached;
    }

    // Validate access to root user
    await this.validateHierarchyAccess(requestUserId, rootUserId);

    // Build hierarchy tree
    const rootNode = await this.buildHierarchyTree(rootUserId, query);
    if (!rootNode) {
      throw new NotFoundException('Utilisateur racine introuvable');
    }

    // Calculate statistics
    const stats = await this.calculateHierarchyStats(rootNode, query);

    const response: HierarchyResponseDto = {
      rootNode,
      stats,
      metadata: {
        generatedAt: new Date(),
        requestUserId,
        queryParams: query
      }
    };

    // Cache the result
    await this.cacheHierarchy(cacheKey, response);

    return response;
  }

  async getOrgChart(
    requestUserId: string,
    rootUserId?: string,
    maxDepth: number = 5
  ): Promise<OrgChartResponseDto> {
    // Layer 2: Check permission
    await this.permissionChecker.requirePermission(
      requestUserId,
      'user.management',
      PermissionAction.READ
    );

    const actualRootUserId = rootUserId || requestUserId;

    // Validate access
    await this.validateHierarchyAccess(requestUserId, actualRootUserId);

    // Build org chart
    const chart = await this.buildOrgChart(actualRootUserId, maxDepth);
    if (!chart) {
      throw new NotFoundException('Utilisateur racine introuvable');
    }

    const stats = {
      totalNodes: this.countOrgChartNodes(chart),
      maxDepth: this.calculateOrgChartDepth(chart),
      structureBreakdown: await this.getStructureBreakdown(actualRootUserId, maxDepth)
    };

    return {
      chart,
      stats,
      metadata: {
        generatedAt: new Date(),
        rootUserId: actualRootUserId
      }
    };
  }

  // ==================== HIERARCHY UPDATES ====================

  async updateUserHierarchy(
    requestUserId: string,
    updateDto: HierarchyUpdateDto
  ): Promise<{ success: boolean; validation: HierarchyValidationDto }> {
    // Layer 2: Check permission
    await this.permissionChecker.requirePermission(
      requestUserId,
      'user.management',
      PermissionAction.WRITE,
      { targetUserId: updateDto.userId }
    );

    // Validate the hierarchy change
    const validation = await this.validateHierarchyUpdate(updateDto);
    if (!validation.isValid) {
      throw new BadRequestException(`Changement de hiérarchie invalide: ${validation.errors.map(e => e.message).join(', ')}`);
    }

    // Execute the update
    await this.prisma.$transaction(async (tx) => {
      await tx.userMinistry.update({
        where: { id: updateDto.userId },
        data: {
          managerId: updateDto.newManagerId,
          modifieLe: new Date()
        }
      });

      // Log the change
      await this.logHierarchyChange(requestUserId, updateDto, tx);
    });

    // Invalidate related caches
    await this.invalidateHierarchyCache(updateDto.userId);
    if (updateDto.newManagerId) {
      await this.invalidateHierarchyCache(updateDto.newManagerId);
    }

    // Invalidate security contexts for affected users
    await this.securityContextService.invalidateSecurityContext(updateDto.userId);

    return { success: true, validation };
  }

  async bulkUpdateHierarchy(
    requestUserId: string,
    bulkUpdateDto: BulkHierarchyUpdateDto
  ): Promise<{
    success: boolean;
    successfulUpdates: string[];
    failedUpdates: { userId: string; error: string }[];
    validation: HierarchyValidationDto;
  }> {
    // Layer 2: Check permission for bulk operations
    await this.permissionChecker.requirePermission(
      requestUserId,
      'user.management',
      PermissionAction.WRITE
    );

    const successfulUpdates: string[] = [];
    const failedUpdates: { userId: string; error: string }[] = [];

    // Validate all updates first if strict validation is enabled
    if (bulkUpdateDto.strictValidation) {
      const validation = await this.validateBulkHierarchyUpdates(bulkUpdateDto.updates);
      if (!validation.isValid) {
        return {
          success: false,
          successfulUpdates: [],
          failedUpdates: bulkUpdateDto.updates.map(u => ({
            userId: u.userId,
            error: 'Validation échouée: ' + validation.errors.map(e => e.message).join(', ')
          })),
          validation
        };
      }
    }

    // Execute updates in transaction
    await this.prisma.$transaction(async (tx) => {
      for (const update of bulkUpdateDto.updates) {
        try {
          // Individual validation
          const validation = await this.validateHierarchyUpdate(update);
          if (!validation.isValid) {
            failedUpdates.push({
              userId: update.userId,
              error: validation.errors.map(e => e.message).join(', ')
            });
            continue;
          }

          // Check individual permission
          const hasPermission = await this.permissionChecker.checkPermission(
            requestUserId,
            'user.management',
            PermissionAction.WRITE,
            { targetUserId: update.userId }
          );

          if (!hasPermission.allowed) {
            failedUpdates.push({
              userId: update.userId,
              error: 'Permission refusée'
            });
            continue;
          }

          // Execute update
          await tx.userMinistry.update({
            where: { id: update.userId },
            data: {
              managerId: update.newManagerId,
              modifieLe: new Date()
            }
          });

          // Log the change
          await this.logHierarchyChange(requestUserId, update, tx);
          successfulUpdates.push(update.userId);

        } catch (error) {
          const serviceError = error as ServiceError;
          this.logger.error(`Error updating hierarchy for user ${update.userId}:`, serviceError);
          failedUpdates.push({
            userId: update.userId,
            error: serviceError.message || 'Erreur inconnue'
          });
        }
      }
    });

    // Invalidate caches for all affected users
    const affectedUsers = [...successfulUpdates, ...bulkUpdateDto.updates.map(u => u.newManagerId).filter((id): id is string => Boolean(id))];
    await Promise.all(affectedUsers.map(userId => this.invalidateHierarchyCache(userId)));

    // Invalidate security contexts
    await Promise.all(successfulUpdates.map(userId => 
      this.securityContextService.invalidateSecurityContext(userId)
    ));

    const finalValidation = await this.validateBulkHierarchyUpdates(
      bulkUpdateDto.updates.filter(u => successfulUpdates.includes(u.userId))
    );

    return {
      success: failedUpdates.length === 0,
      successfulUpdates,
      failedUpdates,
      validation: finalValidation
    };
  }

  // ==================== REORGANIZATION PLANNING ====================

  async createReorganizationPlan(
    requestUserId: string,
    planDto: ReorganizationPlanDto
  ): Promise<{
    planId: string;
    validation: HierarchyValidationDto;
    impact: {
      affectedUsers: number;
      affectedStructures: string[];
      estimatedTime: string;
    };
  }> {
    // Layer 2: Check permission for reorganization
    await this.permissionChecker.requirePermission(
      requestUserId,
      'user.management',
      PermissionAction.APPROVE // Reorganization requires approval permission
    );

    // Validate the entire plan
    const validation = await this.validateReorganizationPlan(planDto);

    // Calculate impact
    const impact = await this.calculateReorganizationImpact(planDto.changes);

    // Save the plan (implementation would depend on if you want to store plans)
    const planId = `reorg_${Date.now()}_${requestUserId}`;

    // If not in simulation mode, execute the plan
    if (!planDto.simulationMode) {
      const bulkUpdate: BulkHierarchyUpdateDto = {
        updates: planDto.changes,
        globalReason: `Réorganisation: ${planDto.planName}`,
        strictValidation: true
      };

      await this.bulkUpdateHierarchy(requestUserId, bulkUpdate);
    }

    return {
      planId,
      validation,
      impact
    };
  }

  // ==================== VALIDATION METHODS ====================

  private async validateHierarchyUpdate(updateDto: HierarchyUpdateDto): Promise<HierarchyValidationDto> {
    const errors: HierarchyValidationDto['errors'] = [];
    const warnings: HierarchyValidationDto['warnings'] = [];

    // Check if user exists
    const user = await this.prisma.userMinistry.findUnique({
      where: { id: updateDto.userId },
      include: { structure: true }
    });

    if (!user) {
      errors.push({
        type: 'INVALID_MANAGER',
        userId: updateDto.userId,
        message: 'Utilisateur introuvable'
      });
      return { isValid: false, errors, warnings };
    }

    // If setting a new manager
    if (updateDto.newManagerId) {
      // Check if manager exists
      const manager = await this.prisma.userMinistry.findUnique({
        where: { id: updateDto.newManagerId },
        include: { structure: true }
      });

      if (!manager) {
        errors.push({
          type: 'INVALID_MANAGER',
          userId: updateDto.userId,
          managerId: updateDto.newManagerId,
          message: 'Manager introuvable'
        });
      } else {
        // Check for circular reference
        const wouldCreateCircle = await this.wouldCreateCircularReference(updateDto.userId, updateDto.newManagerId);
        if (wouldCreateCircle.isCircular) {
          errors.push({
            type: 'CIRCULAR_REFERENCE',
            userId: updateDto.userId,
            managerId: updateDto.newManagerId,
            message: 'Cette assignation créerait une référence circulaire',
            path: wouldCreateCircle.path
          });
        }

        // Check hierarchy depth
        const newDepth = await this.calculateUserDepthWithNewManager(updateDto.userId, updateDto.newManagerId);
        if (newDepth > this.MAX_HIERARCHY_DEPTH) {
          errors.push({
            type: 'DEPTH_EXCEEDED',
            userId: updateDto.userId,
            managerId: updateDto.newManagerId,
            message: `La profondeur de hiérarchie dépasserait la limite (${this.MAX_HIERARCHY_DEPTH})`
          });
        }

        // Warning for cross-structure assignment
        if (user.structureId && manager.structureId && user.structureId !== manager.structureId) {
          warnings.push({
            type: 'CROSS_STRUCTURE',
            userId: updateDto.userId,
            message: 'Assignation entre structures différentes',
            recommendation: 'Vérifier si cette assignation est intentionnelle'
          });
        }

        // Warning for inactive manager
        if (!manager.estActif) {
          warnings.push({
            type: 'INACTIVE_MANAGER',
            userId: updateDto.userId,
            message: 'Le manager assigné est inactif',
            recommendation: 'Considérer un manager actif'
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private async validateBulkHierarchyUpdates(updates: HierarchyUpdateDto[]): Promise<HierarchyValidationDto> {
    const allErrors: HierarchyValidationDto['errors'] = [];
    const allWarnings: HierarchyValidationDto['warnings'] = [];

    for (const update of updates) {
      const validation = await this.validateHierarchyUpdate(update);
      allErrors.push(...validation.errors);
      allWarnings.push(...validation.warnings);
    }

    // Additional bulk validation
    const userIds = updates.map(u => u.userId);
    const duplicateUsers = userIds.filter((id, index) => userIds.indexOf(id) !== index);
    
    for (const duplicateUserId of duplicateUsers) {
      allErrors.push({
        type: 'INVALID_MANAGER',
        userId: duplicateUserId,
        message: 'Utilisateur apparaît plusieurs fois dans les mises à jour'
      });
    }

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings
    };
  }

  private async validateReorganizationPlan(planDto: ReorganizationPlanDto): Promise<HierarchyValidationDto> {
    return this.validateBulkHierarchyUpdates(planDto.changes);
  }

  // ==================== HIERARCHY BUILDING ====================

  private async buildHierarchyTree(
    userId: string,
    query: HierarchyQueryDto,
    currentDepth: number = 0
  ): Promise<HierarchyNode | null> {
    if (currentDepth >= (query.maxDepth || 5)) {
      return null;
    }

    const user = await this.prisma.userMinistry.findUnique({
      where: { id: userId },
      include: {
        structure: true,
        subordonnes: {
          where: query.includeInactive ? {} : { estActif: true },
          include: { structure: true }
        }
      }
    });

    if (!user) {
      return null;
    }

    // Filter by user types if specified
    if (query.userTypes && !query.userTypes.includes(user.typeUtilisateur)) {
      return null;
    }

    // Filter by structure if specified
    if (query.structureId && user.structureId !== query.structureId) {
      return null;
    }

    const subordinates: HierarchyNode[] = [];
    
    for (const subordinate of user.subordonnes) {
      const subNode = await this.buildHierarchyTree(subordinate.id, query, currentDepth + 1);
      if (subNode) {
        subordinates.push(subNode);
      }
    }

    return {
      id: user.id,
      email: user.email,
      prenom: user.prenom,
      nom: user.nom,
      typeUtilisateur: user.typeUtilisateur,
      titre: user.titre ?? undefined,
      structureId: user.structureId ?? undefined,
      level: currentDepth,
      managerId: user.managerId ?? undefined,
      subordinates,
      subordinateCount: subordinates.reduce((count, sub) => count + 1 + sub.subordinateCount, 0),
      isDirectReport: currentDepth === 1
    };
  }

  private async buildOrgChart(
    userId: string,
    maxDepth: number,
    currentDepth: number = 0
  ): Promise<OrgChartNode | null> {
    if (currentDepth >= maxDepth) {
      return null;
    }

    const user = await this.prisma.userMinistry.findUnique({
      where: { id: userId },
      include: {
        structure: true,
        subordonnes: {
          where: { estActif: true },
          include: { structure: true }
        }
      }
    });

    if (!user) {
      return null;
    }

    const children: OrgChartNode[] = [];
    
    for (const subordinate of user.subordonnes) {
      const childNode = await this.buildOrgChart(subordinate.id, maxDepth, currentDepth + 1);
      if (childNode) {
        children.push(childNode);
      }
    }

    const totalEmployees = children.reduce((count, child) => count + child.metadata.employeeCount, 0) + 1;

    return {
      id: user.id,
      name: `${user.prenom} ${user.nom}`,
      title: user.titre || user.typeUtilisateur,
      email: user.email,
      managerId: user.managerId ?? undefined,
      children,
      metadata: {
        employeeCount: totalEmployees,
        departmentName: user.structure?.nom,
        structureName: user.structure?.nom,
        isActive: user.estActif,
        level: currentDepth
      }
    };
  }

  // ==================== HELPER METHODS ====================

  private async calculateHierarchyStats(rootNode: HierarchyNode, _query: HierarchyQueryDto): Promise<HierarchyStatsDto> {
    const stats: HierarchyStatsDto = {
      totalUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      maxDepth: 0,
      averageSpanOfControl: 0,
      managersCount: 0,
      individualContributorsCount: 0,
      byLevel: {},
      byUserType: {},
      orphanedUsers: [],
      circularReferences: []
    };

    // Recursive calculation
    this.calculateNodeStats(rootNode, stats);

    // Calculate averages
    if (stats.managersCount > 0) {
      stats.averageSpanOfControl = (stats.totalUsers - 1) / stats.managersCount;
    }

    return stats;
  }

  private calculateNodeStats(node: HierarchyNode, stats: HierarchyStatsDto): void {
    stats.totalUsers++;
    stats.maxDepth = Math.max(stats.maxDepth, node.level);

    // By level
    if (!stats.byLevel[node.level]) {
      stats.byLevel[node.level] = { count: 0, userTypes: {} };
    }
    stats.byLevel[node.level].count++;

    // By user type
    if (!stats.byLevel[node.level].userTypes[node.typeUtilisateur]) {
      stats.byLevel[node.level].userTypes[node.typeUtilisateur] = 0;
    }
    stats.byLevel[node.level].userTypes[node.typeUtilisateur]++;

    if (!stats.byUserType[node.typeUtilisateur]) {
      stats.byUserType[node.typeUtilisateur] = { count: 0, averageSubordinates: 0 };
    }
    stats.byUserType[node.typeUtilisateur].count++;

    // Manager vs IC
    if (node.subordinates.length > 0) {
      stats.managersCount++;
    } else {
      stats.individualContributorsCount++;
    }

    // Recurse
    for (const subordinate of node.subordinates) {
      this.calculateNodeStats(subordinate, stats);
    }
  }

  private async wouldCreateCircularReference(userId: string, newManagerId: string): Promise<{ isCircular: boolean; path: string[] }> {
    const visited = new Set<string>();
    const path: string[] = [];

    let currentId = newManagerId;
    
    while (currentId && !visited.has(currentId)) {
      visited.add(currentId);
      path.push(currentId);

      if (currentId === userId) {
        return { isCircular: true, path };
      }

      const manager = await this.prisma.userMinistry.findUnique({
        where: { id: currentId },
        select: { managerId: true }
      });

      currentId = manager?.managerId ?? undefined;
    }

    return { isCircular: false, path: [] };
  }

  private async calculateUserDepthWithNewManager(_userId: string, newManagerId: string): Promise<number> {
    let depth = 1;
    let currentId = newManagerId;

    while (currentId && depth < this.MAX_HIERARCHY_DEPTH) {
      const manager = await this.prisma.userMinistry.findUnique({
        where: { id: currentId },
        select: { managerId: true }
      });

      if (!manager?.managerId) break;
      
      currentId = manager.managerId;
      depth++;
    }

    return depth;
  }

  private async calculateReorganizationImpact(changes: HierarchyUpdateDto[]): Promise<{
    affectedUsers: number;
    affectedStructures: string[];
    estimatedTime: string;
  }> {
    const affectedUserIds = new Set(changes.map(c => c.userId));
    const affectedStructureIds = new Set<string>();

    // Get structure information for affected users
    const users = await this.prisma.userMinistry.findMany({
      where: { id: { in: Array.from(affectedUserIds) } },
      select: { structureId: true }
    });

    users.forEach(user => {
      if (user.structureId) {
        affectedStructureIds.add(user.structureId);
      }
    });

    return {
      affectedUsers: affectedUserIds.size,
      affectedStructures: Array.from(affectedStructureIds),
      estimatedTime: `${Math.ceil(affectedUserIds.size / 10)} minutes` // Rough estimate
    };
  }

  // ==================== UTILITY METHODS ====================

  private countOrgChartNodes(node: OrgChartNode): number {
    return 1 + node.children.reduce((count, child) => count + this.countOrgChartNodes(child), 0);
  }

  private calculateOrgChartDepth(node: OrgChartNode): number {
    if (node.children.length === 0) return 1;
    return 1 + Math.max(...node.children.map(child => this.calculateOrgChartDepth(child)));
  }

  private async getStructureBreakdown(_rootUserId: string, _maxDepth: number): Promise<{ [structure: string]: number }> {
    // Implementation would involve recursive counting by structure
    return {};
  }

  private async validateHierarchyAccess(requestUserId: string, targetUserId: string): Promise<void> {
    // Check if user has access to view this hierarchy
    const result = await this.permissionChecker.checkPermission(
      requestUserId,
      'user.management',
      PermissionAction.READ,
      { targetUserId }
    );

    if (!result.allowed) {
      throw new ForbiddenException('Accès refusé à cette hiérarchie');
    }
  }

  // ==================== CACHE METHODS ====================

  private async getCachedHierarchy(cacheKey: string): Promise<HierarchyResponseDto | null> {
    try {
      const cached = await this.redis.get(cacheKey);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      this.logger.error('Error getting cached hierarchy:', error);
      return null;
    }
  }

  private async cacheHierarchy(cacheKey: string, data: HierarchyResponseDto): Promise<void> {
    try {
      await this.redis.set(cacheKey, JSON.stringify(data), this.CACHE_TTL);
    } catch (error) {
      this.logger.error('Error caching hierarchy:', error);
    }
  }

  private async invalidateHierarchyCache(userId: string): Promise<void> {
    try {
      // Implementation would involve scanning and deleting matching keys
      // For now, we'll just log it
      this.logger.debug(`Invalidating hierarchy cache for user ${userId}`);
    } catch (error) {
      this.logger.error('Error invalidating hierarchy cache:', error);
    }
  }

  private async logHierarchyChange(requestUserId: string, updateDto: HierarchyUpdateDto, tx: any): Promise<void> {
    try {
      await tx.journalAudit.create({
        data: {
          userMinistryId: requestUserId,
          action: 'HIERARCHY_UPDATE',
          module: 'USER_HIERARCHY',
          idRessource: updateDto.userId,
          typeRessource: 'USER_HIERARCHY',
          detailsApres: {
            newManagerId: updateDto.newManagerId,
            reason: updateDto.reason
          },
          creeLe: new Date()
        }
      });
    } catch (error) {
      this.logger.error('Error logging hierarchy change:', error);
    }
  }
}