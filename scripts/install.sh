#!/bin/bash

# Script d'installation automatique du projet NYOTA
# Usage: chmod +x install.sh && ./install.sh

set -e

echo "🚀 Installation du Module Gestion des Utilisateurs NYOTA"
echo "========================================================"
echo ""

# Fonction pour afficher les messages colorés
print_success() {
    echo -e "\033[32m✅ $1\033[0m"
}

print_error() {
    echo -e "\033[31m❌ $1\033[0m"
}

print_info() {
    echo -e "\033[34mℹ️  $1\033[0m"
}

# 1. Vérification des prérequis
print_info "Vérification des prérequis..."

if ! command -v node &> /dev/null; then
    print_error "Node.js n'est pas installé"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    print_error "Docker n'est pas installé"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose n'est pas installé"
    exit 1
fi

print_success "Tous les prérequis sont installés"

# 2. Installation des dépendances
print_info "Installation des dépendances npm..."
npm install
print_success "Dépendances installées"

# 3. Création de la structure des dossiers
print_info "Création de la structure des dossiers..."
mkdir -p prisma/seeds
mkdir -p prisma/migrations
mkdir -p src/auth
mkdir -p src/users
mkdir -p src/security/{groups,permissions,visibility-rules,ui-rules}
mkdir -p src/cache
mkdir -p src/audit
mkdir -p src/common/{guards,interceptors,decorators,filters,dto}
mkdir -p src/database  # Garde le dossier pour les services Prisma
mkdir -p scripts
print_success "Structure des dossiers créée"

# 4. Copier le schéma Prisma si nécessaire
if [ ! -f "prisma/schema.prisma" ]; then
    print_info "Déplacement du schema.prisma..."
    if [ -f "schema.prisma" ]; then
        mv schema.prisma prisma/
        print_success "Schema Prisma déplacé"
    else
        print_error "Fichier schema.prisma non trouvé"
    fi
fi

# 5. Démarrage des services Docker
print_info "Démarrage des services Docker..."
docker-compose up -d

# Attendre que les services soient prêts
print_info "Attente du démarrage des services..."
sleep 10

# Vérifier PostgreSQL
until docker-compose exec -T postgres pg_isready -U nyota_admin &> /dev/null; do
    echo -n "."
    sleep 1
done
echo ""
print_success "PostgreSQL est prêt"

# Vérifier Redis
until docker-compose exec -T redis redis-cli -a RedisNyota2024! ping &> /dev/null; do
    echo -n "."
    sleep 1
done
echo ""
print_success "Redis est prêt"

# 6. Configuration de Prisma
print_info "Configuration de Prisma..."
npx prisma generate
print_success "Client Prisma généré"

# 7. Exécution des migrations
print_info "Exécution des migrations..."
npx prisma migrate dev --name init --skip-seed
print_success "Migrations exécutées"

# 8. Installation de ts-node si nécessaire
if ! npm list ts-node &> /dev/null; then
    print_info "Installation de ts-node..."
    npm install --save-dev ts-node tsconfig-paths
    print_success "ts-node installé"
fi

# 9. Exécution des seeds
print_info "Insertion des données de référence..."
npm run seed:reference
print_success "Données de référence insérées"

print_info "Création des groupes de sécurité..."
npm run seed:security
print_success "Groupes de sécurité créés"

print_info "Création de l'utilisateur administrateur..."
npm run seed:admin
print_success "Utilisateur administrateur créé"

# 10. Affichage des informations
echo ""
echo "========================================"
echo "✅ Installation terminée avec succès!"
echo "========================================"
echo ""
echo "📌 Services disponibles:"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo "  - PgAdmin: http://localhost:5050"
echo "  - Redis Commander: http://localhost:8081"
echo ""
echo "👤 Compte administrateur:"
echo "  - Email: admin@nyota.gov"
echo "  - Mot de passe: AdminNyota2024!"
echo ""
echo "🚀 Pour démarrer l'application:"
echo "  npm run start:dev"
echo ""
echo "📚 Pour voir la documentation:"
echo "  cat README_QUICKSTART.md"
echo "========================================"