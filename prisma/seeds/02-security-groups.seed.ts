import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedSecurityGroups() {
  console.log('🔐 Création des groupes de sécurité...');

  try {
    // 1. Créer les groupes de sécurité système (Ministère)
    console.log('  👥 Création des groupes ministère...');

    const superAdminGroup = await prisma.securityGroup.create({
      data: {
        name: 'Super Administrateurs',
        description: 'Accès complet au système',
        isSystem: true,
        isActive: true,
      },
    });

    const ministryAdminGroup = await prisma.securityGroup.create({
      data: {
        name: 'Administrateurs Ministère',
        description: 'Administration du système au niveau ministère',
        isSystem: true,
        isActive: true,
      },
    });

    const inspectorGroup = await prisma.securityGroup.create({
      data: {
        name: 'Inspecteurs',
        description: "Inspecteurs généraux de l'éducation",
        isSystem: true,
        isActive: true,
      },
    });

    const regionalManagerGroup = await prisma.securityGroup.create({
      data: {
        name: 'Directeurs Régionaux',
        description: "Directeurs régionaux de l'éducation",
        isSystem: true,
        isActive: true,
      },
    });

    const analystGroup = await prisma.securityGroup.create({
      data: {
        name: 'Analystes',
        description: 'Analystes et statisticiens du ministère',
        isSystem: true,
        isActive: true,
      },
    });

    // 2. Créer les groupes pour les établissements (templates)
    console.log('  🏫 Création des groupes établissements...');

    const schoolAdminGroup = await prisma.securityGroup.create({
      data: {
        name: 'Administrateurs École',
        description: 'Administration au niveau établissement',
        isSystem: true,
        isActive: true,
      },
    });

    const principalGroup = await prisma.securityGroup.create({
      data: {
        name: "Directeurs d'École",
        description: 'Directeurs et proviseurs',
        isSystem: true,
        isActive: true,
      },
    });

    const teacherGroup = await prisma.securityGroup.create({
      data: {
        name: 'Enseignants',
        description: 'Corps enseignant',
        isSystem: true,
        isActive: true,
      },
    });

    const studentGroup = await prisma.securityGroup.create({
      data: {
        name: 'Élèves',
        description: 'Élèves et étudiants',
        isSystem: true,
        isActive: true,
      },
    });

    const parentGroup = await prisma.securityGroup.create({
      data: {
        name: 'Parents',
        description: "Parents d'élèves",
        isSystem: true,
        isActive: true,
      },
    });

    // 3. Attribuer les permissions aux groupes
    console.log('  🔑 Attribution des permissions...');

    // Récupérer tous les objets métier
    const businessObjects = await prisma.businessObject.findMany();
    const objectMap = Object.fromEntries(
      businessObjects.map((obj) => [obj.name, obj.id]),
    );

    // Permissions Super Admin - Accès total
    for (const obj of businessObjects) {
      await prisma.groupPermission.create({
        data: {
          groupId: superAdminGroup.id,
          objectId: obj.id,
          canRead: true,
          canWrite: true,
          canCreate: true,
          canDelete: true,
          canApprove: true,
        },
      });
    }

    // Permissions Administrateurs Ministère
    const ministryAdminPermissions = [
      {
        object: 'user.management',
        permissions: {
          read: true,
          write: true,
          create: true,
          delete: false,
          approve: false,
        },
      },
      {
        object: 'establishment.management',
        permissions: {
          read: true,
          write: true,
          create: true,
          delete: false,
          approve: true,
        },
      },
      {
        object: 'establishment.request',
        permissions: {
          read: true,
          write: true,
          create: false,
          delete: false,
          approve: true,
        },
      },
      {
        object: 'statistics.national',
        permissions: {
          read: true,
          write: false,
          create: false,
          delete: false,
          approve: false,
        },
      },
      {
        object: 'reports.ministry',
        permissions: {
          read: true,
          write: true,
          create: true,
          delete: false,
          approve: false,
        },
      },
    ];

    for (const perm of ministryAdminPermissions) {
      if (objectMap[perm.object]) {
        await prisma.groupPermission.create({
          data: {
            groupId: ministryAdminGroup.id,
            objectId: objectMap[perm.object],
            canRead: perm.permissions.read,
            canWrite: perm.permissions.write,
            canCreate: perm.permissions.create,
            canDelete: perm.permissions.delete,
            canApprove: perm.permissions.approve,
          },
        });
      }
    }

    // Permissions Inspecteurs
    const inspectorPermissions = [
      {
        object: 'establishment.management',
        permissions: {
          read: true,
          write: false,
          create: false,
          delete: false,
          approve: false,
        },
      },
      {
        object: 'statistics.national',
        permissions: {
          read: true,
          write: false,
          create: false,
          delete: false,
          approve: false,
        },
      },
      {
        object: 'reports.ministry',
        permissions: {
          read: true,
          write: true,
          create: true,
          delete: false,
          approve: false,
        },
      },
    ];

    for (const perm of inspectorPermissions) {
      if (objectMap[perm.object]) {
        await prisma.groupPermission.create({
          data: {
            groupId: inspectorGroup.id,
            objectId: objectMap[perm.object],
            canRead: perm.permissions.read,
            canWrite: perm.permissions.write,
            canCreate: perm.permissions.create,
            canDelete: perm.permissions.delete,
            canApprove: perm.permissions.approve,
          },
        });
      }
    }

    // 4. Créer les règles de visibilité
    console.log('  👁️ Création des règles de visibilité...');

    // Règle hiérarchique pour les directeurs régionaux
    await prisma.visibilityRule.create({
      data: {
        name: 'Visibilité Régionale',
        groupId: regionalManagerGroup.id,
        objectId: objectMap['establishment.management'],
        ruleType: 'GEOGRAPHY',
        condition: {
          type: 'filter',
          field: 'regionId',
          operator: 'equals',
          value: '$userRegionId',
        },
        priority: 10,
        isActive: true,
      },
    });

    // Règle de tenant pour les écoles
    await prisma.visibilityRule.create({
      data: {
        name: 'Isolation École',
        groupId: schoolAdminGroup.id,
        objectId: objectMap['student.management'],
        ruleType: 'TENANT',
        condition: {
          type: 'filter',
          field: 'establishmentId',
          operator: 'equals',
          value: '$userEstablishmentId',
        },
        priority: 20,
        isActive: true,
      },
    });

    // 5. Créer les règles UI
    console.log('  🎨 Création des règles UI...');

    // Masquer les champs sensibles pour certains groupes
    await prisma.uIRule.create({
      data: {
        groupId: teacherGroup.id,
        elementName: 'field.salary',
        elementType: 'FIELD',
        isVisible: false,
        isEnabled: false,
      },
    });

    await prisma.uIRule.create({
      data: {
        groupId: studentGroup.id,
        elementName: 'button.delete',
        elementType: 'BUTTON',
        isVisible: false,
        isEnabled: false,
      },
    });

    // Afficher le résumé
    const summary = await prisma.$transaction([
      prisma.securityGroup.count(),
      prisma.groupPermission.count(),
      prisma.visibilityRule.count(),
      prisma.uIRule.count(),
    ]);

    console.log('\n📊 Résumé des groupes de sécurité:');
    console.log(`  - Groupes créés: ${summary[0]}`);
    console.log(`  - Permissions attribuées: ${summary[1]}`);
    console.log(`  - Règles de visibilité: ${summary[2]}`);
    console.log(`  - Règles UI: ${summary[3]}`);

    console.log('\n✅ Groupes de sécurité créés avec succès');
  } catch (error) {
    console.error(
      '❌ Erreur lors de la création des groupes de sécurité:',
      error,
    );
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution
seedSecurityGroups().catch((e) => {
  console.error(e);
  process.exit(1);
});
