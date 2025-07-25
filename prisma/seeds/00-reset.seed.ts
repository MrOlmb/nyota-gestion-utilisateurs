import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('🔄 Réinitialisation de la base de données...');

  try {
    // Supprimer les données dans l'ordre inverse des dépendances
    await prisma.$transaction([
      // Audit
      prisma.journalAudit.deleteMany(),

      // Évaluations et inspections
      prisma.evaluationCritere.deleteMany(),
      prisma.critereInspection.deleteMany(),
      prisma.inspectionEtablissement.deleteMany(),
      prisma.typeInspection.deleteMany(),

      // Finances
      prisma.subventionEtablissement.deleteMany(),
      prisma.budgetEtablissement.deleteMany(),

      // Infrastructures
      prisma.infrastructureEtablissement.deleteMany(),
      prisma.typeInfrastructure.deleteMany(),

      // Autorisations
      prisma.autorisationEtablissement.deleteMany(),
      prisma.typeAutorisation.deleteMany(),

      // Workflow
      prisma.etapeWorkflow.deleteMany(),
      prisma.demandeEtablissement.deleteMany(),

      // Sécurité - UI Rules
      prisma.uIRuleSchool.deleteMany(),
      prisma.uIRuleMinistry.deleteMany(),

      // Sécurité - Visibility Rules
      prisma.visibilityRuleSchool.deleteMany(),
      prisma.visibilityRuleMinistry.deleteMany(),

      // Sécurité - Permissions
      prisma.groupPermissionSchool.deleteMany(),
      prisma.groupPermissionMinistry.deleteMany(),

      // Sécurité - User Groups
      prisma.userSchoolSecurityGroup.deleteMany(),
      prisma.userMinistrySecurityGroup.deleteMany(),

      // Sécurité - Groups
      prisma.securityGroupSchool.deleteMany(),
      prisma.securityGroupMinistry.deleteMany(),

      // Business Objects
      prisma.businessObject.deleteMany(),

      // Utilisateurs (UserSchool d'abord à cause de la FK vers Etablissement)
      prisma.userSchool.deleteMany(),

      // Établissements (après UserSchool, avant UserMinistry car ils ont des FK vers UserMinistry)
      prisma.etablissement.deleteMany(),

      // UserMinistry (en dernier car référencé par Etablissement)
      prisma.userMinistry.deleteMany(),

      // Structure administrative
      prisma.structureAdministrative.deleteMany(),
      prisma.administration.deleteMany(),

      // Ministère et départements ministériels
      prisma.ministere.deleteMany(),

      // Géographie
      prisma.arrondissement.deleteMany(),
      prisma.commune.deleteMany(),
      prisma.district.deleteMany(),
      prisma.departement.deleteMany(),
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
resetDatabase().catch((e) => {
  console.error(e);
  process.exit(1);
});
