import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  Length,
  Matches,
} from 'class-validator';
import { UserMinistryType } from '@prisma/client';

export class CreateMinistryUserDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString({ message: 'Le mot de passe est requis' })
  @Length(8, 128, {
    message: 'Le mot de passe doit contenir entre 8 et 128 caractères',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial',
  })
  password: string;

  @IsString({ message: 'Le prénom est requis' })
  @Length(2, 50, {
    message: 'Le prénom doit contenir entre 2 et 50 caractères',
  })
  prenom: string;

  @IsString({ message: 'Le nom est requis' })
  @Length(2, 50, { message: 'Le nom doit contenir entre 2 et 50 caractères' })
  nom: string;

  @IsEnum(UserMinistryType, { message: "Type d'utilisateur invalide" })
  typeUtilisateur: UserMinistryType;

  @IsOptional()
  @IsString({ message: 'Le titre doit être une chaîne de caractères' })
  @Length(0, 100, { message: 'Le titre ne peut pas dépasser 100 caractères' })
  titre?: string;

  @IsOptional()
  @IsString({ message: "L'ID du manager doit être une chaîne de caractères" })
  managerId?: string;

  @IsOptional()
  @IsString({
    message: "L'ID de la structure doit être une chaîne de caractères",
  })
  structureId?: string;

  @IsOptional()
  @IsString({
    message:
      "L'ID du département géographique doit être une chaîne de caractères",
  })
  departementGeoId?: string;

  @IsOptional()
  @IsBoolean({ message: 'Le statut actif doit être un booléen' })
  estActif?: boolean = true;

  @IsOptional()
  @IsString({
    message: "Les groupes de sécurité doivent être un tableau d'IDs",
  })
  securityGroupIds?: string[] = [];
}
