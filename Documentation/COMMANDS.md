# 🚀 Aide-Mémoire des Commandes NYOTA

## Installation Initiale

```bash
# 1. Installer les dépendances
npm install

# 2. Démarrer Docker
docker-compose up -d

# 3. Générer le client Prisma
npx prisma generate

# 4. Exécuter les migrations
npx prisma migrate dev

# 5. Exécuter les seeds
npm run seed:all

# 6. Vérifier la configuration
chmod +x scripts/check-setup.sh
./scripts/check-setup.sh
```

## Commandes de Développement

### 🐳 Docker

```bash
# Démarrer tous les services
docker-compose up -d

# Arrêter tous les services
docker-compose down

# Voir les logs
docker-compose logs -f

# Redémarrer un service spécifique
docker-compose restart postgres
docker-compose restart redis

# Nettoyer tout (ATTENTION: supprime les données!)
docker-compose down -v
```

### 🗄️ Base de Données

```bash
# Générer le client Prisma
npx prisma generate

# Créer une nouvelle migration
npx prisma migrate dev --name nom_de_la_migration

# Appliquer les migrations en production
npx prisma migrate deploy

# Réinitialiser la BDD (DANGER!)
npx prisma migrate reset

# Ouvrir Prisma Studio (interface graphique)
npx prisma studio

# Exécuter les seeds
npm run seed:all              # Toutes les seeds
npm run seed:reference        # Données de référence uniquement
npm run seed:security         # Groupes de sécurité uniquement
npm run seed:admin           # Utilisateur admin uniquement
npm run seed:reset           # Réinitialiser la BDD

# Seed Prisma officielle
npx prisma db seed
```

### 🏃 Application

```bash
# Développement (avec hot-reload)
npm run start:dev

# Production
npm run build
npm run start:prod

# Mode debug
npm run start:debug

# Linter
npm run lint

# Formatter
npm run format
```

### 🧪 Tests

```bash
# Tests unitaires
npm test

# Tests avec watch
npm run test:watch

# Coverage
npm run test:cov

# Tests E2E
npm run test:e2e

# Tests de performance
npm run test:performance
```

## Accès aux Services

### 🌐 URLs

| Service | URL | Identifiants |
|---------|-----|--------------|
| Application | http://localhost:3000 | - |
| API Docs (Swagger) | http://localhost:3000/api | - |
| PgAdmin | http://localhost:5050 | admin@nyota.gov / PgAdminNyota2024! |
| Redis Commander | http://localhost:8081 | - |
| Prisma Studio | http://localhost:5555 | - |

### 🗄️ Connexions Base de Données

**PostgreSQL**
```
Host: localhost
Port: 5432
Database: nyota_users
Username: nyota_admin
Password: NyotaSecurePass2024!
```

**Redis**
```
Host: localhost
Port: 6379
Password: RedisNyota2024!
```

## Comptes de Test

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Super Admin | admin@nyota.gov | AdminNyota2024! |
| Directeur Régional | directeur.regional@nyota.gov | DirecteurNyota2024! |
| Inspecteur | inspecteur@nyota.gov | InspecteurNyota2024! |
| Analyste | analyste@nyota.gov | AnalysteNyota2024! |
| Directeur École | directeur.ecole@nyota.gov | DirecteurEcole2024! |

## Dépannage Rapide

### ❌ Erreur "Cannot find module"

```bash
rm -rf node_modules package-lock.json
npm install
npx prisma generate
```

### ❌ Erreur Prisma

```bash
npx prisma generate
npx prisma migrate deploy
```

### ❌ Docker ne démarre pas

```bash
# Vérifier l'état
docker-compose ps

# Redémarrer complètement
docker-compose down -v
docker-compose up -d

# Voir les logs
docker-compose logs postgres
docker-compose logs redis
```

### ❌ Port déjà utilisé

```bash
# Trouver le processus utilisant le port 3000
lsof -i :3000

# Tuer le processus
kill -9 <PID>
```

### ❌ Problème de permissions

```bash
# Sur Linux/Mac
chmod +x scripts/*.sh
```

## Scripts Utilitaires

```bash
# Vérifier la configuration complète
./scripts/check-setup.sh

# Installation automatique
./scripts/install.sh

# Initialisation du projet
./scripts/init-project.sh
```

## Alias Recommandés

Ajoutez ces alias dans votre `.bashrc` ou `.zshrc` :

```bash
# NYOTA shortcuts
alias nyota-up='docker-compose up -d'
alias nyota-down='docker-compose down'
alias nyota-logs='docker-compose logs -f'
alias nyota-dev='npm run start:dev'
alias nyota-seed='npm run seed:all'
alias nyota-studio='npx prisma studio'
alias nyota-check='./scripts/check-setup.sh'
```

## Variables d'Environnement Importantes

```env
# Changez ces valeurs en production!
JWT_SECRET=<générer-une-clé-sécurisée>
JWT_REFRESH_SECRET=<générer-une-autre-clé>
DATABASE_URL=<url-de-production>
REDIS_PASSWORD=<mot-de-passe-fort>
```

Générer des clés sécurisées :
```bash
# Générer une clé aléatoire
openssl rand -base64 32
```