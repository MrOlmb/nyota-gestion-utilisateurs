import { PrismaClient } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function seedAdminUser() {
  console.log("👤 Création de l'utilisateur administrateur...");

  try {
    // 1. Récupérer le groupe Super Admin
    const superAdminGroup = await prisma.securityGroup.findFirst({
      where: {
        name: 'Super Administrateurs',
        isSystem: true,
      },
    });

    if (!superAdminGroup) {
      throw new Error(
        "Groupe Super Administrateurs non trouvé. Exécutez d'abord seed:security",
      );
    }

    // 2. Récupérer une région et un établissement de test
    const region = await prisma.region.findFirst({
      where: { code: 'RC' }, // Région Centrale
    });

    const department = await prisma.geographicDepartment.findFirst({
      where: { regionId: region.id },
    });

    const commune = await prisma.commune.findFirst({
      where: { departmentId: department.id },
    });

    // 3. Créer un établissement ministère (fictif)
    const ministryEstablishment = await prisma.establishment.create({
      data: {
        name: "Ministère de l'Éducation Nationale",
        code: 'MIN-EDU-001',
        establishmentType: 'HIGHER',
        sector: 'PUBLIC',
        administrativeStatus: 'AUTHORIZED',
        fullAddress: "1 Avenue de l'Éducation, Capitale",
        latitude: -1.9441,
        longitude: 30.0619,
        regionId: region.id,
        departmentId: department.id,
        communeId: commune.id,
        phoneNumber: '+250 788 000 001',
        officialEmail: 'contact@minedu.gov.rw',
        website: 'https://www.mineduc.gov.rw',
        totalStudents: 0,
        totalStaff: 500,
        openingDate: new Date('1962-07-01'),
        isActive: true,
        createdById: null, // Sera mis à jour après
        modifiedById: null, // Sera mis à jour après
      },
    });

    // 4. Hasher le mot de passe
    const passwordHash = await bcryptjs.hash('AdminNyota2024!', 12);

    // 5. Créer l'utilisateur super admin
    const adminUser = await prisma.user.create({
      data: {
        email: 'admin@nyota.gov',
        passwordHash: passwordHash,
        firstName: 'Super',
        lastName: 'Administrateur',
        userType: 'MINISTRY_STAFF',
        establishmentId: ministryEstablishment.id,
        isActive: true,
        failedLoginAttempts: 0,
      },
    });

    // 6. Mettre à jour l'établissement avec le créateur
    await prisma.establishment.update({
      where: { id: ministryEstablishment.id },
      data: {
        createdById: adminUser.id,
        modifiedById: adminUser.id,
      },
    });

    // 7. Assigner l'utilisateur au groupe Super Admin
    await prisma.userSecurityGroup.create({
      data: {
        userId: adminUser.id,
        groupId: superAdminGroup.id,
        isActive: true,
      },
    });

    // 8. Créer des utilisateurs de test pour chaque rôle
    console.log('  👥 Création des utilisateurs de test...');

    const testUsers = [
      {
        email: 'directeur.regional@nyota.gov',
        firstName: 'Jean',
        lastName: 'Directeur',
        userType: 'MINISTRY_STAFF',
        groupName: 'Directeurs Régionaux',
        password: 'DirecteurNyota2024!',
      },
      {
        email: 'inspecteur@nyota.gov',
        firstName: 'Marie',
        lastName: 'Inspecteur',
        userType: 'MINISTRY_STAFF',
        groupName: 'Inspecteurs',
        password: 'InspecteurNyota2024!',
      },
      {
        email: 'analyste@nyota.gov',
        firstName: 'Pierre',
        lastName: 'Analyste',
        userType: 'MINISTRY_STAFF',
        groupName: 'Analystes',
        password: 'AnalysteNyota2024!',
      },
    ];

    for (const userData of testUsers) {
      // Hasher le mot de passe
      const hash = await bcryptjs.hash(userData.password, 12);

      // Créer l'utilisateur
      const user = await prisma.user.create({
        data: {
          email: userData.email,
          passwordHash: hash,
          firstName: userData.firstName,
          lastName: userData.lastName,
          userType: userData.userType as any,
          establishmentId: ministryEstablishment.id,
          managerId: adminUser.id, // Tous sous la supervision de l'admin
          isActive: true,
        },
      });

      // Trouver le groupe
      const group = await prisma.securityGroup.findFirst({
        where: { name: userData.groupName },
      });

      if (group) {
        // Assigner au groupe
        await prisma.userSecurityGroup.create({
          data: {
            userId: user.id,
            groupId: group.id,
            isActive: true,
          },
        });
      }
    }

    // 9. Créer un établissement scolaire de test
    const testSchool = await prisma.establishment.create({
      data: {
        name: 'Lycée National de Test',
        code: 'LYC-TEST-001',
        establishmentType: 'SECONDARY',
        sector: 'PUBLIC',
        administrativeStatus: 'AUTHORIZED',
        fullAddress: "123 Rue de l'École, Capitale",
        regionId: region.id,
        departmentId: department.id,
        communeId: commune.id,
        phoneNumber: '+250 788 000 002',
        officialEmail: 'lycee.test@education.gov',
        totalStudents: 500,
        totalStaff: 50,
        isActive: true,
        createdById: adminUser.id,
        modifiedById: adminUser.id,
      },
    });

    // 10. Créer un directeur d'école
    const schoolDirectorHash = await bcryptjs.hash('DirecteurEcole2024!', 12);
    const schoolDirector = await prisma.user.create({
      data: {
        email: 'directeur.ecole@nyota.gov',
        passwordHash: schoolDirectorHash,
        firstName: 'Paul',
        lastName: 'Directeur École',
        userType: 'SCHOOL_ADMIN',
        establishmentId: testSchool.id,
        isActive: true,
      },
    });

    // Assigner au groupe Directeurs d'École
    const principalGroup = await prisma.securityGroup.findFirst({
      where: { name: "Directeurs d'École" },
    });

    if (principalGroup) {
      await prisma.userSecurityGroup.create({
        data: {
          userId: schoolDirector.id,
          groupId: principalGroup.id,
          isActive: true,
        },
      });
    }

    // Afficher le résumé
    const userCount = await prisma.user.count();
    const establishmentCount = await prisma.establishment.count();

    console.log('\n📊 Résumé des utilisateurs créés:');
    console.log(`  - Total utilisateurs: ${userCount}`);
    console.log(`  - Total établissements: ${establishmentCount}`);
    console.log('\n📧 Comptes créés:');
    console.log('  ====================================');
    console.log('  Super Admin:');
    console.log('    Email: admin@nyota.gov');
    console.log('    Mot de passe: AdminNyota2024!');
    console.log('  ------------------------------------');
    console.log('  Directeur Régional:');
    console.log('    Email: directeur.regional@nyota.gov');
    console.log('    Mot de passe: DirecteurNyota2024!');
    console.log('  ------------------------------------');
    console.log('  Inspecteur:');
    console.log('    Email: inspecteur@nyota.gov');
    console.log('    Mot de passe: InspecteurNyota2024!');
    console.log('  ------------------------------------');
    console.log('  Analyste:');
    console.log('    Email: analyste@nyota.gov');
    console.log('    Mot de passe: AnalysteNyota2024!');
    console.log('  ------------------------------------');
    console.log('  Directeur École:');
    console.log('    Email: directeur.ecole@nyota.gov');
    console.log('    Mot de passe: DirecteurEcole2024!');
    console.log('  ====================================');

    console.log('\n✅ Utilisateur administrateur créé avec succès');
  } catch (error) {
    console.error(
      "❌ Erreur lors de la création de l'utilisateur administrateur:",
      error,
    );
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution
seedAdminUser().catch((e) => {
  console.error(e);
  process.exit(1);
});
