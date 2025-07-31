import { Controller, Post, Body, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { Request } from 'express';
import { 
  ValidationErrorResponseDto, 
  UnauthorizedErrorResponseDto, 
  ForbiddenErrorResponseDto, 
  RateLimitErrorResponseDto, 
  InternalServerErrorResponseDto 
} from '../common/dto';

export class LoginDto {
  @ApiProperty({
    description: 'Adresse email de l\'utilisateur',
    example: 'admin@nyota.edu.cd',
    format: 'email'
  })
  @IsEmail({}, { message: 'Format d\'email invalide' })
  email: string;

  @ApiProperty({
    description: 'Mot de passe de l\'utilisateur',
    example: 'MotDePasseSecure123!',
    minLength: 8,
    writeOnly: true
  })
  @IsString({ message: 'Le mot de passe est requis' })
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  password: string;
}

export class LoginResponseDto {
  @ApiProperty({
    description: 'Token JWT pour l\'authentification',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  accessToken: string;

  @ApiProperty({
    description: 'Token de rafraîchissement',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  refreshToken: string;

  @ApiProperty({
    description: 'Durée de validité du token en secondes',
    example: 3600
  })
  expiresIn: number;

  @ApiProperty({
    description: 'Informations de base sur l\'utilisateur connecté',
    type: 'object',
    properties: {
      id: { 
        type: 'string', 
        format: 'uuid',
        description: 'Identifiant unique de l\'utilisateur'
      },
      email: { 
        type: 'string', 
        format: 'email',
        description: 'Adresse email de l\'utilisateur'
      },
      prenom: { 
        type: 'string',
        description: 'Prénom de l\'utilisateur'
      },
      nom: { 
        type: 'string',
        description: 'Nom de famille de l\'utilisateur'
      },
      scope: { 
        type: 'string', 
        enum: ['MINISTRY', 'SCHOOL'],
        description: 'Portée de l\'utilisateur (Ministère ou École)'
      },
      typeUtilisateur: { 
        type: 'string',
        description: 'Type spécifique de l\'utilisateur selon sa portée'
      }
    }
  })
  user: {
    id: string;
    email: string;
    prenom: string;
    nom: string;
    scope: 'MINISTRY' | 'SCHOOL';
    typeUtilisateur: string;
  };
}


@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Connexion utilisateur',
    description: `
      Authentifie un utilisateur avec son email et mot de passe.
      
      **Fonctionnalités :**
      - Validation des identifiants
      - Génération d'un token JWT
      - Enregistrement de la connexion (audit)
      - Support pour utilisateurs du ministère et d'école
      
      **Sécurité :**
      - Hashage sécurisé des mots de passe avec bcrypt
      - Protection contre les attaques par force brute
      - Logs de sécurité automatiques
      
      **Token JWT :**
      Le token généré contient les informations suivantes :
      - ID utilisateur
      - Email
      - Portée (MINISTRY/SCHOOL)
      - Permissions
      - Expiration (par défaut : 1 heure)
    `
  })
  @ApiBody({ 
    type: LoginDto,
    description: 'Données de connexion de l\'utilisateur'
  })
  @ApiResponse({
    status: 200,
    description: 'Connexion réussie - Token JWT généré',
    type: LoginResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Données de requête invalides (email manquant, format incorrect, etc.)',
    type: ValidationErrorResponseDto,
    example: {
      statusCode: 400,
      message: 'Données de requête invalides',
      error: 'Bad Request',
      timestamp: '2024-07-31T10:30:00.000Z',
      path: '/auth/login',
      details: {
        email: ['Format d\'email invalide'],
        password: ['Le mot de passe doit contenir au moins 8 caractères']
      }
    }
  })
  @ApiResponse({
    status: 401,
    description: 'Identifiants invalides ou compte inactif',
    type: UnauthorizedErrorResponseDto,
    example: {
      statusCode: 401,
      message: 'Identifiants invalides',
      error: 'Unauthorized',
      timestamp: '2024-07-31T10:30:00.000Z',
      path: '/auth/login',
      reason: 'Identifiants incorrects'
    }
  })
  @ApiResponse({
    status: 403,
    description: 'Compte verrouillé ou suspendu',
    type: ForbiddenErrorResponseDto,
    example: {
      statusCode: 403,
      message: 'Compte utilisateur verrouillé',
      error: 'Forbidden',
      timestamp: '2024-07-31T10:30:00.000Z',
      path: '/auth/login',
      action: 'LOGIN'
    }
  })
  @ApiResponse({
    status: 429,
    description: 'Trop de tentatives de connexion - Limite de taux atteinte',
    type: RateLimitErrorResponseDto,
    example: {
      statusCode: 429,
      message: 'Trop de tentatives de connexion. Veuillez réessayer plus tard.',
      error: 'Too Many Requests',
      timestamp: '2024-07-31T10:30:00.000Z',
      path: '/auth/login',
      limit: 5,
      windowMs: 900,
      retryAfter: 600
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Erreur interne du serveur',
    type: InternalServerErrorResponseDto,
    example: {
      statusCode: 500,
      message: 'Erreur interne du serveur',
      error: 'Internal Server Error',
      timestamp: '2024-07-31T10:30:00.000Z',
      path: '/auth/login',
      errorId: 'ERR-2024-07-31-001'
    }
  })
  async login(@Body() loginDto: LoginDto, @Req() req: Request): Promise<LoginResponseDto> {
    const ipAddress = req.ip || req.connection.remoteAddress;
    return this.authService.login(loginDto.email, loginDto.password, ipAddress);
  }
}