import { IsEmail, IsString, IsOptional, IsEnum, IsBoolean, IsDateString, Length, Matches } from 'class-validator';
import { UserSchoolType } from '@prisma/client';

export class CreateSchoolUserDto {
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @IsString({ message: 'Le mot de passe est requis' })
  @Length(8, 128, { message: 'Le mot de passe doit contenir entre 8 et 128 caractères' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'
  })
  password: string;

  @IsString({ message: 'Le prénom est requis' })
  @Length(2, 50, { message: 'Le prénom doit contenir entre 2 et 50 caractères' })
  prenom: string;

  @IsString({ message: 'Le nom est requis' })
  @Length(2, 50, { message: 'Le nom doit contenir entre 2 et 50 caractères' })
  nom: string;

  @IsEnum(UserSchoolType, { message: 'Type d\'utilisateur invalide' })
  typeUtilisateur: UserSchoolType;

  @IsString({ message: 'L\'ID de l\'établissement est requis' })
  etablissementId: string;

  @IsOptional()
  @IsString({ message: 'Le matricule doit être une chaîne de caractères' })
  @Length(0, 20, { message: 'Le matricule ne peut pas dépasser 20 caractères' })
  matricule?: string;

  @IsOptional()
  @IsDateString({}, { message: 'Date de naissance invalide' })
  dateNaissance?: string;

  @IsOptional()
  @IsString({ message: 'La classe doit être une chaîne de caractères' })
  @Length(0, 50, { message: 'La classe ne peut pas dépasser 50 caractères' })
  classe?: string;

  @IsOptional()
  @IsString({ message: 'La matière principale doit être une chaîne de caractères' })
  @Length(0, 100, { message: 'La matière principale ne peut pas dépasser 100 caractères' })
  matierePrincipale?: string;

  @IsOptional()
  @IsString({ message: 'L\'ID du parent doit être une chaîne de caractères' })
  parentId?: string;

  @IsOptional()
  @IsBoolean({ message: 'Le statut actif doit être un booléen' })
  estActif?: boolean = true;

  @IsOptional()
  @IsString({ message: 'Les groupes de sécurité doivent être un tableau d\'IDs' })
  securityGroupIds?: string[] = [];
}