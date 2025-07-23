import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedReferenceData() {
  console.log('🌱 Insertion des données de référence...');

  try {
    // 1. Créer les régions
    console.log('  📍 Création des régions...');
    const regions = await prisma.$transaction([
      prisma.region.create({
        data: {
          name: 'Brazzaville',
          code: 'BZ',
          isActive: true,
        },
      }),
      prisma.region.create({
        data: {
          name: 'Bouenza',
          code: 'BNZ',
          isActive: true,
        },
      }),
      prisma.region.create({
        data: {
          name: 'Cuvette',
          code: 'CV',
          isActive: true,
        },
      }),
      prisma.region.create({
        data: {
          name: 'Cuvette-Ouest',
          code: 'CVO',
          isActive: true,
        },
      }),
      prisma.region.create({
        data: {
          name: 'Kouilou',
          code: 'KL',
          isActive: true,
        },
      }),
      prisma.region.create({
        data: {
          name: 'Lekoumou',
          code: 'LKM',
          isActive: true,
        },
      }),
      prisma.region.create({
        data: {
          name: 'Likouala',
          code: 'LKL',
          isActive: true,
        },
      }),
      prisma.region.create({
        data: {
          name: 'Niari',
          code: 'NR',
          isActive: true,
        },
      }),
      prisma.region.create({
        data: {
          name: 'Plateaux',
          code: 'PLT',
          isActive: true,
        },
      }),
      prisma.region.create({
        data: {
          name: 'Pointe-Noire',
          code: 'PN',
          isActive: true,
        },
      }),
      prisma.region.create({
        data: {
          name: 'Pool',
          code: 'PL',
          isActive: true,
        },
      }),
      prisma.region.create({
        data: {
          name: 'Sangha',
          code: 'SNG',
          isActive: true,
        },
      }),
    ]);

    // 2. Créer les départements géographiques
    console.log('  📍 Création des départements...');
    const departments = [];

    for (const region of regions) {
      // Créer 2-3 départements par région
      const deptCount = region.code === 'RC' ? 3 : 2;

      for (let i = 1; i <= deptCount; i++) {
        const dept = await prisma.geographicDepartment.create({
          data: {
            name: `Département ${region.code}-${i}`,
            code: `${region.code}${i}`,
            regionId: region.id,
            isActive: true,
          },
        });
        departments.push(dept);
      }
    }

    // 3. Créer les communes
    console.log('  📍 Création des communes...');
    for (const dept of departments) {
      // Créer 3-5 communes par département
      const communeCount = Math.floor(Math.random() * 3) + 3;

      for (let i = 1; i <= communeCount; i++) {
        await prisma.commune.create({
          data: {
            name: `Commune ${dept.code}-${i}`,
            postalCode: `${dept.code}${i}00`,
            departmentId: dept.id,
            isActive: true,
          },
        });
      }
    }

    // 4. Créer les objets métier
    console.log('  🔧 Création des objets métier...');
    const businessObjects = [
      // Objets communs
      {
        name: 'user.profile',
        scope: 'COMMON',
        module: 'users',
        description: 'Profil utilisateur',
      },
      {
        name: 'user.management',
        scope: 'COMMON',
        module: 'users',
        description: 'Gestion des utilisateurs',
      },
      {
        name: 'security.groups',
        scope: 'COMMON',
        module: 'security',
        description: 'Groupes de sécurité',
      },
      {
        name: 'security.permissions',
        scope: 'COMMON',
        module: 'security',
        description: 'Permissions',
      },

      // Objets ministère
      {
        name: 'establishment.management',
        scope: 'MINISTRY',
        module: 'establishments',
        description: 'Gestion des établissements',
      },
      {
        name: 'establishment.request',
        scope: 'MINISTRY',
        module: 'establishments',
        description: 'Demandes établissements',
      },
      {
        name: 'statistics.national',
        scope: 'MINISTRY',
        module: 'statistics',
        description: 'Statistiques nationales',
      },
      {
        name: 'reports.ministry',
        scope: 'MINISTRY',
        module: 'reports',
        description: 'Rapports ministériels',
      },

      // Objets école
      {
        name: 'student.management',
        scope: 'SCHOOL',
        module: 'students',
        description: 'Gestion des élèves',
      },
      {
        name: 'teacher.management',
        scope: 'SCHOOL',
        module: 'teachers',
        description: 'Gestion des enseignants',
      },
      {
        name: 'grade.management',
        scope: 'SCHOOL',
        module: 'grades',
        description: 'Gestion des notes',
      },
      {
        name: 'attendance.management',
        scope: 'SCHOOL',
        module: 'attendance',
        description: 'Gestion des présences',
      },
    ];

    for (const obj of businessObjects) {
      await prisma.businessObject.create({
        data: {
          name: obj.name,
          scope: obj.scope as any,
          module: obj.module,
          description: obj.description,
          isActive: true,
        },
      });
    }

    // Afficher le résumé
    const summary = await prisma.$transaction([
      prisma.region.count(),
      prisma.geographicDepartment.count(),
      prisma.commune.count(),
      prisma.businessObject.count(),
    ]);

    console.log('\n📊 Résumé des données insérées:');
    console.log(`  - Régions: ${summary[0]}`);
    console.log(`  - Départements: ${summary[1]}`);
    console.log(`  - Communes: ${summary[2]}`);
    console.log(`  - Objets métier: ${summary[3]}`);

    console.log('\n✅ Données de référence insérées avec succès');
  } catch (error) {
    console.error(
      "❌ Erreur lors de l'insertion des données de référence:",
      error,
    );
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Exécution
seedReferenceData().catch((e) => {
  console.error(e);
  process.exit(1);
});
