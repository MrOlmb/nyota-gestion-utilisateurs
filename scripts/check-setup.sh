#!/bin/bash

# Script de vérification de la configuration NYOTA
# Usage: ./scripts/check-setup.sh

echo "🔍 Vérification de la configuration NYOTA"
echo "========================================"
echo ""

# Codes couleur
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Compteurs
ERRORS=0
WARNINGS=0

# Fonction de vérification
check() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ $2${NC}"
    else
        echo -e "${RED}❌ $2${NC}"
        ((ERRORS++))
    fi
}

warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARNINGS++))
}

# 1. Vérifier la structure des dossiers
echo "📁 Vérification de la structure des dossiers..."
[ -d "prisma" ] && check 0 "Dossier prisma/" || check 1 "Dossier prisma/ manquant"
[ -d "prisma/seeds" ] && check 0 "Dossier prisma/seeds/" || check 1 "Dossier prisma/seeds/ manquant"
[ -d "prisma/migrations" ] && check 0 "Dossier prisma/migrations/" || warn "Dossier prisma/migrations/ manquant (sera créé à la première migration)"
[ -d "src" ] && check 0 "Dossier src/" || check 1 "Dossier src/ manquant"
[ -d "scripts" ] && check 0 "Dossier scripts/" || check 1 "Dossier scripts/ manquant"

echo ""

# 2. Vérifier les fichiers essentiels
echo "📄 Vérification des fichiers essentiels..."
[ -f "prisma/schema.prisma" ] && check 0 "Schema Prisma" || check 1 "Schema Prisma manquant"
[ -f "docker-compose.yml" ] && check 0 "Docker Compose" || check 1 "Docker Compose manquant"
[ -f ".env" ] && check 0 "Fichier .env" || check 1 "Fichier .env manquant"
[ -f "package.json" ] && check 0 "Package.json" || check 1 "Package.json manquant"
[ -f "tsconfig.json" ] && check 0 "TypeScript config" || check 1 "TypeScript config manquant"

echo ""

# 3. Vérifier les fichiers de seed
echo "🌱 Vérification des fichiers de seed..."
[ -f "prisma/seeds/01-reference-data.seed.ts" ] && check 0 "Seed données de référence" || check 1 "Seed données de référence manquant"
[ -f "prisma/seeds/02-security-groups.seed.ts" ] && check 0 "Seed groupes de sécurité" || check 1 "Seed groupes de sécurité manquant"
[ -f "prisma/seeds/03-admin-user.seed.ts" ] && check 0 "Seed utilisateur admin" || check 1 "Seed utilisateur admin manquant"

echo ""

# 4. Vérifier Docker
echo "🐳 Vérification de Docker..."
if command -v docker &> /dev/null; then
    check 0 "Docker installé"
    
    # Vérifier si les conteneurs sont en cours d'exécution
    if docker-compose ps | grep -q "Up"; then
        check 0 "Services Docker en cours d'exécution"
    else
        warn "Services Docker non démarrés. Exécutez: docker-compose up -d"
    fi
else
    check 1 "Docker non installé"
fi

echo ""

# 5. Vérifier Node.js et npm
echo "📦 Vérification de Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    check 0 "Node.js installé ($NODE_VERSION)"
else
    check 1 "Node.js non installé"
fi

if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    check 0 "npm installé ($NPM_VERSION)"
else
    check 1 "npm non installé"
fi

echo ""

# 6. Vérifier les dépendances npm
echo "📚 Vérification des dépendances..."
if [ -d "node_modules" ]; then
    check 0 "Dépendances npm installées"
    
    # Vérifier les dépendances critiques
    [ -d "node_modules/@prisma/client" ] && check 0 "Prisma Client" || warn "Prisma Client manquant. Exécutez: npx prisma generate"
    [ -d "node_modules/ts-node" ] && check 0 "ts-node" || warn "ts-node manquant. Exécutez: npm install"
else
    warn "Dépendances non installées. Exécutez: npm install"
fi

echo ""

# 7. Vérifier la base de données
echo "🗄️ Vérification de la base de données..."
if [ -f ".env" ]; then
    if docker-compose exec -T postgres pg_isready -U nyota_admin &> /dev/null; then
        check 0 "PostgreSQL accessible"
        
        # Vérifier si les migrations ont été exécutées
        if [ -d "prisma/migrations" ] && [ "$(ls -A prisma/migrations)" ]; then
            check 0 "Migrations présentes"
        else
            warn "Aucune migration trouvée. Exécutez: npx prisma migrate dev"
        fi
    else
        warn "PostgreSQL non accessible. Vérifiez que Docker est démarré"
    fi
fi

# 8. Vérifier Redis
echo ""
echo "💾 Vérification de Redis..."
if docker-compose exec -T redis redis-cli -a RedisNyota2024! ping &> /dev/null; then
    check 0 "Redis accessible"
else
    warn "Redis non accessible. Vérifiez que Docker est démarré"
fi

echo ""
echo "========================================"
echo "📊 Résumé:"
echo "  - Erreurs: $ERRORS"
echo "  - Avertissements: $WARNINGS"
echo ""

if [ $ERRORS -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✅ Tout est correctement configuré!${NC}"
        echo ""
        echo "🚀 Vous pouvez maintenant:"
        echo "  1. Exécuter les migrations: npx prisma migrate dev"
        echo "  2. Exécuter les seeds: npm run seed:all"
        echo "  3. Démarrer l'application: npm run start:dev"
    else
        echo -e "${YELLOW}⚠️  Configuration fonctionnelle avec quelques avertissements${NC}"
        echo ""
        echo "Corrigez les avertissements ci-dessus pour une configuration optimale"
    fi
else
    echo -e "${RED}❌ Des erreurs doivent être corrigées avant de continuer${NC}"
    echo ""
    echo "Consultez les erreurs ci-dessus et suivez les instructions"
fi

echo "========================================"