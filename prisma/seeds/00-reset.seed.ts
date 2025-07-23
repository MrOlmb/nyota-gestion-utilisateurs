/* eslint-disable prettier/prettier */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('🔄 Réinitialisation de la base de données...');

  try {
    // Supprimer les données dans l'ordre inverse des dépendances
    await prisma.$transaction([
      // Audit et sessions
      prisma.auditLog.deleteMany(),
      
      // Sécurité
      prisma.uIRule.deleteMany(),
      prisma.visibilityRule.deleteMany(),
      prisma.groupPermission.deleteMany(),
      prisma.userSecurityGroup.deleteMany(),
      prisma.securityGroup.deleteMany(),
      prisma.businessObject.deleteMany(),
      
      // Demandes
      prisma.establishmentRequest.deleteMany(),
      
      // Utilisateurs et établissements
      prisma.user.deleteMany(),
      prisma.establishment.deleteMany(),
      
      // Données géographiques
      prisma.commune.deleteMany(),
      prisma.geographicDepartment.deleteMany(),
      prisma.region.deleteMany(),
    ]);

    console.log('✅ Base de données réinitialisée avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de la réinitialisation:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution
resetDatabase()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });