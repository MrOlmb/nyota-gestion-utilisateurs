import { IsOptional, IsString, IsEnum, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { UserMinistryType, UserSchoolType } from '@prisma/client';

export class UserQueryDto {
  @IsOptional()
  @IsString({ message: 'Le terme de recherche doit être une chaîne de caractères' })
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean({ message: 'Le statut actif doit être un booléen' })
  estActif?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La page doit être un nombre entier' })
  @Min(1, { message: 'La page doit être supérieure à 0' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La limite doit être un nombre entier' })
  @Min(1, { message: 'La limite doit être supérieure à 0' })
  @Max(100, { message: 'La limite ne peut pas dépasser 100' })
  limit?: number = 20;

  @IsOptional()
  @IsString({ message: 'Le champ de tri doit être une chaîne de caractères' })
  sortBy?: string = 'creeLe';

  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'L\'ordre de tri doit être "asc" ou "desc"' })
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class MinistryUserQueryDto extends UserQueryDto {
  @IsOptional()
  @IsEnum(UserMinistryType, { message: 'Type d\'utilisateur invalide' })
  typeUtilisateur?: UserMinistryType;

  @IsOptional()
  @IsString({ message: 'L\'ID de la structure doit être une chaîne de caractères' })
  structureId?: string;

  @IsOptional()
  @IsString({ message: 'L\'ID du département doit être une chaîne de caractères' })
  departementGeoId?: string;

  @IsOptional()
  @IsString({ message: 'L\'ID du manager doit être une chaîne de caractères' })
  managerId?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean({ message: 'La valeur doit être un booléen' })
  includeSubordinates?: boolean = false;
}

export class SchoolUserQueryDto extends UserQueryDto {
  @IsOptional()
  @IsEnum(UserSchoolType, { message: 'Type d\'utilisateur invalide' })
  typeUtilisateur?: UserSchoolType;

  @IsOptional()
  @IsString({ message: 'L\'ID de l\'établissement doit être une chaîne de caractères' })
  etablissementId?: string;

  @IsOptional()
  @IsString({ message: 'La classe doit être une chaîne de caractères' })
  classe?: string;

  @IsOptional()
  @IsString({ message: 'La matière doit être une chaîne de caractères' })
  matierePrincipale?: string;
}

export class UserListResponseDto<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}