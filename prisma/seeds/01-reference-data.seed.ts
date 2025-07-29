import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Main function to seed the database with reference data.
 * This script is idempotent and can be run multiple times safely.
 */
async function main() {
  console.log('🌱 Démarrage du seeding des données de référence...');

  try {
    // The order of execution is important due to foreign key constraints.
    await seedGeographicalData();
    await seedBusinessObjects();
    await seedAuthorizationTypes();
    await seedInfrastructureTypes();
    await seedInspectionTypes();

    await logSummary();

    console.log('\n✅ Données de référence insérées/mises à jour avec succès.');
  } catch (error) {
    console.error(
      '❌ Erreur critique durant le seeding des données de référence:',
      error,
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Seeds all geographical data: Départements, Districts, Communes, Arrondissements.
 */
async function seedGeographicalData() {
  console.log(
    '  📍 Seeding des données géographiques (Départements, Districts...)...',
  );

  // --- 1. Départements ---
  const departementsData = [
    { nom: 'Kouilou', code: 'KL' },
    { nom: 'Niari', code: 'NI' },
    { nom: 'Lékoumou', code: 'LE' },
    { nom: 'Bouenza', code: 'BZ' },
    { nom: 'Pool', code: 'PL' },
    { nom: 'Plateaux', code: 'PX' },
    { nom: 'Cuvette', code: 'CU' },
    { nom: 'Cuvette-Ouest', code: 'CO' },
    { nom: 'Sangha', code: 'SA' },
    { nom: 'Likouala', code: 'LI' },
    { nom: 'Brazzaville', code: 'BR' },
    { nom: 'Pointe-Noire', code: 'PN' },
    { nom: 'Congo-Oubangui', code: 'OU' },
    { nom: 'Nkéni-Alima', code: 'NA' },
    { nom: 'Djoué-Léfini', code: 'DL' },
  ];

  await prisma.$transaction(
    departementsData.map((data) =>
      prisma.departement.upsert({
        where: { code: data.code },
        update: {}, // No changes if it exists
        create: data,
      }),
    ),
  );
  const departements = await prisma.departement.findMany();

  // --- 2. Districts ---
  const districtsData = [
    // Brazzaville (Arrondissements - special case)
    { nom: 'Makélékélé', code: 'BR-MK', departementCode: 'BR' },
    { nom: 'Bacongo', code: 'BR-BC', departementCode: 'BR' },
    { nom: 'Poto-Poto', code: 'BR-PP', departementCode: 'BR' },
    { nom: 'Moungali', code: 'BR-MG', departementCode: 'BR' },
    { nom: 'Ouenzé', code: 'BR-OZ', departementCode: 'BR' },
    { nom: 'Talangaï', code: 'BR-TL', departementCode: 'BR' },
    { nom: 'Mfilou', code: 'BR-MF', departementCode: 'BR' },
    { nom: 'Madibou', code: 'BR-MD', departementCode: 'BR' },
    { nom: 'Djiri', code: 'BR-DJ', departementCode: 'BR' },
    
    // Pointe-Noire (Arrondissements - special case)
    { nom: 'Lumumba', code: 'PN-LM', departementCode: 'PN' },
    { nom: 'Mvou-Mvou', code: 'PN-MV', departementCode: 'PN' },
    { nom: 'Tié-Tié', code: 'PN-TT', departementCode: 'PN' },
    { nom: 'Loandjili', code: 'PN-LJ', departementCode: 'PN' },
    { nom: 'Mongo-Mpoukou', code: 'PN-MP', departementCode: 'PN' },
    { nom: 'Ngoyo', code: 'PN-NG', departementCode: 'PN' },

    // Bouenza
    { nom: 'Madingou', code: 'BZ-MAD', departementCode: 'BZ' },
    { nom: 'Mouyondzi', code: 'BZ-MOU', departementCode: 'BZ' },
    { nom: 'Boko-Songho', code: 'BZ-BOK', departementCode: 'BZ' },
    { nom: 'Mfouati', code: 'BZ-MFO', departementCode: 'BZ' },
    { nom: 'Loudima', code: 'BZ-LOU', departementCode: 'BZ' },
    { nom: 'Kayes', code: 'BZ-KAY', departementCode: 'BZ' },
    { nom: 'Kingoué', code: 'BZ-KIN', departementCode: 'BZ' },
    { nom: 'Mabombo', code: 'BZ-MAB', departementCode: 'BZ' },
    { nom: 'Tsiaki', code: 'BZ-TSI', departementCode: 'BZ' },
    { nom: 'Yamba', code: 'BZ-YAM', departementCode: 'BZ' },

    // Congo-Oubangui
    { nom: 'Betou', code: 'OU-BET', departementCode: 'OU' },
    { nom: 'Okoyo', code: 'OU-OKO', departementCode: 'OU' },
    { nom: 'Loukolela', code: 'OU-LOU', departementCode: 'OU' },

    // Cuvette
    { nom: 'Owando', code: 'CU-OWA', departementCode: 'CU' },
    { nom: 'Makoua', code: 'CU-MAK', departementCode: 'CU' },
    { nom: 'Boundji', code: 'CU-BOU', departementCode: 'CU' },
    { nom: 'Mossaka', code: 'CU-MOS', departementCode: 'CU' },
    { nom: 'Loukoléla', code: 'CU-LOU', departementCode: 'CU' },
    { nom: 'Oyo', code: 'CU-OYO', departementCode: 'CU' },
    { nom: 'Ngoko', code: 'CU-NGO', departementCode: 'CU' },
    { nom: 'Ntokou', code: 'CU-NTO', departementCode: 'CU' },
    { nom: 'Tchikapika', code: 'CU-TCH', departementCode: 'CU' },
    { nom: 'Bokoma', code: 'CU-BOK', departementCode: 'CU' },

    // Cuvette-Ouest
    { nom: 'Ewo', code: 'CO-EWO', departementCode: 'CO' },
    { nom: 'Kellé', code: 'CO-KEL', departementCode: 'CO' },
    { nom: 'Mbomo', code: 'CO-MBO', departementCode: 'CO' },
    { nom: 'Okoyo', code: 'CO-OKO', departementCode: 'CO' },
    { nom: 'Etoumbi', code: 'CO-ETO', departementCode: 'CO' },
    { nom: 'Mbama', code: 'CO-MBA', departementCode: 'CO' },

    // Djoué-Léfini
    { nom: 'Kindamba', code: 'DL-KIN', departementCode: 'DL' },
    { nom: 'Séké-Banza', code: 'DL-SEK', departementCode: 'DL' },
    { nom: 'Mindouli', code: 'DL-MIN', departementCode: 'DL' },

    // Kouilou
    { nom: 'Hinda', code: 'KL-HIN', departementCode: 'KL' },
    { nom: 'Madingo-Kayes', code: 'KL-MAD', departementCode: 'KL' },
    { nom: 'Mvouti', code: 'KL-MVO', departementCode: 'KL' },
    { nom: 'Kakamoéka', code: 'KL-KAK', departementCode: 'KL' },
    { nom: 'Nzambi', code: 'KL-NZA', departementCode: 'KL' },
    { nom: 'Loango', code: 'KL-LOA', departementCode: 'KL' },

    // Lékoumou
    { nom: 'Sibiti', code: 'LE-SIB', departementCode: 'LE' },
    { nom: 'Komono', code: 'LE-KOM', departementCode: 'LE' },
    { nom: 'Zanaga', code: 'LE-ZAN', departementCode: 'LE' },
    { nom: 'Bambama', code: 'LE-BAM', departementCode: 'LE' },
    { nom: 'Mayéyé', code: 'LE-MAY', departementCode: 'LE' },

    // Likouala
    { nom: 'Impfondo', code: 'LI-IMP', departementCode: 'LI' },
    { nom: 'Epéna', code: 'LI-EPE', departementCode: 'LI' },
    { nom: 'Dongou', code: 'LI-DON', departementCode: 'LI' },
    { nom: 'Bétou', code: 'LI-BET', departementCode: 'LI' },
    { nom: 'Bouanéla', code: 'LI-BOU', departementCode: 'LI' },
    { nom: 'Enyellé', code: 'LI-ENY', departementCode: 'LI' },
    { nom: 'Liranga', code: 'LI-LIR', departementCode: 'LI' },

    // Niari
    { nom: 'Louvakou', code: 'NI-LOU', departementCode: 'NI' },
    { nom: 'Kibangou', code: 'NI-KIB', departementCode: 'NI' },
    { nom: 'Divénié', code: 'NI-DIV', departementCode: 'NI' },
    { nom: 'Mayoko', code: 'NI-MAY', departementCode: 'NI' },
    { nom: 'Kimongo', code: 'NI-KIM', departementCode: 'NI' },
    { nom: 'Moutamba', code: 'NI-MOU', departementCode: 'NI' },
    { nom: 'Banda', code: 'NI-BAN', departementCode: 'NI' },
    { nom: 'Londéla-Kayes', code: 'NI-LON', departementCode: 'NI' },

    // Nkéni-Alima
    { nom: 'Ngoko', code: 'NA-NGO', departementCode: 'NA' },
    { nom: 'Lépouzy', code: 'NA-LEP', departementCode: 'NA' },
    { nom: 'Tchicapika', code: 'NA-TCH', departementCode: 'NA' },

    // Plateaux
    { nom: 'Djambala', code: 'PX-DJA', departementCode: 'PX' },
    { nom: 'Lékana', code: 'PX-LEK', departementCode: 'PX' },
    { nom: 'Gamboma', code: 'PX-GAM', departementCode: 'PX' },
    { nom: 'Abala', code: 'PX-ABA', departementCode: 'PX' },
    { nom: 'Allembé', code: 'PX-ALL', departementCode: 'PX' },
    { nom: 'Makotimpoko', code: 'PX-MAK', departementCode: 'PX' },
    { nom: 'Mbon', code: 'PX-MBO', departementCode: 'PX' },
    { nom: 'Mpouya', code: 'PX-MPO', departementCode: 'PX' },
    { nom: 'Ngo', code: 'PX-NGO', departementCode: 'PX' },
    { nom: 'Ollombo', code: 'PX-OLL', departementCode: 'PX' },
    { nom: 'Ongogni', code: 'PX-ONG', departementCode: 'PX' },

    // Pool
    { nom: 'Kinkala', code: 'PL-KIN', departementCode: 'PL' },
    { nom: 'Boko', code: 'PL-BOK', departementCode: 'PL' },
    { nom: 'Mindouli', code: 'PL-MIN', departementCode: 'PL' },
    { nom: 'Mayama', code: 'PL-MAY', departementCode: 'PL' },
    { nom: 'Vindza', code: 'PL-VIN', departementCode: 'PL' },

    // Sangha
    { nom: 'Mokéko', code: 'SA-MOK', departementCode: 'SA' },
    { nom: 'Sembé', code: 'SA-SEM', departementCode: 'SA' },
    { nom: 'Souanké', code: 'SA-SOU', departementCode: 'SA' },
    { nom: 'Pikounda', code: 'SA-PIK', departementCode: 'SA' },
    { nom: 'Ngbala', code: 'SA-NGB', departementCode: 'SA' },
    { nom: 'Kabo', code: 'SA-KAB', departementCode: 'SA' },
  ];

  await prisma.$transaction(
    districtsData.map((data) => {
      const departementId = departements.find(
        (d) => d.code === data.departementCode,
      )?.id;
      if (!departementId)
        throw new Error(
          `Département avec code ${data.departementCode} non trouvé pour le district ${data.nom}`,
        );
      return prisma.district.upsert({
        where: { code: data.code },
        update: {},
        create: { nom: data.nom, code: data.code, departementId },
      });
    }),
  );
  const districts = await prisma.district.findMany();

  // --- 3. Communes & Arrondissements (simplified for clarity) ---
  const communesData: Prisma.CommuneCreateInput[] = [];
  districts.forEach((district) => {
    communesData.push({
      nom: `Commune de ${district.nom}`,
      code: `${district.code}-C1`,
      district: { connect: { id: district.id } },
    });
  });

  await prisma.$transaction(
    communesData.map((data) =>
      prisma.commune.upsert({
        where: { code: data.code },
        update: {},
        create: data,
      }),
    ),
  );
  const communes = await prisma.commune.findMany();

  const arrondissementsData: Prisma.ArrondissementCreateInput[] = [];
  communes
    .filter((c) => c.code.includes('BR-') || c.code.includes('PN-'))
    .forEach((commune) => {
      arrondissementsData.push({
        nom: `1er Arrondissement - ${commune.nom}`,
        code: `${commune.code}-A1`,
        commune: { connect: { id: commune.id } },
      });
    });

  await prisma.$transaction(
    arrondissementsData.map((data) =>
      prisma.arrondissement.upsert({
        where: { code: data.code },
        update: {},
        create: data,
      }),
    ),
  );
}

/**
 * Seeds the BusinessObject model.
 */
async function seedBusinessObjects() {
  console.log('  🔧 Seeding des objets métier...');
  const businessObjectsData = [
    {
      nom: 'user.profile',
      scope: 'COMMON',
      module: 'users',
      description: 'Profil utilisateur',
    },
    {
      nom: 'user.management',
      scope: 'COMMON',
      module: 'users',
      description: 'Gestion des utilisateurs',
    },
    {
      nom: 'security.groups',
      scope: 'COMMON',
      module: 'security',
      description: 'Groupes de sécurité',
    },
    {
      nom: 'ministry.management',
      scope: 'MINISTRY',
      module: 'ministry',
      description: 'Gestion du ministère',
    },
    {
      nom: 'establishment.management',
      scope: 'MINISTRY',
      module: 'establishments',
      description: 'Gestion des établissements',
    },
    {
      nom: 'statistics.national',
      scope: 'MINISTRY',
      module: 'statistics',
      description: 'Statistiques nationales',
    },
    {
      nom: 'student.management',
      scope: 'SCHOOL',
      module: 'students',
      description: 'Gestion des élèves',
    },
    {
      nom: 'teacher.management',
      scope: 'SCHOOL',
      module: 'teachers',
      description: 'Gestion des enseignants',
    },
    {
      nom: 'parent.communication',
      scope: 'SCHOOL',
      module: 'parents',
      description: 'Communication parents',
    },
  ];

  await prisma.$transaction(
    businessObjectsData.map((data) =>
      prisma.businessObject.upsert({
        where: { nom: data.nom },
        update: {
          scope: data.scope as any,
          module: data.module,
          description: data.description,
        },
        create: { ...data, estActif: true } as any,
      }),
    ),
  );
}

/**
 * Seeds the TypeAutorisation model.
 */
async function seedAuthorizationTypes() {
  console.log("  📋 Seeding des types d'autorisation...");
  const typesAutorisationData = [
    {
      nom: 'Agrément de Création',
      code: 'AGR_CREATION',
      estObligatoire: true,
      dureeValiditeMois: 0,
    },
    {
      nom: "Autorisation d'Ouverture",
      code: 'AUT_OUVERTURE',
      estObligatoire: true,
      dureeValiditeMois: 60,
    },
    {
      nom: "Licence d'Exploitation",
      code: 'LIC_EXPLOIT',
      estObligatoire: false,
      dureeValiditeMois: 36,
    },
    {
      nom: 'Certification Qualité',
      code: 'CERT_QUALITE',
      estObligatoire: false,
      dureeValiditeMois: 24,
    },
  ];

  await prisma.$transaction(
    typesAutorisationData.map((data) =>
      prisma.typeAutorisation.upsert({
        where: { code: data.code },
        update: {},
        create: { ...data, estActif: true },
      }),
    ),
  );
}

/**
 * Seeds the TypeInfrastructure model.
 */
async function seedInfrastructureTypes() {
  console.log("  🏗️  Seeding des types d'infrastructure...");
  const typesInfrastructureData = [
    { nom: 'Salle de Classe', code: 'SALLE_CLASSE', estObligatoire: true },
    {
      nom: 'Laboratoire Sciences',
      code: 'LABO_SCIENCES',
      estObligatoire: false,
    },
    { nom: 'Bibliothèque', code: 'BIBLIOTHEQUE', estObligatoire: true },
    { nom: 'Terrain de Sport', code: 'TERRAIN_SPORT', estObligatoire: true },
    { nom: 'Infirmerie', code: 'INFIRMERIE', estObligatoire: true },
  ];

  await prisma.$transaction(
    typesInfrastructureData.map((data) =>
      prisma.typeInfrastructure.upsert({
        where: { code: data.code },
        update: {},
        create: { ...data, estActif: true },
      }),
    ),
  );
}

/**
 * Seeds the TypeInspection model.
 */
async function seedInspectionTypes() {
  console.log("  🔍 Seeding des types d'inspection...");
  const typesInspectionData = [
    {
      nom: 'Inspection Générale',
      code: 'INSP_GEN',
      estObligatoire: true,
      frequenceMois: 12,
    },
    {
      nom: 'Inspection Pédagogique',
      code: 'INSP_PEDA',
      estObligatoire: true,
      frequenceMois: 6,
    },
    {
      nom: 'Audit Financier',
      code: 'AUDIT_FIN',
      estObligatoire: false,
      frequenceMois: 24,
    },
    {
      nom: 'Contrôle Hygiène et Sécurité',
      code: 'CTRL_HYG_SEC',
      estObligatoire: true,
      frequenceMois: 6,
    },
  ];

  await prisma.$transaction(
    typesInspectionData.map((data) =>
      prisma.typeInspection.upsert({
        where: { code: data.code },
        update: {},
        create: { ...data, estActif: true },
      }),
    ),
  );
}

/**
 * Logs a summary of the data in the database.
 */
async function logSummary() {
  const counts = await prisma.$transaction([
    prisma.departement.count(),
    prisma.district.count(),
    prisma.commune.count(),
    prisma.arrondissement.count(),
    prisma.businessObject.count(),
    prisma.typeAutorisation.count(),
    prisma.typeInfrastructure.count(),
    prisma.typeInspection.count(),
  ]);

  console.log('\n📊 Résumé des données de référence:');
  console.log(`  - Départements: ${counts[0]}`);
  console.log(`  - Districts: ${counts[1]}`);
  console.log(`  - Communes: ${counts[2]}`);
  console.log(`  - Arrondissements: ${counts[3]}`);
  console.log(`  - Objets métier: ${counts[4]}`);
  console.log(`  - Types d'autorisation: ${counts[5]}`);
  console.log(`  - Types d'infrastructure: ${counts[6]}`);
  console.log(`  - Types d'inspection: ${counts[7]}`);
}

// Execute the main seeding function
main().catch((e) => {
  console.error('Le script de seeding des données de référence a échoué:', e);
  process.exit(1);
});
