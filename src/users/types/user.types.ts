import { UserMinistry, UserSchool, UserMinistryType, UserSchoolType, StructureAdministrative, Etablissement, Departement } from '@prisma/client';

// Complete user with all relations
export interface MinistryUserWithRelations extends UserMinistry {
  manager?: Pick<UserMinistry, 'id' | 'prenom' | 'nom' | 'email'> | null;
  subordonnes?: Pick<UserMinistry, 'id' | 'prenom' | 'nom' | 'email'>[];
  structure?: Pick<StructureAdministrative, 'id' | 'nom' | 'code'> | null;
  groupesSecurite?: {
    group: Pick<any, 'id' | 'nom' | 'description'>;
  }[];
}

export interface SchoolUserWithRelations extends UserSchool {
  etablissement?: Pick<Etablissement, 'id' | 'nom' | 'codeEtablissement'> | null;
  parent?: Pick<UserSchool, 'id' | 'prenom' | 'nom' | 'email'> | null;
  enfants?: Pick<UserSchool, 'id' | 'prenom' | 'nom' | 'email'>[];
  groupesSecurite?: {
    group: Pick<any, 'id' | 'nom' | 'description'>;
  }[];
}

// User profile for authentication context
export interface UserProfile {
  id: string;
  email: string;
  scope: 'MINISTRY' | 'SCHOOL';
  typeUtilisateur: UserMinistryType | UserSchoolType;
  structureId?: string | null;
  etablissementId?: string | null;
}

// Error handling types
export interface ServiceError extends Error {
  code?: string;
  statusCode?: number;
}

// Validation result types
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Pagination types
export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginationResult {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Query filter types
export interface BaseQueryFilters {
  search?: string;
  estActif?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface MinistryUserFilters extends BaseQueryFilters {
  typeUtilisateur?: UserMinistryType;
  structureId?: string;
  departementGeoId?: string;
  managerId?: string;
  includeSubordinates?: boolean;
}

export interface SchoolUserFilters extends BaseQueryFilters {
  typeUtilisateur?: UserSchoolType;
  etablissementId?: string;
  classe?: string;
  matierePrincipale?: string;
}