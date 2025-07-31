import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Configuration des validations globales
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // Configuration de Swagger/OpenAPI
  const config = new DocumentBuilder()
    .setTitle('NYOTA - Système de Gestion des Utilisateurs')
    .setDescription(`
      API complète pour la gestion des utilisateurs du système NYOTA.
      
      ## Fonctionnalités principales
      - **Authentification** : Connexion sécurisée avec JWT
      - **Gestion des utilisateurs du ministère** : CRUD complet avec hiérarchie
      - **Gestion des utilisateurs d'école** : CRUD complet avec relations parent-enfant
      - **Sécurité avancée** : Permissions granulaires et Row-Level Security (RLS)
      - **Recherche et filtrage** : Recherche globale et filtres avancés
      
      ## Types d'utilisateurs
      - **Ministère** : ADMIN_MINISTERIEL, DIRECTEUR_GENERAL, DIRECTEUR_REGIONAL, INSPECTEUR, COORDINATEUR, TECHNICIEN
      - **École** : DIRECTEUR, ENSEIGNANT, ELEVE, PARENT, PERSONNEL_ADMINISTRATIF
      
      ## Authentification
      Utilisez l'endpoint \`/auth/login\` pour obtenir un token JWT, puis incluez-le dans l'en-tête Authorization :
      \`Authorization: Bearer <votre-token>\`
    `)
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Token JWT obtenu via l\'endpoint de connexion',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Auth', 'Endpoints d\'authentification')
    .addTag('Users', 'Gestion des utilisateurs (ministère et école)')
    .addTag('Hierarchy', 'Gestion de la hiérarchie organisationnelle')
    .addServer('http://localhost:3000', 'Serveur de développement')
    .addServer('https://api.nyota.education.gouv.cd', 'Serveur de production')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
    customSiteTitle: 'NYOTA API Documentation',
    customfavIcon: '/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .info .title { color: #2c5530; }
    `,
  });

  // Activation de CORS si nécessaire
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000', 'http://localhost:4200'],
    credentials: true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  
  console.log(`🚀 Application démarrée sur le port ${port}`);
  console.log(`📚 Documentation Swagger disponible sur : http://localhost:${port}/api`);
}
bootstrap();
