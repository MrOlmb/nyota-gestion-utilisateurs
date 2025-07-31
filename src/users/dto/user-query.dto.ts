import { IsOptional, IsString, IsEnum, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { UserMinistryType, UserSchoolType } from '@prisma/client';

export class UserQueryDto {
  @ApiProperty({
    description: 'Terme de recherche global (nom, prénom, email)',
    example: 'Jean Mukendi',
    required: false
  })
  @IsOptional()
  @IsString({ message: 'Le terme de recherche doit être une chaîne de caractères' })
  search?: string;

  @ApiProperty({
    description: 'Filtrer par statut actif',
    example: true,
    required: false
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean({ message: 'Le statut actif doit être un booléen' })
  estActif?: boolean;

  @ApiProperty({
    description: 'Numéro de page pour la pagination',
    example: 1,
    minimum: 1,
    default: 1,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La page doit être un nombre entier' })
  @Min(1, { message: 'La page doit être supérieure à 0' })
  page?: number = 1;

  @ApiProperty({
    description: 'Nombre d\'éléments par page',
    example: 20,
    minimum: 1,
    maximum: 100,
    default: 20,
    required: false
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La limite doit être un nombre entier' })
  @Min(1, { message: 'La limite doit être supérieure à 0' })
  @Max(100, { message: 'La limite ne peut pas dépasser 100' })
  limit?: number = 20;

  @ApiProperty({
    description: 'Champ de tri',
    example: 'creeLe',
    enum: ['creeLe', 'modifieLe', 'nom', 'prenom', 'email', 'derniereConnexion'],
    default: 'creeLe',
    required: false
  })
  @IsOptional()
  @IsString({ message: 'Le champ de tri doit être une chaîne de caractères' })
  sortBy?: string = 'creeLe';

  @ApiProperty({
    description: 'Ordre de tri',
    example: 'desc',
    enum: ['asc', 'desc'],
    default: 'desc',
    required: false
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'L\'ordre de tri doit être "asc" ou "desc"' })
  sortOrder?: 'asc' | 'desc' = 'desc';
}

export class MinistryUserQueryDto extends UserQueryDto {
  @ApiProperty({
    description: 'Type d\'utilisateur du ministère',
    enum: UserMinistryType,
    example: UserMinistryType.DIRECTEUR,
    required: false
  })
  @IsOptional()
  @IsEnum(UserMinistryType, { message: 'Type d\'utilisateur invalide' })
  typeUtilisateur?: UserMinistryType;

  @ApiProperty({
    description: 'ID de la structure d\'affectation',
    example: '789e0123-e89b-12d3-a456-426614174222',
    format: 'uuid',
    required: false
  })
  @IsOptional()
  @IsString({ message: 'L\'ID de la structure doit être une chaîne de caractères' })
  structureId?: string;

  @ApiProperty({
    description: 'ID du département géographique',
    example: 'abc123de-e89b-12d3-a456-426614174333',
    format: 'uuid',
    required: false
  })
  @IsOptional()
  @IsString({ message: 'L\'ID du département doit être une chaîne de caractères' })
  departementGeoId?: string;

  @ApiProperty({
    description: 'ID du manager pour filtrer les subordonnés',
    example: '456e7890-e89b-12d3-a456-426614174111',
    format: 'uuid',
    required: false
  })
  @IsOptional()
  @IsString({ message: 'L\'ID du manager doit être une chaîne de caractères' })
  managerId?: string;

  @ApiProperty({
    description: 'Inclure les données des subordonnés',
    example: false,
    default: false,
    required: false
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean({ message: 'La valeur doit être un booléen' })
  includeSubordinates?: boolean = false;
}

export class SchoolUserQueryDto extends UserQueryDto {
  @ApiProperty({
    description: 'Type d\'utilisateur d\'école',
    enum: UserSchoolType,
    example: UserSchoolType.ENSEIGNANT,
    required: false
  })
  @IsOptional()
  @IsEnum(UserSchoolType, { message: 'Type d\'utilisateur invalide' })
  typeUtilisateur?: UserSchoolType;

  @ApiProperty({
    description: 'ID de l\'établissement scolaire',
    example: 'def456gh-e89b-12d3-a456-426614174444',
    format: 'uuid',
    required: false
  })
  @IsOptional()
  @IsString({ message: 'L\'ID de l\'établissement doit être une chaîne de caractères' })
  etablissementId?: string;

  @ApiProperty({
    description: 'Classe ou niveau scolaire',
    example: '5ème année primaire',
    required: false
  })
  @IsOptional()
  @IsString({ message: 'La classe doit être une chaîne de caractères' })
  classe?: string;

  @ApiProperty({
    description: 'Matière principale enseignée',
    example: 'Mathématiques',
    required: false
  })
  @IsOptional()
  @IsString({ message: 'La matière doit être une chaîne de caractères' })
  matierePrincipale?: string;
}

export class UserListResponseDto<T> {
  @ApiProperty({
    description: 'Liste des utilisateurs correspondant aux critères',
    type: 'array',
    items: { type: 'object' }
  })
  data: T[];

  @ApiProperty({
    description: 'Informations de pagination',
    type: 'object',
    properties: {
      page: {
        type: 'number',
        description: 'Page actuelle',
        example: 1
      },
      limit: {
        type: 'number',
        description: 'Nombre d\'éléments par page',
        example: 20
      },
      total: {
        type: 'number',
        description: 'Nombre total d\'éléments',
        example: 156
      },
      totalPages: {
        type: 'number',
        description: 'Nombre total de pages',
        example: 8
      },
      hasNext: {
        type: 'boolean',
        description: 'Indique s\'il y a une page suivante',
        example: true
      },
      hasPrev: {
        type: 'boolean',
        description: 'Indique s\'il y a une page précédente',
        example: false
      }
    }
  })
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}