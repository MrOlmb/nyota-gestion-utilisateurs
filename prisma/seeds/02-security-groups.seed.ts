import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Main function to seed MINISTRY-LEVEL and TEMPLATE school security groups, permissions, and rules.
 * This script is idempotent and can be run multiple times safely.
 */
async function main() {
  console.log(
    '🔐 Démarrage du seeding de la sécurité (Groupes & Permissions)...',
  );

  try {
    const businessObjects = await prisma.businessObject.findMany();
    const objectMap = new Map(businessObjects.map((obj) => [obj.nom, obj.id]));

    const ministryGroups = await seedMinistrySecurityGroups();
    await seedMinistryPermissions(ministryGroups, objectMap);

    const schoolTemplateGroups = await seedSchoolTemplateGroups();
    await seedSchoolTemplatePermissions(schoolTemplateGroups, objectMap);

    // Note: Rules seeding is complex and context-dependent.
    // I've provided a robust structure you can populate.
    await seedMinistryRules(ministryGroups, objectMap);

    await logSummary();

    console.log('\n✅ Données de sécurité insérées/mises à jour avec succès.');
  } catch (error) {
    console.error(
      '❌ Erreur critique durant le seeding de la sécurité:',
      error,
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Seeds Ministry security groups.
 */
async function seedMinistrySecurityGroups() {
  console.log('  👥 Seeding des groupes de sécurité ministère...');
  const groupsData = [
    {
      nom: 'Super Administrateurs',
      description: 'Accès complet au système ministère',
    },
    {
      nom: 'Cabinet Ministériel',
      description: 'Ministre, directeur de cabinet et conseillers',
    },
    {
      nom: 'Secrétariat Général',
      description: 'Secrétaire général et adjoints',
    },
    {
      nom: 'Directeurs Généraux',
      description: 'Directeurs généraux des administrations',
    },
    {
      nom: 'Directeurs Centraux',
      description: 'Directeurs des directions centrales',
    },
    { nom: 'Chefs de Service', description: 'Chefs de services centraux' },
    {
      nom: 'Délégués Régionaux',
      description: "Délégués régionaux de l'éducation",
    },
    { nom: 'Inspecteurs', description: "Inspecteurs de l'éducation" },
    {
      nom: 'Analystes et Statisticiens',
      description: "Personnel d'analyse et statistiques",
    },
  ];

  await prisma.$transaction(
    groupsData.map((group) =>
      prisma.securityGroupMinistry.upsert({
        where: { nom: group.nom },
        update: { description: group.description },
        create: { ...group, estSysteme: true, estActif: true },
      }),
    ),
  );
  return prisma.securityGroupMinistry.findMany();
}

/**
 * Seeds TEMPLATE school security groups (where etablissementId is null).
 */
/**
 * Seeds TEMPLATE school security groups (where etablissementId is null).
 * Solution corrigée pour gérer les contraintes composites avec null.
 */
async function seedSchoolTemplateGroups() {
  console.log('  🏫 Seeding des groupes modèles pour les écoles...');
  const groupsData = [
    {
      nom: 'Direction École',
      description: 'Directeurs, proviseurs et leurs adjoints',
    },
    { nom: 'Enseignants', description: 'Corps enseignant' },
    { nom: 'Élèves', description: 'Élèves et étudiants' },
    { nom: 'Parents', description: "Parents d'élèves" },
    {
      nom: 'Personnel Administratif',
      description: 'Secrétaires et personnel de bureau',
    },
  ];

  // Solution 1: Utiliser findFirst + create/update séparément
  for (const group of groupsData) {
    const existingGroup = await prisma.securityGroupSchool.findFirst({
      where: { 
        nom: group.nom, 
        etablissementId: null 
      },
    });

    if (existingGroup) {
      // Mise à jour si le groupe existe
      await prisma.securityGroupSchool.update({
        where: { id: existingGroup.id },
        data: { description: group.description },
      });
    } else {
      // Création si le groupe n'existe pas
      await prisma.securityGroupSchool.create({
        data: {
          ...group,
          etablissementId: null,
          estSysteme: true,
          estActif: true,
        },
      });
    }
  }

  return prisma.securityGroupSchool.findMany({
    where: { etablissementId: null },
  });
}

// Alternative : Solution 2 avec une contrainte unique différente
async function seedSchoolTemplateGroupsAlternative() {
  console.log('  🏫 Seeding des groupes modèles pour les écoles...');
  const groupsData = [
    {
      nom: 'Direction École',
      description: 'Directeurs, proviseurs et leurs adjoints',
    },
    { nom: 'Enseignants', description: 'Corps enseignant' },
    { nom: 'Élèves', description: 'Élèves et étudiants' },
    { nom: 'Parents', description: "Parents d'élèves" },
    {
      nom: 'Personnel Administratif',
      description: 'Secrétaires et personnel de bureau',
    },
  ];

  // Si vous pouvez modifier votre schéma Prisma pour avoir un champ unique
  // pour les groupes template, utilisez quelque chose comme :
  // @@unique([nom]) where etablissementId is null
  
  await prisma.$transaction(
    groupsData.map((group) =>
      prisma.securityGroupSchool.upsert({
        // Utiliser seulement le nom si vous avez une contrainte unique sur nom
        // quand etablissementId est null
        where: { 
          nom_etablissementId: {
            nom: group.nom,
            etablissementId: null
          }
        },
        update: { description: group.description },
        create: {
          ...group,
          etablissementId: null,
          estSysteme: true,
          estActif: true,
        },
      }),
    ),
  );
  
  return prisma.securityGroupSchool.findMany({
    where: { etablissementId: null },
  });
}

/**
 * Seeds permissions for ministry security groups.
 */
async function seedMinistryPermissions(
  ministryGroups: any[],
  objectMap: Map<string, string>,
) {
  console.log('  🔑 Seeding des permissions ministère...');
  const groupMap = new Map(ministryGroups.map((g) => [g.nom, g.id]));
  const permissions: any[] = [];

  // Super Admin: Full access to non-school objects
  const superAdminId = groupMap.get('Super Administrateurs');
  if (superAdminId) {
    for (const [objName, objId] of objectMap.entries()) {
      if (
        !objName.startsWith('school.') &&
        !objName.startsWith('student.') &&
        !objName.startsWith('teacher.') &&
        !objName.startsWith('parent.')
      ) {
        permissions.push({
          groupId: superAdminId,
          objectId: objId,
          peutLire: true,
          peutEcrire: true,
          peutCreer: true,
          peutSupprimer: true,
          peutApprouver: true,
        });
      }
    }
  }

  // Add other ministry permissions here...
  // Example: Cabinet has read-only on stats
  const cabinetId = groupMap.get('Cabinet Ministériel');
  const statsId = objectMap.get('statistics.national');
  if (cabinetId && statsId) {
    permissions.push({
      groupId: cabinetId,
      objectId: statsId,
      peutLire: true,
      peutEcrire: false,
      peutCreer: false,
      peutSupprimer: false,
      peutApprouver: false,
    });
  }

  await prisma.$transaction(
    permissions.map((p) =>
      prisma.groupPermissionMinistry.upsert({
        where: {
          groupId_objectId: { groupId: p.groupId, objectId: p.objectId },
        },
        update: p,
        create: p,
      }),
    ),
  );
}

/**
 * Seeds permissions for TEMPLATE school security groups.
 */
async function seedSchoolTemplatePermissions(
  schoolGroups: any[],
  objectMap: Map<string, string>,
) {
  console.log('  🔑 Seeding des permissions pour les groupes modèles école...');
  const groupMap = new Map(schoolGroups.map((g) => [g.nom, g.id]));
  const permissions: any[] = [];

  // Teacher permissions
  const teacherGroupId = groupMap.get('Enseignants');
  if (teacherGroupId) {
    const teacherObjects = [
      'student.grades',
      'student.attendance',
      'parent.communication',
    ];
    teacherObjects.forEach((objName) => {
      const objId = objectMap.get(objName);
      if (objId) {
        permissions.push({
          groupId: teacherGroupId,
          objectId: objId,
          peutLire: true,
          peutEcrire: true,
          peutCreer: true,
          peutSupprimer: false,
        });
      }
    });
  }

  // Student permissions
  const studentGroupId = groupMap.get('Élèves');
  if (studentGroupId) {
    const studentObjects = [
      'student.grades',
      'student.attendance',
      'teacher.schedule',
    ];
    studentObjects.forEach((objName) => {
      const objId = objectMap.get(objName);
      if (objId) {
        permissions.push({
          groupId: studentGroupId,
          objectId: objId,
          peutLire: true,
          peutEcrire: false,
          peutCreer: false,
          peutSupprimer: false,
        });
      }
    });
  }

  await prisma.$transaction(
    permissions.map((p) =>
      prisma.groupPermissionSchool.upsert({
        where: {
          groupId_objectId: { groupId: p.groupId, objectId: p.objectId },
        },
        update: p,
        create: p,
      }),
    ),
  );
}

/**
 * Seeds visibility and UI rules. This is a placeholder for your specific logic.
 */
async function seedMinistryRules(
  ministryGroups: any[],
  objectMap: Map<string, string>,
) {
  console.log('  👁️  🎨 Seeding des règles de visibilité et UI (structure)...');
  const groupMap = new Map(ministryGroups.map((g) => [g.nom, g.id]));

  const regionalDelegatesId = groupMap.get('Délégués Régionaux');
  const establishmentMgmtId = objectMap.get('establishment.management');

  if (regionalDelegatesId && establishmentMgmtId) {
    await prisma.visibilityRuleMinistry.upsert({
      where: { id: 'rule_regional_visibility_01' }, // Use a predictable ID or unique name if you add one
      update: {},
      create: {
        id: 'rule_regional_visibility_01',
        nom: 'Visibilité Régionale pour Délégués',
        groupId: regionalDelegatesId,
        objectId: establishmentMgmtId,
        typeRegle: 'GEOGRAPHY',
        condition: {
          field: 'departementId',
          operator: 'equals',
          value: '$userDepartementGeoId',
        },
        priorite: 10,
      },
    });
  }
}

/**
 * Logs a summary of the security data in the database.
 */
async function logSummary() {
  const counts = await prisma.$transaction([
    prisma.securityGroupMinistry.count(),
    prisma.securityGroupSchool.count({ where: { etablissementId: null } }),
    prisma.groupPermissionMinistry.count(),
    prisma.groupPermissionSchool.count(),
    prisma.visibilityRuleMinistry.count(),
  ]);

  console.log('\n📊 Résumé des données de sécurité:');
  console.log(`  - Groupes ministère: ${counts[0]}`);
  console.log(`  - Groupes modèles école: ${counts[1]}`);
  console.log(`  - Permissions ministère: ${counts[2]}`);
  console.log(`  - Permissions école (modèles): ${counts[3]}`);
  console.log(`  - Règles de visibilité ministère: ${counts[4]}`);
}

// Execute the main seeding function
main().catch((e) => {
  console.error('Le script de seeding de la sécurité a échoué:', e);
  process.exit(1);
});
