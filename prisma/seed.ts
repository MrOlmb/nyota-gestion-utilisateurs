import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Démarrage du processus de seed...\n');

  try {
    // Exécuter les seeds dans l'ordre
    console.log('1️⃣ Insertion des données de référence...');
    execSync('ts-node prisma/seeds/01-reference-data.seed.ts', {
      stdio: 'inherit',
    });

    console.log('\n2️⃣ Création des groupes de sécurité...');
    execSync('ts-node prisma/seeds/02-security-groups.seed.ts', {
      stdio: 'inherit',
    });

    console.log("\n3️⃣ Création de l'utilisateur administrateur...");
    execSync('ts-node prisma/seeds/03-admin-user.seed.ts', {
      stdio: 'inherit',
    });

    console.log('\n✅ Processus de seed terminé avec succès!');
  } catch (error) {
    console.error('❌ Erreur lors du processus de seed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
