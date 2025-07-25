# 📁 Structure du Projet NYOTA - Module Gestion des Utilisateurs

## Vue d'Ensemble

```
nyota-gestion-utilisateurs/
├── prisma/                      # Tout ce qui concerne Prisma ORM
│   ├── schema.prisma           # Schéma de base de données
│   ├── migrations/             # Migrations de base de données
│   │   └── [timestamp]_init/   # Migration initiale
│   └── seeds/                  # Scripts de population de données
│       ├── 00-reset.seed.ts    # Réinitialisation de la BDD
│       ├── 01-reference-data.seed.ts  # Données de référence
│       ├── 02-security-groups.seed.ts # Groupes de sécurité
│       └── 03-admin-user.seed.ts      # Utilisateur admin
│
├── src/                        # Code source de l'application
│   ├── auth/                   # Module d'authentification
│   │   ├── auth.controller.ts  # Endpoints d'authentification
│   │   ├── auth.service.ts     # Logique d'authentification
│   │   ├── auth.module.ts      # Module NestJS
│   │   ├── strategies/         # Stratégies Passport
│   │   └── dto/                # Data Transfer Objects
│   │
│   ├── users/                  # Module de gestion des utilisateurs
│   │   ├── users.controller.ts # Endpoints utilisateurs
│   │   ├── users.service.ts    # Logique métier
│   │   ├── users.module.ts     # Module NestJS
│   │   └── dto/                # DTOs
│   │
│   ├── security/               # Module de sécurité (4 couches)
│   │   ├── groups/             # Gestion des groupes
│   │   ├── permissions/        # Gestion des permissions
│   │   ├── visibility-rules/   # Règles RLS
│   │   └── ui-rules/           # Règles d'interface
│   │
│   ├── cache/                  # Module de cache Redis
│   │   ├── redis.service.ts    # Service Redis
│   │   ├── cache.module.ts     # Module NestJS
│   │   └── cache.decorator.ts  # Décorateurs de cache
│   │
│   ├── audit/                  # Module d'audit
│   │   ├── audit.service.ts    # Service d'audit
│   │   ├── audit.module.ts     # Module NestJS
│   │   └── audit.interceptor.ts # Intercepteur
│   │
│   ├── database/               # Services de base de données
│   │   └── prisma.service.ts   # Service Prisma singleton
│   │
│   ├── common/                 # Éléments partagés
│   │   ├── guards/             # Guards de sécurité
│   │   ├── interceptors/       # Intercepteurs
│   │   ├── decorators/         # Décorateurs custom
│   │   ├── filters/            # Filtres d'exception
│   │   └── dto/                # DTOs communs
│   │
│   ├── app.module.ts           # Module racine
│   └── main.ts                 # Point d'entrée
│
├── scripts/                    # Scripts utilitaires
│   ├── init-project.sh         # Initialisation du projet
│   ├── init-db.sql            # Script SQL d'initialisation
│   └── install.sh             # Installation automatique
│
├── test/                       # Tests
│   ├── unit/                   # Tests unitaires
│   ├── integration/            # Tests d'intégration
│   └── performance/            # Tests de performance
│
├── k8s/                        # Configuration Kubernetes
│   ├── deployment.yaml         # Déploiement
│   ├── service.yaml           # Service
│   └── configmap.yaml         # Configuration
│
├── docker-compose.yml          # Configuration Docker locale
├── Dockerfile                  # Image Docker de l'application
├── .env                        # Variables d'environnement
├── .env.example               # Exemple de variables
├── package.json               # Dépendances npm
├── tsconfig.json              # Configuration TypeScript
├── nest-cli.json              # Configuration NestJS
└── README.md                  # Documentation principale
```

## Détails des Modules

### 🔐 Module Auth (`src/auth/`)
- **Responsabilité** : Authentification JWT, gestion des sessions
- **Services clés** : 
  - Login/Logout
  - Refresh tokens
  - Validation des sessions Redis
  - Protection contre brute-force

