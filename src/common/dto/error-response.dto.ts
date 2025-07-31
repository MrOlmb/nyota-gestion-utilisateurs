import { ApiProperty } from '@nestjs/swagger';

export class ErrorResponseDto {
  @ApiProperty({
    description: 'Code de statut HTTP de l\'erreur',
    example: 400,
    type: 'integer'
  })
  statusCode: number;

  @ApiProperty({
    description: 'Message d\'erreur principal',
    example: 'Données de requête invalides'
  })
  message: string;

  @ApiProperty({
    description: 'Type d\'erreur HTTP',
    example: 'Bad Request'
  })
  error: string;

  @ApiProperty({
    description: 'Horodatage de l\'erreur au format ISO 8601',
    example: '2024-07-31T10:30:00.000Z',
    format: 'date-time'
  })
  timestamp: string;

  @ApiProperty({
    description: 'Chemin de la requête qui a causé l\'erreur',
    example: '/users/ministry'
  })
  path: string;
}

export class ValidationErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    description: 'Détails des erreurs de validation par champ',
    example: {
      email: ['Format d\'email invalide'],
      password: ['Le mot de passe doit contenir au moins 8 caractères', 'Le mot de passe doit contenir au moins une majuscule']
    },
    type: 'object',
    additionalProperties: {
      type: 'array',
      items: { type: 'string' }
    }
  })
  details?: Record<string, string[]>;
}

export class ConflictErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    description: 'Champ en conflit',
    example: 'email',
    required: false
  })
  field?: string;

  @ApiProperty({
    description: 'Valeur en conflit',
    example: 'admin@nyota.edu.cd',
    required: false
  })
  value?: string;
}

export class NotFoundErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    description: 'Type de ressource non trouvée',
    example: 'User',
    required: false
  })
  resource?: string;

  @ApiProperty({
    description: 'Identifiant de la ressource non trouvée',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: false
  })
  resourceId?: string;
}

export class UnauthorizedErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    description: 'Raison de l\'échec d\'authentification',
    examples: [
      'Token manquant',
      'Token expiré',
      'Token invalide',
      'Identifiants incorrects'
    ],
    required: false
  })
  reason?: string;
}

export class ForbiddenErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    description: 'Permission requise qui manque',
    example: 'user.management:CREATE',
    required: false
  })
  requiredPermission?: string;

  @ApiProperty({
    description: 'Action tentée',
    example: 'CREATE_MINISTRY_USER',
    required: false
  })
  action?: string;
}

export class RateLimitErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    description: 'Nombre maximum de requêtes autorisées',
    example: 100,
    type: 'integer',
    required: false
  })
  limit?: number;

  @ApiProperty({
    description: 'Fenêtre de temps en secondes',
    example: 3600,
    type: 'integer',
    required: false
  })
  windowMs?: number;

  @ApiProperty({
    description: 'Temps d\'attente avant la prochaine requête (en secondes)',
    example: 1200,
    type: 'integer',
    required: false
  })
  retryAfter?: number;
}

export class InternalServerErrorResponseDto extends ErrorResponseDto {
  @ApiProperty({
    description: 'Identifiant unique de l\'erreur pour le support technique',
    example: 'ERR-2024-07-31-001',
    required: false
  })
  errorId?: string;
}