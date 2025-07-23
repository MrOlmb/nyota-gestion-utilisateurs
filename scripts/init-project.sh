#!/bin/bash

# Script d'initialisation du projet NYOTA - Module Gestion des Utilisateurs
# Usage: ./scripts/init-project.sh

set -e

echo "🚀 Initialisation du Module Gestion des Utilisateurs NYOTA"
echo "========================================================="

# Vérification des prérequis
echo "📋 Vérification des prérequis..."

command -v node >/dev/null 2>&1 || { echo "❌ Node.js n'est pas installé. Installation requise."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm n'est pas installé. Installation requise."; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "❌ Docker n'est pas installé. Installation requise."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || { echo "❌ Docker Compose n'est pas installé. Installation requise."; exit 1; }

echo "✅ Tous les prérequis sont installés"

# Création des dossiers nécessaires
echo ""
echo "📁 Création de la structure des dossiers..."
mkdir -p prisma/seeds
mkdir -p prisma/migrations
mkdir -p src/auth
mkdir -p src/users
mkdir -p src/security/{groups,permissions,visibility-rules,ui-rules}
mkdir -p src/cache
mkdir -p src/audit
mkdir -p src/common/{guards,interceptors,decorators,filters,dto}
mkdir -p src/database  # Pour le service Prisma
mkdir -p scripts

echo "✅ Structure des dossiers créée"

# Démarrage des services Docker
echo ""
echo "🐳 Démarrage des services Docker..."
docker-compose up -d

# Attente que PostgreSQL soit prêt
echo "⏳ Attente du démarrage de PostgreSQL..."
until docker-compose exec -T postgres pg_isready -U nyota_admin > /dev/null 2>&1; do
  echo -n "."
  sleep 1
done
echo " ✅ PostgreSQL est prêt"

# Attente que Redis soit prêt
echo "⏳ Attente du démarrage de Redis..."
until docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
  echo -n "."
  sleep 1
done
echo " ✅ Redis est prêt"

# Configuration de Prisma
echo ""
echo "🔧 Configuration de Prisma..."
npx prisma init --skip-env

# Génération du client Prisma
echo "📦 Génération du client Prisma..."
npx prisma generate

# Exécution des migrations
echo "🗄️ Exécution des migrations de base de données..."
npx prisma migrate dev --name init --skip-seed

# Installation de ts-node si nécessaire
echo ""
echo "📦 Installation de ts-node..."
npm install --save-dev ts-node tsconfig-paths

# Création des données de base
echo ""
echo "🌱 Insertion des données de référence..."
npm run seed:reference

# Création des groupes de sécurité par défaut
echo ""
echo "🔐 Création des groupes de sécurité..."
npm run seed:security

# Création d'un utilisateur administrateur
echo ""
echo "👤 Création de l'utilisateur administrateur..."
npm run seed:admin

# Test de connexion Redis
echo ""
echo "🔍 Test de connexion Redis..."
docker exec nyota-redis redis-cli -a RedisNyota2024! ping

# Affichage des informations de connexion
echo ""
echo "✅ Initialisation terminée avec succès!"
echo ""
echo "📌 Informations de connexion:"
echo "=============================="
echo "PostgreSQL:"
echo "  - Host: localhost:5432"
echo "  - Database: nyota_users"
echo "  - User: nyota_admin"
echo "  - Password: NyotaSecurePass2024!"
echo ""
echo "Redis:"
echo "  - Host: localhost:6379"
echo "  - Password: RedisNyota2024!"
echo ""
echo "PgAdmin:"
echo "  - URL: http://localhost:5050"
echo "  - Email: admin@nyota.gov"
echo "  - Password: PgAdminNyota2024!"
echo ""
echo "Redis Commander:"
echo "  - URL: http://localhost:8081"
echo ""
echo "Application:"
echo "  - URL: http://localhost:3000"
echo "  - Admin Email: admin@nyota.gov"
echo "  - Admin Password: AdminNyota2024!"
echo ""
echo "🎯 Prochaine étape: npm run start:dev"