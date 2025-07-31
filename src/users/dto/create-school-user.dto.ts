import { IsEmail, IsString, IsOptional, IsEnum, IsBoolean, IsDateString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserSchoolType } from '@prisma/client';

export class CreateSchoolUserDto {
  @ApiProperty({
    description: 'Adresse email de l\'utilisateur d\'école',
    example: 'enseignant@ecole-kinshasa.edu.cd',
    format: 'email'
  })
  @IsEmail({}, { message: 'Email invalide' })
  email: string;

  @ApiProperty({
    description: 'Mot de passe sécurisé (min 8 caractères avec majuscule, minuscule, chiffre et caractère spécial)',
    example: 'MotDePasseEcole123!',
    minLength: 8,
    maxLength: 128,
    writeOnly: true
  })
  @IsString({ message: 'Le mot de passe est requis' })
  @Length(8, 128, { message: 'Le mot de passe doit contenir entre 8 et 128 caractères' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'
  })
  password: string;

  @ApiProperty({
    description: 'Prénom de l\'utilisateur',
    example: 'Marie',
    minLength: 2,
    maxLength: 50
  })
  @IsString({ message: 'Le prénom est requis' })
  @Length(2, 50, { message: 'Le prénom doit contenir entre 2 et 50 caractères' })
  prenom: string;

  @ApiProperty({
    description: 'Nom de famille de l\'utilisateur',
    example: 'Kabongo',
    minLength: 2,
    maxLength: 50
  })
  @IsString({ message: 'Le nom est requis' })
  @Length(2, 50, { message: 'Le nom doit contenir entre 2 et 50 caractères' })
  nom: string;

  @ApiProperty({
    description: 'Type d\'utilisateur dans l\'école',
    enum: UserSchoolType,
    example: UserSchoolType.ENSEIGNANT,
    enumName: 'UserSchoolType'
  })
  @IsEnum(UserSchoolType, { message: 'Type d\'utilisateur invalide' })
  typeUtilisateur: UserSchoolType;

  @ApiProperty({
    description: 'ID de l\'établissement scolaire',
    example: '789e0123-e89b-12d3-a456-426614174555',
    format: 'uuid'
  })
  @IsString({ message: 'L\'ID de l\'établissement est requis' })
  etablissementId: string;

  @ApiProperty({
    description: 'Matricule de l\'utilisateur (optionnel)',
    example: 'ENS2024001',
    maxLength: 20,
    required: false
  })
  @IsOptional()
  @IsString({ message: 'Le matricule doit être une chaîne de caractères' })
  @Length(0, 20, { message: 'Le matricule ne peut pas dépasser 20 caractères' })
  matricule?: string;

  @ApiProperty({
    description: 'Date de naissance (format ISO 8601)',
    example: '1990-05-15T00:00:00.000Z',
    format: 'date-time',
    required: false
  })
  @IsOptional()
  @IsDateString({}, { message: 'Date de naissance invalide' })
  dateNaissance?: string;

  @ApiProperty({
    description: 'Classe ou niveau d\'enseignement (pour élèves ou enseignants)',
    example: '5ème année primaire',
    maxLength: 50,
    required: false
  })
  @IsOptional()
  @IsString({ message: 'La classe doit être une chaîne de caractères' })
  @Length(0, 50, { message: 'La classe ne peut pas dépasser 50 caractères' })
  classe?: string;

  @ApiProperty({
    description: 'Matière principale enseignée (pour les enseignants)',
    example: 'Mathématiques',
    maxLength: 100,
    required: false
  })
  @IsOptional()
  @IsString({ message: 'La matière principale doit être une chaîne de caractères' })
  @Length(0, 100, { message: 'La matière principale ne peut pas dépasser 100 caractères' })
  matierePrincipale?: string;

  @ApiProperty({
    description: 'ID du parent (pour les élèves)',
    example: 'abc123de-e89b-12d3-a456-426614174666',
    format: 'uuid',
    required: false
  })
  @IsOptional()
  @IsString({ message: 'L\'ID du parent doit être une chaîne de caractères' })
  parentId?: string;

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
    example: ['def456gh-e89b-12d3-a456-426614174777', 'ghi789jk-e89b-12d3-a456-426614174888'],
    type: [String],
    required: false,
    default: []
  })
  @IsOptional()
  @IsString({ message: 'Les groupes de sécurité doivent être un tableau d\'IDs' })
  securityGroupIds?: string[] = [];
}