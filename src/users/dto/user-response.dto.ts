import { ApiProperty } from '@nestjs/swagger';
import { UserMinistryType, UserSchoolType } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({
    description: 'Identifiant unique de l\'utilisateur',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid'
  })
  id: string;

  @ApiProperty({
    description: 'Adresse email de l\'utilisateur',
    example: 'utilisateur@nyota.edu.cd',
    format: 'email'
  })
  email: string;

  @ApiProperty({
    description: 'Prénom de l\'utilisateur',
    example: 'Jean'
  })
  prenom: string;

  @ApiProperty({
    description: 'Nom de famille de l\'utilisateur',
    example: 'Mukendi'
  })
  nom: string;

  @ApiProperty({
    description: 'Type de l\'utilisateur',
    example: 'DIRECTEUR_REGIONAL',
    oneOf: [
      { $ref: '#/components/schemas/UserMinistryType' },
      { $ref: '#/components/schemas/UserSchoolType' }
    ]
  })
  typeUtilisateur: UserMinistryType | UserSchoolType;

  @ApiProperty({
    description: 'Statut actif de l\'utilisateur',
    example: true
  })
  estActif: boolean;

  @ApiProperty({
    description: 'Date et heure de la dernière connexion',
    example: '2024-07-31T08:30:00.000Z',
    format: 'date-time',
  })
  derniereConnexion?: Date;

  @ApiProperty({
    description: 'Date et heure de création du compte',
    example: '2024-07-01T10:00:00.000Z',
    format: 'date-time'
  })
  creeLe: Date;

  @ApiProperty({
    description: 'Date et heure de dernière modification',
    example: '2024-07-30T15:45:00.000Z',
    format: 'date-time'
  })
  modifieLe: Date;
}

export class MinistryUserResponseDto extends UserResponseDto {
  @ApiProperty({
    description: 'Type spécifique d\'utilisateur du ministère',
    enum: UserMinistryType,
    example: UserMinistryType.DIRECTEUR
  })
  declare typeUtilisateur: UserMinistryType;

  @ApiProperty({
    description: 'Titre ou fonction dans le ministère',
    example: 'Directeur Régional de l\'Éducation',
  })
  titre?: string;

  @ApiProperty({
    description: 'ID du manager hiérarchique',
    example: '456e7890-e89b-12d3-a456-426614174111',
    format: 'uuid',
  })
  managerId?: string;

  @ApiProperty({
    description: 'ID de la structure d\'affectation',
    example: '789e0123-e89b-12d3-a456-426614174222',
    format: 'uuid',
  })
  structureId?: string;

  @ApiProperty({
    description: 'ID du département géographique',
    example: 'abc123de-e89b-12d3-a456-426614174333',
    format: 'uuid',
  })
  departementGeoId?: string;
  
  // Related data
  @ApiProperty({
    description: 'Informations du manager (si applicable)',
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      prenom: { type: 'string' },
      nom: { type: 'string' },
      email: { type: 'string', format: 'email' }
    },
  })
  manager?: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
  };
  
  @ApiProperty({
    description: 'Liste des subordonnés directs',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        prenom: { type: 'string' },
        nom: { type: 'string' },
        email: { type: 'string', format: 'email' }
      }
    },
  })
  subordinates?: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
  }[];
  
  @ApiProperty({
    description: 'Informations de la structure d\'affectation',
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      nom: { type: 'string' },
      code: { type: 'string' }
    },
  })
  structure?: {
    id: string;
    nom: string;
    code: string;
  };
  
  @ApiProperty({
    description: 'Groupes de sécurité assignés',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        nom: { type: 'string' },
        description: { type: 'string' }
      }
    },
  })
  securityGroups?: {
    id: string;
    nom: string;
    description: string;
  }[];
}

export class SchoolUserResponseDto extends UserResponseDto {
  @ApiProperty({
    description: 'Type spécifique d\'utilisateur d\'école',
    enum: UserSchoolType,
    example: UserSchoolType.ENSEIGNANT
  })
  declare typeUtilisateur: UserSchoolType;

  @ApiProperty({
    description: 'ID de l\'établissement scolaire',
    example: 'def456gh-e89b-12d3-a456-426614174444',
    format: 'uuid'
  })
  etablissementId: string;

  @ApiProperty({
    description: 'Matricule de l\'utilisateur',
    example: 'ENS2024001',
  })
  matricule?: string;

  @ApiProperty({
    description: 'Date de naissance',
    example: '1990-05-15T00:00:00.000Z',
    format: 'date-time',
  })
  dateNaissance?: Date;

  @ApiProperty({
    description: 'Classe ou niveau',
    example: '5ème année primaire',
  })
  classe?: string;

  @ApiProperty({
    description: 'Matière principale enseignée',
    example: 'Mathématiques',
  })
  matierePrincipale?: string;

  @ApiProperty({
    description: 'ID du parent (pour les élèves)',
    example: 'ghi789jk-e89b-12d3-a456-426614174555',
    format: 'uuid',
  })
  parentId?: string;
  
  // Related data
  @ApiProperty({
    description: 'Informations de l\'établissement',
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      nom: { type: 'string' },
      codeEtablissement: { type: 'string' }
    },
  })
  etablissement?: {
    id: string;
    nom: string;
    codeEtablissement: string;
  };
  
  @ApiProperty({
    description: 'Informations du parent (pour les élèves)',
    type: 'object',
    properties: {
      id: { type: 'string', format: 'uuid' },
      prenom: { type: 'string' },
      nom: { type: 'string' },
      email: { type: 'string', format: 'email' }
    },
  })
  parent?: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
  };
  
  @ApiProperty({
    description: 'Liste des enfants (pour les parents)',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        prenom: { type: 'string' },
        nom: { type: 'string' },
        email: { type: 'string', format: 'email' }
      }
    },
  })
  enfants?: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
  }[];
  
  @ApiProperty({
    description: 'Groupes de sécurité assignés',
    type: 'array',
    items: {
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        nom: { type: 'string' },
        description: { type: 'string' }
      }
    },
  })
  securityGroups?: {
    id: string;
    nom: string;
    description: string;
  }[];
}