import { IsString, IsOptional, IsArray, IsInt, Min, Max, IsBoolean, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export interface HierarchyNode {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  typeUtilisateur: string;
  titre?: string;
  structureId?: string;
  level: number;
  managerId?: string;
  subordinates: HierarchyNode[];
  subordinateCount: number;
  isDirectReport: boolean;
}

export interface OrgChartNode {
  id: string;
  name: string;
  title: string;
  email: string;
  avatar?: string;
  managerId?: string;
  children: OrgChartNode[];
  metadata: {
    employeeCount: number;
    departmentName?: string;
    structureName?: string;
    isActive: boolean;
    level: number;
  };
}

export class HierarchyUpdateDto {
  @IsString({ message: 'L\'ID de l\'utilisateur est requis' })
  userId: string;

  @IsOptional()
  @IsString({ message: 'L\'ID du nouveau manager doit être une chaîne de caractères' })
  newManagerId?: string;

  @IsOptional()
  @IsString({ message: 'Raison du changement requise' })
  reason?: string;
}

export class BulkHierarchyUpdateDto {
  @IsArray({ message: 'Les mises à jour doivent être un tableau' })
  @ValidateNested({ each: true })
  @Type(() => HierarchyUpdateDto)
  updates: HierarchyUpdateDto[];

  @IsOptional()
  @IsString({ message: 'Raison globale du changement' })
  globalReason?: string;

  @IsOptional()
  @IsBoolean({ message: 'Validation strict doit être un booléen' })
  strictValidation?: boolean = true;
}

export class HierarchyQueryDto {
  @IsOptional()
  @IsString({ message: 'L\'ID de l\'utilisateur racine doit être une chaîne de caractères' })
  rootUserId?: string;

  @IsOptional()
  @IsInt({ message: 'La profondeur maximale doit être un nombre entier' })
  @Min(1, { message: 'La profondeur doit être d\'au moins 1' })
  @Max(10, { message: 'La profondeur ne peut pas dépasser 10 niveaux' })
  maxDepth?: number = 5;

  @IsOptional()
  @IsBoolean({ message: 'Inclure les données utilisateur doit être un booléen' })
  includeUserData?: boolean = true;

  @IsOptional()
  @IsBoolean({ message: 'Inclure les inactifs doit être un booléen' })
  includeInactive?: boolean = false;

  @IsOptional()
  @IsArray({ message: 'Les types d\'utilisateur doivent être un tableau' })
  @IsString({ each: true, message: 'Chaque type d\'utilisateur doit être une chaîne' })
  userTypes?: string[];

  @IsOptional()
  @IsString({ message: 'L\'ID de la structure doit être une chaîne de caractères' })
  structureId?: string;
}

export class HierarchyStatsDto {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  maxDepth: number;
  averageSpanOfControl: number;
  managersCount: number;
  individualContributorsCount: number;
  byLevel: {
    [level: number]: {
      count: number;
      userTypes: { [type: string]: number };
    };
  };
  byUserType: {
    [type: string]: {
      count: number;
      averageSubordinates: number;
    };
  };
  orphanedUsers: {
    id: string;
    name: string;
    email: string;
  }[];
  circularReferences: {
    userId: string;
    managerId: string;
    path: string[];
  }[];
}

export class HierarchyResponseDto {
  rootNode: HierarchyNode;
  stats: HierarchyStatsDto;
  metadata: {
    generatedAt: Date;
    requestUserId: string;
    queryParams: HierarchyQueryDto;
  };
}

export class OrgChartResponseDto {
  chart: OrgChartNode;
  stats: {
    totalNodes: number;
    maxDepth: number;
    structureBreakdown: { [structure: string]: number };
  };
  metadata: {
    generatedAt: Date;
    rootUserId: string;
  };
}

export class HierarchyValidationDto {
  isValid: boolean;
  errors: {
    type: 'CIRCULAR_REFERENCE' | 'ORPHANED_USER' | 'INVALID_MANAGER' | 'DEPTH_EXCEEDED' | 'PERMISSION_DENIED';
    userId: string;
    managerId?: string;
    message: string;
    path?: string[];
  }[];
  warnings: {
    type: 'LARGE_SPAN' | 'DEEP_HIERARCHY' | 'INACTIVE_MANAGER' | 'CROSS_STRUCTURE';
    userId: string;
    message: string;
    recommendation?: string;
  }[];
}

export class ReorganizationPlanDto {
  @IsString({ message: 'Le nom du plan est requis' })
  planName: string;

  @IsString({ message: 'La description est requise' })
  description: string;

  @IsArray({ message: 'Les changements doivent être un tableau' })
  @ValidateNested({ each: true })
  @Type(() => HierarchyUpdateDto)
  changes: HierarchyUpdateDto[];

  @IsOptional()
  @IsString({ message: 'Date d\'exécution prévue' })
  scheduledDate?: string;

  @IsOptional()
  @IsBoolean({ message: 'Exécution en mode simulation' })
  simulationMode?: boolean = true;
}