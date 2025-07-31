import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserMinistryType } from '@prisma/client';

export class CreateMinistryUserDto {
  @ApiProperty({
    description: 'Adresse email de l\'utilisateur du ministère',
    example: 'directeur@ministry.gouv.cd',
    format: 'email'
  })
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @ApiProperty({
    description: 'Mot de passe sécurisé (min 8 caractères avec majuscule, minuscule, chiffre et caractère spécial)',
    example: 'MotDePasseSecure123!',
    minLength: 8,
    maxLength: 128,
    writeOnly: true
  })
  @IsString({ message: 'Le mot de passe est requis' })
  @Length(8, 128, {
    message: 'Le mot de passe doit contenir entre 8 et 128 caractères',
  })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message:
      'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial',
  })
  password: string;

  @ApiProperty({
    description: 'Prénom de l\'utilisateur',
    example: 'Jean-Baptiste',
    minLength: 2,
    maxLength: 50
  })
  @IsString({ message: 'Le prénom est requis' })
  @Length(2, 50, {
    message: 'Le prénom doit contenir entre 2 et 50 caractères',
  })
  prenom: string;

  @ApiProperty({
    description: 'Nom de famille de l\'utilisateur',
    example: 'Mukendi',
    minLength: 2,
    maxLength: 50
  })
  @IsString({ message: 'Le nom est requis' })
  @Length(2, 50, { message: 'Le nom doit contenir entre 2 et 50 caractères' })
  nom: string;

  @ApiProperty({
    description: 'Type d\'utilisateur dans le ministère',
    enum: UserMinistryType,
    example: UserMinistryType.DIRECTEUR,
    enumName: 'UserMinistryType'
  })
  @IsEnum(UserMinistryType, { message: "Type d'utilisateur invalide" })
  typeUtilisateur: UserMinistryType;

  @ApiProperty({
    description: 'Titre ou fonction de l\'utilisateur (optionnel)',
    example: 'Directeur Régional de l\'Éducation',
    maxLength: 100,
    required: false
  })
  @IsOptional()
  @IsString({ message: 'Le titre doit être une chaîne de caractères' })
  @Length(0, 100, { message: 'Le titre ne peut pas dépasser 100 caractères' })
  titre?: string;

  @ApiProperty({
    description: 'ID du manager hiérarchique (optionnel)',
    example: '123e4567-e89b-12d3-a456-426614174000',
    format: 'uuid',
    required: false
  })
  @IsOptional()
  @IsString({ message: "L'ID du manager doit être une chaîne de caractères" })
  managerId?: string;

  @ApiProperty({
    description: 'ID de la structure d\'affectation (optionnel)',
    example: '456e7890-e89b-12d3-a456-426614174111',
    format: 'uuid',
    required: false
  })
  @IsOptional()
  @IsString({
    message: "L'ID de la structure doit être une chaîne de caractères",
  })
  structureId?: string;

  @ApiProperty({
    description: 'ID du département géographique de compétence (optionnel)',
    example: '789e0123-e89b-12d3-a456-426614174222',
    format: 'uuid',
    required: false
  })
  @IsOptional()
  @IsString({
    message:
      "L'ID du département géographique doit être une chaîne de caractères",
  })
  departementGeoId?: string;

  @ApiProperty({
    description: 'Statut actif de l\'utilisateur',
    example: true,
    default: true,
    required: false
  })
  @IsOptional()
  @IsBoolean({ message: 'Le statut actif doit être un booléen' })
  estActif?: boolean = true;

  @ApiProperty({
    description: 'Liste des IDs des groupes de sécurité à assigner (optionnel)',
    example: ['abc123de-e89b-12d3-a456-426614174333', 'def456gh-e89b-12d3-a456-426614174444'],
    type: [String],
    required: false,
    default: []
  })
  @IsOptional()
  @IsString({
    message: "Les groupes de sécurité doivent être un tableau d'IDs",
  })
  securityGroupIds?: string[] = [];
}