### 👥 Module Users (`src/users/`)
- **Responsabilité** : CRUD utilisateurs, gestion des profils
- **Services clés** :
  - Création/modification/suppression d'utilisateurs
  - Gestion de la hiérarchie
  - Import/export en masse

### 🛡️ Module Security (`src/security/`)
- **Responsabilité** : Implémentation du modèle de sécurité 4 couches
- **Sous-modules** :
  - **Groups** : Gestion des groupes de sécurité
  - **Permissions** : Contrôle d'accès (ACL)
  - **Visibility Rules** : Row-Level Security (RLS)
  - **UI Rules** : Contrôle d'affichage

### 💾 Module Cache (`src/cache/`)
- **Responsabilité** : Gestion du cache Redis
- **Services clés** :
  - Cache des permissions
  - Sessions utilisateurs
  - Invalidation intelligente

### 📊 Module Audit (`src/audit/`)
- **Responsabilité** : Traçabilité des actions
- **Services clés** :
  - Journalisation des actions
  - Rapports d'audit
  - Conformité réglementaire

## Conventions de Nommage

### Fichiers
- **Controllers** : `[module].controller.ts`
- **Services** : `[module].service.ts`
- **Modules** : `[module].module.ts`
- **DTOs** : `[action]-[entity].dto.ts` (ex: `create-user.dto.ts`)
- **Guards** : `[functionality].guard.ts` (ex: `jwt-auth.guard.ts`)

### Classes et Interfaces
- **Classes** : PascalCase (ex: `UserService`)
- **Interfaces** : PascalCase avec préfixe 'I' (ex: `IUserProfile`)
- **DTOs** : PascalCase avec suffixe 'Dto' (ex: `CreateUserDto`)
- **Enums** : PascalCase (ex: `UserType`)

### Variables et Fonctions
- **Variables** : camelCase (ex: `userId`)
- **Constantes** : UPPER_SNAKE_CASE (ex: `MAX_LOGIN_ATTEMPTS`)
- **Fonctions** : camelCase (ex: `validateUser()`)

## Flux de Données

```
Client Request
    ↓
API Gateway
    ↓
Guards (Authentication)
    ↓
Controller
    ↓
Service → Redis Cache
    ↓        ↓
Prisma ← → PostgreSQL
    ↓
Response
```

## Points d'Extension

### Ajout d'un Nouveau Module
1. Créer le dossier dans `src/[module-name]/`
2. Créer les fichiers : controller, service, module
3. Importer dans `app.module.ts`
4. Ajouter les tests correspondants

### Ajout d'une Nouvelle Entité
1. Modifier `prisma/schema.prisma`
2. Créer une migration : `npx prisma migrate dev`
3. Créer les DTOs correspondants
4. Implémenter le service et controller

## Scripts NPM Utiles

```bash
# Développement
npm run start:dev      # Démarrage en mode watch
npm run build         # Build de production

# Base de données
npm run prisma:generate   # Générer le client
npm run prisma:migrate    # Migrations
npm run prisma:studio     # Interface graphique

# Seeds
npm run seed:all      # Toutes les seeds
npm run seed:reset    # Réinitialiser la BDD

# Tests
npm test              # Tests unitaires
npm run test:e2e      # Tests E2E
npm run test:cov      # Coverage
```

## Variables d'Environnement Importantes

```env
# Base de données
DATABASE_URL          # URL PostgreSQL
DATABASE_POOL_SIZE    # Taille du pool

# Redis
REDIS_HOST           # Hôte Redis
REDIS_PASSWORD       # Mot de passe

# JWT
JWT_SECRET           # Secret pour les tokens
JWT_EXPIRES_IN       # Durée de vie

# Sécurité
BCRYPTJS_ROUNDS        # Rounds de hashage
MAX_LOGIN_ATTEMPTS   # Tentatives max
```