import { UserMinistryType, UserSchoolType } from '@prisma/client';

export class UserResponseDto {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  typeUtilisateur: UserMinistryType | UserSchoolType;
  estActif: boolean;
  derniereConnexion?: Date;
  creeLe: Date;
  modifieLe: Date;
}

export class MinistryUserResponseDto extends UserResponseDto {
  declare typeUtilisateur: UserMinistryType;
  titre?: string;
  managerId?: string;
  structureId?: string;
  departementGeoId?: string;
  
  // Related data
  manager?: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
  };
  
  subordinates?: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
  }[];
  
  structure?: {
    id: string;
    nom: string;
    code: string;
  };
  
  securityGroups?: {
    id: string;
    nom: string;
    description: string;
  }[];
}

export class SchoolUserResponseDto extends UserResponseDto {
  declare typeUtilisateur: UserSchoolType;
  etablissementId: string;
  matricule?: string;
  dateNaissance?: Date;
  classe?: string;
  matierePrincipale?: string;
  parentId?: string;
  
  // Related data
  etablissement?: {
    id: string;
    nom: string;
    codeEtablissement: string;
  };
  
  parent?: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
  };
  
  enfants?: {
    id: string;
    prenom: string;
    nom: string;
    email: string;
  }[];
  
  securityGroups?: {
    id: string;
    nom: string;
    description: string;
  }[];
}