# 🚀 Guide de Démarrage Rapide - Module Gestion des Utilisateurs NYOTA

## Prérequis

- Node.js (v18+)
- npm (v9+)
- Docker et Docker Compose
- Git

## Installation Étape par Étape

### 1. Cloner le Repository

```bash
git clone <votre-repo>
cd nyota-gestion-utilisateurs
```

### 2. Installer les Dépendances

```bash
npm install
```

### 3. Créer la Structure des Dossiers

```bash
# Créer tous les dossiers nécessaires
mkdir -p prisma/seeds
mkdir -p prisma/migrations
mkdir -p src/auth
mkdir -p src/users
mkdir -p src/security/{groups,permissions,visibility-rules,ui-rules}
mkdir -p src/cache
mkdir -p src/audit
mkdir -p src/common/{guards,interceptors,decorators,filters,dto}
mkdir -p src/database
mkdir -p scripts
```

### 4. Copier les Fichiers de Configuration

Assurez-vous d'avoir les fichiers suivants à la racine du projet :
- `.env` (depuis le guide)
- `docker-compose.yml`
- `tsconfig.json`
- `package.json`
- `schema.prisma` dans le dossier `prisma/`

### 5. Démarrer les Services Docker

```bash
# Démarrer PostgreSQL et Redis
docker-compose up -d

# Vérifier que les services sont actifs
docker-compose ps
```

### 6. Initialiser Prisma

```bash
# Générer le client Prisma
npx prisma generate

# Exécuter les migrations
npx prisma migrate dev --name init
```

### 7. Exécuter les Scripts de Seed

```bash
# Option 1: Exécuter tous les seeds d'un coup
npm run seed:all

# Option 2: Exécuter les seeds individuellement
npm run seed:reference   # Données géographiques et objets métier
npm run seed:security    # Groupes de sécurité et permissions
npm run seed:admin       # Utilisateur administrateur
```

### 8. Vérifier l'Installation

```bash
# Visualiser les données avec Prisma Studio
npx prisma studio

# Ou vérifier PostgreSQL avec PgAdmin
# URL: http://localhost:5050
# Email: admin@nyota.gov
# Password: PgAdminNyota2024!
```

## 🎯 Démarrage de l'Application

### Mode Développement

```bash
npm run start:dev
```

L'application sera accessible sur : http://localhost:3000

### Comptes de Test Créés

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | admin@nyota.gov | AdminNyota2024! |
| Directeur Régional | directeur.regional@nyota.gov | DirecteurNyota2024! |
| Inspecteur | inspecteur@nyota.gov | InspecteurNyota2024! |
| Analyste | analyste@nyota.gov | AnalysteNyota2024! |
| Directeur École | directeur.ecole@nyota.gov | DirecteurEcole2024! |

## 🛠️ Commandes Utiles

```bash
# Gestion Docker
docker-compose up -d      # Démarrer les services
docker-compose down       # Arrêter les services
docker-compose logs -f    # Voir les logs

# Gestion Base de Données
npm run prisma:generate   # Générer le client Prisma
npm run prisma:migrate    # Exécuter les migrations
npm run prisma:studio     # Interface graphique Prisma

# Seeds
npm run seed:reset        # Réinitialiser la BDD (ATTENTION!)
npm run seed:all          # Exécuter tous les seeds

# Tests
npm test                  # Tests unitaires
npm run test:e2e          # Tests end-to-end
npm run test:cov          # Coverage
```

## 🔍 Résolution des Problèmes

### Erreur "Cannot find module"

```bash
# Réinstaller les dépendances
rm -rf node_modules package-lock.json
npm install
```

### Erreur Prisma

```bash
# Régénérer le client
npx prisma generate
```

### Erreur Docker

```bash
# Redémarrer Docker
docker-compose down -v
docker-compose up -d
```

### Erreur de Permission

```bash
# Sur Linux/Mac
chmod +x scripts/init-project.sh
```

## 📊 Vérification du Système

Une fois l'installation terminée, vérifiez :

1. **PostgreSQL** : 
   - Connection sur `localhost:5432`
   - Base `nyota_users` créée
   - Tables créées par Prisma

2. **Redis** :
   - Connection sur `localhost:6379`
   - Redis Commander sur http://localhost:8081

3. **Application** :
   - API disponible sur http://localhost:3000
   - Documentation Swagger sur http://localhost:3000/api

## 🚀 Prochaines Étapes

1. Créer les contrôleurs et services NestJS
2. Implémenter l'authentification JWT
3. Configurer les guards et intercepteurs
4. Tester les endpoints avec Postman
5. Développer l'interface frontend

---

**Support** : En cas de problème, consultez les logs avec `docker-compose logs -f` ou créez une issue.