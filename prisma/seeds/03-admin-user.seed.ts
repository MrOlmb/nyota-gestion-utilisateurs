import { PrismaClient } from '@prisma/client';
import * as bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

async function seedAdminUser() {
  console.log(
    "👤 Création de l'utilisateur administrateur et des utilisateurs de test...",
  );

  try {
    // 1. Créer le ministère
    console.log('  🏛️ Création du ministère...');
    const ministere = await prisma.ministere.upsert({
      where: { code: 'MEPSA' },
      update: {},
      create: {
        nom: 'MEPSA',
        nomComplet:
          "Ministère de l'Enseignement Primaire, Secondaire et de l'Alphabétisation",
        code: 'MEPSA',
        acronyme: 'MEPSA',
        logoUrl: '/logos/mepsa.png',
        siteWeb: 'https://www.mepsa.gouv.cg',
        email: 'contact@mepsa.gouv.cg',
        telephone: '+242 22 281 41 26',
        adresse: "Avenue de l'Indépendance, Brazzaville, République du Congo",
        estActif: true,
      },
    });

    // 2. Créer les administrations sous tutelle
    console.log('  🏢 Création des administrations...');

    const adminCabinet = await prisma.administration.upsert({
      where: { code: 'CAB-MEPSA' },
      update: {},
      create: {
        nom: 'Cabinet du Ministre',
        code: 'CAB-MEPSA',
        description: 'Cabinet du ministre et services rattachés',
        typeAdministration: 'ADMINISTRATION',
        ministereId: ministere.id,
        estActif: true,
      },
    });

    const adminSecGen = await prisma.administration.upsert({
      where: { code: 'SG-MEPSA' },
      update: {},
      create: {
        nom: 'Secrétariat Général',
        code: 'SG-MEPSA',
        description: 'Secrétariat général du ministère',
        typeAdministration: 'ADMINISTRATION',
        ministereId: ministere.id,
        estActif: true,
      },
    });

    const adminIG = await prisma.administration.upsert({
      where: { code: 'IG-MEPSA' },
      update: {},
      create: {
        nom: 'Inspection Générale',
        code: 'IG-MEPSA',
        description: "Inspection générale de l'enseignement",
        typeAdministration: 'ADMINISTRATION',
        ministereId: ministere.id,
        estActif: true,
      },
    });

    // 3. Créer les structures administratives (nouvelle hiérarchie)
    console.log('  🏗️ Création des structures administratives...');

    // Cabinet du Ministre
    const structCabinet = await prisma.structureAdministrative.upsert({
      where: { code: 'STRUCT-CAB' },
      update: {},
      create: {
        nom: 'Cabinet du Ministre',
        code: 'STRUCT-CAB',
        typeStructure: 'DIRECTION_GENERALE',
        description: 'Cabinet ministériel',
        administrationId: adminCabinet.id,
        estActif: true,
      },
    });

    const structConseillers = await prisma.structureAdministrative.upsert({
      where: { code: 'STRUCT-CONS' },
      update: {},
      create: {
        nom: 'Conseillers du Ministre',
        code: 'STRUCT-CONS',
        typeStructure: 'SERVICE_CENTRAL',
        description: 'Conseillers techniques et spéciaux',
        administrationId: adminCabinet.id,
        parentId: structCabinet.id,
        estActif: true,
      },
    });

    // Secrétariat Général
    const structSecGen = await prisma.structureAdministrative.upsert({
      where: { code: 'STRUCT-SG' },
      update: {},
      create: {
        nom: 'Secrétariat Général',
        code: 'STRUCT-SG',
        typeStructure: 'DIRECTION_GENERALE',
        description: 'Secrétariat général',
        administrationId: adminSecGen.id,
        estActif: true,
      },
    });

    // Directions centrales sous le SG
    const structDEP = await prisma.structureAdministrative.upsert({
      where: { code: 'STRUCT-DEP' },
      update: {},
      create: {
        nom: "Direction de l'Enseignement Primaire",
        code: 'STRUCT-DEP',
        typeStructure: 'DIRECTION_CENTRALE',
        description: "Direction en charge de l'enseignement primaire",
        administrationId: adminSecGen.id,
        parentId: structSecGen.id,
        estActif: true,
      },
    });

    const structDES = await prisma.structureAdministrative.upsert({
      where: { code: 'STRUCT-DES' },
      update: {},
      create: {
        nom: "Direction de l'Enseignement Secondaire",
        code: 'STRUCT-DES',
        typeStructure: 'DIRECTION_CENTRALE',
        description: "Direction en charge de l'enseignement secondaire",
        administrationId: adminSecGen.id,
        parentId: structSecGen.id,
        estActif: true,
      },
    });

    const structDRH = await prisma.structureAdministrative.upsert({
      where: { code: 'STRUCT-DRH' },
      update: {},
      create: {
        nom: 'Direction des Ressources Humaines',
        code: 'STRUCT-DRH',
        typeStructure: 'DIRECTION_CENTRALE',
        description: 'Gestion des ressources humaines',
        administrationId: adminSecGen.id,
        parentId: structSecGen.id,
        estActif: true,
      },
    });

    const structDAF = await prisma.structureAdministrative.upsert({
      where: { code: 'STRUCT-DAF' },
      update: {},
      create: {
        nom: 'Direction des Affaires Financières',
        code: 'STRUCT-DAF',
        typeStructure: 'DIRECTION_CENTRALE',
        description: 'Gestion financière et budgétaire',
        administrationId: adminSecGen.id,
        parentId: structSecGen.id,
        estActif: true,
      },
    });

    const structDPE = await prisma.structureAdministrative.upsert({
      where: { code: 'STRUCT-DPE' },
      update: {},
      create: {
        nom: "Direction de la Planification et de l'Évaluation",
        code: 'STRUCT-DPE',
        typeStructure: 'DIRECTION_CENTRALE',
        description: 'Planification et statistiques',
        administrationId: adminSecGen.id,
        parentId: structSecGen.id,
        estActif: true,
      },
    });

    // Services sous les directions
    const serviceStatsPrimaire = await prisma.structureAdministrative.upsert({
      where: { code: 'SERV-STATS-PRIM' },
      update: {},
      create: {
        nom: 'Service des Statistiques - Primaire',
        code: 'SERV-STATS-PRIM',
        typeStructure: 'SERVICE_CENTRAL',
        description: "Statistiques de l'enseignement primaire",
        administrationId: adminSecGen.id,
        parentId: structDEP.id,
        estActif: true,
      },
    });

    const serviceExamens = await prisma.structureAdministrative.upsert({
      where: { code: 'SERV-EXAM' },
      update: {},
      create: {
        nom: 'Service des Examens et Concours',
        code: 'SERV-EXAM',
        typeStructure: 'SERVICE_CENTRAL',
        description: 'Organisation des examens nationaux',
        administrationId: adminSecGen.id,
        parentId: structDES.id,
        estActif: true,
      },
    });

    // Inspection Générale
    const structIG = await prisma.structureAdministrative.upsert({
      where: { code: 'STRUCT-IG' },
      update: {},
      create: {
        nom: 'Inspection Générale',
        code: 'STRUCT-IG',
        typeStructure: 'DIRECTION_GENERALE',
        description: 'Inspection générale',
        administrationId: adminIG.id,
        estActif: true,
      },
    });

    const structInspPrimaire = await prisma.structureAdministrative.upsert({
      where: { code: 'STRUCT-INSP-PRIM' },
      update: {},
      create: {
        nom: 'Inspection du Primaire',
        code: 'STRUCT-INSP-PRIM',
        typeStructure: 'DIRECTION_CENTRALE',
        description: "Inspection de l'enseignement primaire",
        administrationId: adminIG.id,
        parentId: structIG.id,
        estActif: true,
      },
    });

    const structInspSecondaire = await prisma.structureAdministrative.upsert({
      where: { code: 'STRUCT-INSP-SEC' },
      update: {},
      create: {
        nom: 'Inspection du Secondaire',
        code: 'STRUCT-INSP-SEC',
        typeStructure: 'DIRECTION_CENTRALE',
        description: "Inspection de l'enseignement secondaire",
        administrationId: adminIG.id,
        parentId: structIG.id,
        estActif: true,
      },
    });

    // Délégations régionales (exemples pour Brazzaville et Pointe-Noire)
    const deptBrazza = await prisma.departement.findFirst({
      where: { code: 'BR' },
    });
    const deptPN = await prisma.departement.findFirst({
      where: { code: 'PN' },
    });

    const delegBrazza = await prisma.structureAdministrative.upsert({
      where: { code: 'DELEG-BR' },
      update: {},
      create: {
        nom: 'Délégation Départementale de Brazzaville',
        code: 'DELEG-BR',
        typeStructure: 'DELEGATION_REGIONALE',
        description: "Délégation départementale de l'éducation - Brazzaville",
        administrationId: adminSecGen.id,
        departementId: deptBrazza.id,
        estActif: true,
      },
    });

    const delegPN = await prisma.structureAdministrative.upsert({
      where: { code: 'DELEG-PN' },
      update: {},
      create: {
        nom: 'Délégation Départementale de Pointe-Noire',
        code: 'DELEG-PN',
        typeStructure: 'DELEGATION_REGIONALE',
        description: "Délégation départementale de l'éducation - Pointe-Noire",
        administrationId: adminSecGen.id,
        departementId: deptPN.id,
        estActif: true,
      },
    });

    // 4. Récupérer les groupes de sécurité
    const superAdminGroup = await prisma.securityGroupMinistry.findFirst({
      where: { nom: 'Super Administrateurs' },
    });

    const cabinetGroup = await prisma.securityGroupMinistry.findFirst({
      where: { nom: 'Cabinet Ministériel' },
    });

    const sgGroup = await prisma.securityGroupMinistry.findFirst({
      where: { nom: 'Secrétariat Général' },
    });

    const directeursGenerauxGroup =
      await prisma.securityGroupMinistry.findFirst({
        where: { nom: 'Directeurs Généraux' },
      });

    const directeursCentrauxGroup =
      await prisma.securityGroupMinistry.findFirst({
        where: { nom: 'Directeurs Centraux' },
      });

    const deleguesRegionauxGroup = await prisma.securityGroupMinistry.findFirst(
      {
        where: { nom: 'Délégués Régionaux' },
      },
    );

    const inspecteursGroup = await prisma.securityGroupMinistry.findFirst({
      where: { nom: 'Inspecteurs' },
    });

    // 5. Hasher les mots de passe
    const defaultPasswordHash = await bcryptjs.hash('admin123', 12);

    // 6. Créer les utilisateurs du ministère
    console.log('  👥 Création des utilisateurs ministère...');

    // Super Administrateur
    const superAdmin = await prisma.userMinistry.upsert({
      where: { email: 'admin@mepsa.gouv.cg' },
      update: {},
      create: {
        email: 'admin@mepsa.gouv.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Admin',
        nom: 'SYSTÈME',
        typeUtilisateur: 'DIRECTEUR',
        titre: 'Administrateur Système',
        structureId: structSecGen.id,
        estActif: true,
      },
    });

    await prisma.userMinistrySecurityGroup.upsert({
      where: {
        userId_groupId: {
          userId: superAdmin.id,
          groupId: superAdminGroup.id,
        },
      },
      update: {},
      create: {
        userId: superAdmin.id,
        groupId: superAdminGroup.id,
        estActif: true,
      },
    });

    // Ministre
    const ministre = await prisma.userMinistry.upsert({
      where: { email: 'ministre@mepsa.gouv.cg' },
      update: {},
      create: {
        email: 'ministre@mepsa.gouv.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Jean-Luc',
        nom: 'MOUTHOU',
        typeUtilisateur: 'MINISTRE',
        titre:
          "Ministre de l'Enseignement Primaire, Secondaire et de l'Alphabétisation",
        structureId: structCabinet.id,
        estActif: true,
      },
    });

    // Mettre à jour le ministère avec le ministre actuel
    await prisma.ministere.update({
      where: { id: ministere.id },
      data: {
        ministreActuelId: ministre.id,
        dateNomination: new Date('2023-01-15'),
      },
    });

    await prisma.userMinistrySecurityGroup.upsert({
      where: {
        userId_groupId: {
          userId: ministre.id,
          groupId: cabinetGroup.id,
        },
      },
      update: {},
      create: {
        userId: ministre.id,
        groupId: cabinetGroup.id,
        estActif: true,
      },
    });

    // Directeur de Cabinet
    const dirCabinet = await prisma.userMinistry.upsert({
      where: { email: 'dircab@mepsa.gouv.cg' },
      update: {},
      create: {
        email: 'dircab@mepsa.gouv.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Marcel',
        nom: 'ONDONGO',
        typeUtilisateur: 'DIRECTEUR_CABINET',
        titre: 'Directeur de Cabinet',
        structureId: structCabinet.id,
        managerId: ministre.id,
        estActif: true,
      },
    });

    await prisma.userMinistrySecurityGroup.upsert({
      where: {
        userId_groupId: {
          userId: dirCabinet.id,
          groupId: cabinetGroup.id,
        },
      },
      update: {},
      create: {
        userId: dirCabinet.id,
        groupId: cabinetGroup.id,
        estActif: true,
      },
    });

    // Secrétaire Général
    const secGen = await prisma.userMinistry.upsert({
      where: { email: 'sg@mepsa.gouv.cg' },
      update: {},
      create: {
        email: 'sg@mepsa.gouv.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Marie-Claire',
        nom: 'MBOUNGOU',
        typeUtilisateur: 'SECRETAIRE_GENERAL',
        titre: 'Secrétaire Générale',
        structureId: structSecGen.id,
        managerId: ministre.id,
        estActif: true,
      },
    });

    await prisma.userMinistrySecurityGroup.upsert({
      where: {
        userId_groupId: {
          userId: secGen.id,
          groupId: sgGroup.id,
        },
      },
      update: {},
      create: {
        userId: secGen.id,
        groupId: sgGroup.id,
        estActif: true,
      },
    });

    // Inspecteur Général
    const inspecteurGeneral = await prisma.userMinistry.upsert({
      where: { email: 'ig@mepsa.gouv.cg' },
      update: {},
      create: {
        email: 'ig@mepsa.gouv.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Raymond',
        nom: 'MBEMBA',
        typeUtilisateur: 'INSPECTEUR',
        titre: 'Inspecteur Général',
        structureId: structIG.id,
        managerId: ministre.id,
        estActif: true,
      },
    });

    await prisma.userMinistrySecurityGroup.upsert({
      where: {
        userId_groupId: {
          userId: inspecteurGeneral.id,
          groupId: directeursGenerauxGroup.id,
        },
      },
      update: {},
      create: {
        userId: inspecteurGeneral.id,
        groupId: directeursGenerauxGroup.id,
        estActif: true,
      },
    });

    // Directeur de l'Enseignement Primaire
    const dirPrimaire = await prisma.userMinistry.upsert({
      where: { email: 'dep@mepsa.gouv.cg' },
      update: {},
      create: {
        email: 'dep@mepsa.gouv.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Alphonse',
        nom: 'NKOUA',
        typeUtilisateur: 'DIRECTEUR',
        titre: "Directeur de l'Enseignement Primaire",
        structureId: structDEP.id,
        managerId: secGen.id,
        estActif: true,
      },
    });

    await prisma.userMinistrySecurityGroup.upsert({
      where: {
        userId_groupId: {
          userId: dirPrimaire.id,
          groupId: directeursCentrauxGroup.id,
        },
      },
      update: {},
      create: {
        userId: dirPrimaire.id,
        groupId: directeursCentrauxGroup.id,
        estActif: true,
      },
    });

    // Directeur de l'Enseignement Secondaire
    const dirSecondaire = await prisma.userMinistry.upsert({
      where: { email: 'des@mepsa.gouv.cg' },
      update: {},
      create: {
        email: 'des@mepsa.gouv.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Bernadette',
        nom: 'MAKAYA',
        typeUtilisateur: 'DIRECTEUR',
        titre: "Directrice de l'Enseignement Secondaire",
        structureId: structDES.id,
        managerId: secGen.id,
        estActif: true,
      },
    });

    await prisma.userMinistrySecurityGroup.upsert({
      where: {
        userId_groupId: {
          userId: dirSecondaire.id,
          groupId: directeursCentrauxGroup.id,
        },
      },
      update: {},
      create: {
        userId: dirSecondaire.id,
        groupId: directeursCentrauxGroup.id,
        estActif: true,
      },
    });

    // Délégué Départemental Brazzaville
    const delegBrazzaUser = await prisma.userMinistry.upsert({
      where: { email: 'dd.brazza@mepsa.gouv.cg' },
      update: {},
      create: {
        email: 'dd.brazza@mepsa.gouv.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'François',
        nom: 'NGOMBE',
        typeUtilisateur: 'DIRECTEUR',
        titre: 'Délégué Départemental - Brazzaville',
        structureId: delegBrazza.id,
        departementGeoId: deptBrazza.id,
        managerId: secGen.id,
        estActif: true,
      },
    });

    await prisma.userMinistrySecurityGroup.upsert({
      where: {
        userId_groupId: {
          userId: delegBrazzaUser.id,
          groupId: deleguesRegionauxGroup.id,
        },
      },
      update: {},
      create: {
        userId: delegBrazzaUser.id,
        groupId: deleguesRegionauxGroup.id,
        estActif: true,
      },
    });

    // Inspecteur Primaire
    const inspecteurPrimaire = await prisma.userMinistry.upsert({
      where: { email: 'insp.primaire@mepsa.gouv.cg' },
      update: {},
      create: {
        email: 'insp.primaire@mepsa.gouv.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Julienne',
        nom: 'MOUKOKO',
        typeUtilisateur: 'INSPECTEUR',
        titre: 'Inspectrice du Primaire',
        structureId: structInspPrimaire.id,
        departementGeoId: deptBrazza.id,
        managerId: inspecteurGeneral.id,
        estActif: true,
      },
    });

    await prisma.userMinistrySecurityGroup.upsert({
      where: {
        userId_groupId: {
          userId: inspecteurPrimaire.id,
          groupId: inspecteursGroup.id,
        },
      },
      update: {},
      create: {
        userId: inspecteurPrimaire.id,
        groupId: inspecteursGroup.id,
        estActif: true,
      },
    });

    // 7. Créer des établissements scolaires de test
    console.log('  🏫 Création des établissements de test...');

    // Récupérer les données géographiques
    const districtMakelekele = await prisma.district.findFirst({
      where: { code: 'BR-MK' },
    });
    const communeMakelekele = await prisma.commune.findFirst({
      where: { districtId: districtMakelekele.id },
    });
    const arrondissementMK = await prisma.arrondissement.findFirst({
      where: { communeId: communeMakelekele.id },
    });

    // École primaire urbaine
    const ecolePrimaire = await prisma.etablissement.upsert({
      where: { codeEtablissement: 'EP-FRAT-001' },
      update: {},
      create: {
        nom: 'École Primaire de la Fraternité',
        codeEtablissement: 'EP-FRAT-001',
        typeEtablissement: 'PRIMAIRE',
        secteur: 'PUBLIC',
        statutAdministratif: 'AUTORISE',
        zone: 'URBAINE',
        adresseComplete: '45 Rue Ndolo, Makélékélé',
        latitude: -4.2741,
        longitude: 15.2619,
        departementId: deptBrazza.id,
        districtId: districtMakelekele.id,
        communeId: communeMakelekele.id,
        arrondissementId: arrondissementMK.id,
        numeroTelephone: '+242 06 666 11 22',
        emailOfficiel: 'epfraternite@education.cg',
        effectifTotalEleves: 450,
        effectifTotalPersonnel: 22,
        dateOuverture: new Date('1975-09-15'),
        estActif: true,
        creeParId: superAdmin.id,
        modifieParId: superAdmin.id,
      },
    });

    // Lycée général urbain
    const districtBacongo = await prisma.district.findFirst({
      where: { code: 'BR-BC' },
    });
    const communeBacongo = await prisma.commune.findFirst({
      where: { districtId: districtBacongo.id },
    });

    const lyceeGeneral = await prisma.etablissement.upsert({
      where: { codeEtablissement: 'LYC-SANK-001' },
      update: {},
      create: {
        nom: 'Lycée Thomas Sankara',
        codeEtablissement: 'LYC-SANK-001',
        typeEtablissement: 'LYCEE_GENERAL',
        secteur: 'PUBLIC',
        statutAdministratif: 'AUTORISE',
        zone: 'URBAINE',
        adresseComplete: "12 Avenue de l'Indépendance, Bacongo",
        latitude: -4.2934,
        longitude: 15.2529,
        departementId: deptBrazza.id,
        districtId: districtBacongo.id,
        communeId: communeBacongo.id,
        numeroTelephone: '+242 06 666 33 44',
        emailOfficiel: 'lycee.sankara@education.cg',
        siteWeb: 'www.lycee-sankara.cg',
        effectifTotalEleves: 1200,
        effectifTotalPersonnel: 85,
        dateOuverture: new Date('1992-09-01'),
        estActif: true,
        creeParId: superAdmin.id,
        modifieParId: superAdmin.id,
      },
    });

    // École rurale dans le Pool
    const districtKinkala = await prisma.district.findFirst({
      where: { code: 'PL-KIN' },
    });
    const communeKinkala = await prisma.commune.findFirst({
      where: { districtId: districtKinkala.id },
    });

    const ecoleRurale = await prisma.etablissement.upsert({
      where: { codeEtablissement: 'EP-MBANZA-001' },
      update: {},
      create: {
        nom: 'École Primaire de Mbanza',
        codeEtablissement: 'EP-MBANZA-001',
        typeEtablissement: 'PRIMAIRE',
        secteur: 'PUBLIC',
        statutAdministratif: 'AUTORISE',
        zone: 'RURALE',
        adresseComplete: 'Village Mbanza, District de Kinkala',
        departementId: await prisma.departement
          .findFirst({ where: { code: 'PL' } })
          .then((d) => d.id),
        districtId: districtKinkala.id,
        communeId: communeKinkala.id,
        numeroTelephone: '+242 06 555 11 22',
        effectifTotalEleves: 120,
        effectifTotalPersonnel: 6,
        dateOuverture: new Date('1968-10-01'),
        estActif: true,
        creeParId: superAdmin.id,
        modifieParId: superAdmin.id,
      },
    });

    // 8. Créer des utilisateurs école
    console.log('  👥 Création des utilisateurs école...');

    // Récupérer les groupes école
    const directionGroup = await prisma.securityGroupSchool.findFirst({
      where: { nom: 'Direction École' },
    });
    const personnelAdminGroup = await prisma.securityGroupSchool.findFirst({
      where: { nom: 'Personnel Administratif' },
    });
    const enseignantsGroup = await prisma.securityGroupSchool.findFirst({
      where: { nom: 'Enseignants' },
    });
    const elevesGroup = await prisma.securityGroupSchool.findFirst({
      where: { nom: 'Élèves' },
    });
    const parentsGroup = await prisma.securityGroupSchool.findFirst({
      where: { nom: 'Parents' },
    });

    // Directeur école primaire
    const directeurEP = await prisma.userSchool.upsert({
      where: { email: 'directeur.epfrat@education.cg' },
      update: {},
      create: {
        email: 'directeur.epfrat@education.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Joseph',
        nom: 'MABIALA',
        typeUtilisateur: 'DIRECTEUR',
        etablissementId: ecolePrimaire.id,
        matricule: 'DIR-EP-001',
        estActif: true,
      },
    });

    await prisma.userSchoolSecurityGroup.upsert({
      where: {
        userId_groupId: {
          userId: directeurEP.id,
          groupId: directionGroup.id,
        },
      },
      update: {},
      create: {
        userId: directeurEP.id,
        groupId: directionGroup.id,
        estActif: true,
      },
    });

    // Proviseur lycée
    const proviseur = await prisma.userSchool.upsert({
      where: { email: 'proviseur.sankara@education.cg' },
      update: {},
      create: {
        email: 'proviseur.sankara@education.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Félicité',
        nom: 'NGUIMBI',
        typeUtilisateur: 'PROVISEUR',
        etablissementId: lyceeGeneral.id,
        matricule: 'PROV-001',
        estActif: true,
      },
    });

    await prisma.userSchoolSecurityGroup.upsert({
      where: {
        userId_groupId: {
          userId: proviseur.id,
          groupId: directionGroup.id,
        },
      },
      update: {},
      create: {
        userId: proviseur.id,
        groupId: directionGroup.id,
        estActif: true,
      },
    });

    // Censeur lycée
    const censeur = await prisma.userSchool.upsert({
      where: { email: 'censeur.sankara@education.cg' },
      update: {},
      create: {
        email: 'censeur.sankara@education.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Patrick',
        nom: 'MOUAMBA',
        typeUtilisateur: 'CENSEUR',
        etablissementId: lyceeGeneral.id,
        matricule: 'CENS-001',
        estActif: true,
      },
    });

    await prisma.userSchoolSecurityGroup.upsert({
      where: {
        userId_groupId: {
          userId: censeur.id,
          groupId: personnelAdminGroup.id,
        },
      },
      update: {},
      create: {
        userId: censeur.id,
        groupId: personnelAdminGroup.id,
        estActif: true,
      },
    });

    // Enseignants
    const profMaths = await prisma.userSchool.upsert({
      where: { email: 'prof.maths@sankara.education.cg' },
      update: {},
      create: {
        email: 'prof.maths@sankara.education.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Serge',
        nom: 'NGOYI',
        typeUtilisateur: 'ENSEIGNANT',
        etablissementId: lyceeGeneral.id,
        matricule: 'ENS-MATH-042',
        matierePrincipale: 'Mathématiques',
        estActif: true,
      },
    });

    await prisma.userSchoolSecurityGroup.upsert({
      where: {
        userId_groupId: {
          userId: profMaths.id,
          groupId: enseignantsGroup.id,
        },
      },
      update: {},
      create: {
        userId: profMaths.id,
        groupId: enseignantsGroup.id,
        estActif: true,
      },
    });

    const profFrancais = await prisma.userSchool.upsert({
      where: { email: 'prof.francais@epfrat.education.cg' },
      update: {},
      create: {
        email: 'prof.francais@epfrat.education.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Clémentine',
        nom: 'BASSOUAMINA',
        typeUtilisateur: 'ENSEIGNANT',
        etablissementId: ecolePrimaire.id,
        matricule: 'ENS-FR-015',
        matierePrincipale: 'Français',
        estActif: true,
      },
    });

    await prisma.userSchoolSecurityGroup.upsert({
      where: {
        userId_groupId: {
          userId: profFrancais.id,
          groupId: enseignantsGroup.id,
        },
      },
      update: {},
      create: {
        userId: profFrancais.id,
        groupId: enseignantsGroup.id,
        estActif: true,
      },
    });

    // Élèves
    const eleve1 = await prisma.userSchool.upsert({
      where: { email: 'grace.moukassa@sankara.education.cg' },
      update: {},
      create: {
        email: 'grace.moukassa@sankara.education.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Grâce',
        nom: 'MOUKASSA',
        typeUtilisateur: 'ELEVE',
        etablissementId: lyceeGeneral.id,
        matricule: 'EL-2024-156',
        dateNaissance: new Date('2007-03-15'),
        classe: 'Terminale S1',
        estActif: true,
      },
    });

    await prisma.userSchoolSecurityGroup.upsert({
      where: {
        userId_groupId: {
          userId: eleve1.id,
          groupId: elevesGroup.id,
        },
      },
      update: {},
      create: {
        userId: eleve1.id,
        groupId: elevesGroup.id,
        estActif: true,
      },
    });

    const eleve2 = await prisma.userSchool.upsert({
      where: { email: 'jean.biyoudi@epfrat.education.cg' },
      update: {},
      create: {
        email: 'jean.biyoudi@epfrat.education.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Jean',
        nom: 'BIYOUDI',
        typeUtilisateur: 'ELEVE',
        etablissementId: ecolePrimaire.id,
        matricule: 'EL-2024-089',
        dateNaissance: new Date('2013-07-22'),
        classe: 'CM2',
        estActif: true,
      },
    });

    await prisma.userSchoolSecurityGroup.upsert({
      where: {
        userId_groupId: {
          userId: eleve2.id,
          groupId: elevesGroup.id,
        },
      },
      update: {},
      create: {
        userId: eleve2.id,
        groupId: elevesGroup.id,
        estActif: true,
      },
    });

    // Parents
    const parent1 = await prisma.userSchool.upsert({
      where: { email: 'parent.moukassa@gmail.com' },
      update: {},
      create: {
        email: 'parent.moukassa@gmail.com',
        passwordHash: defaultPasswordHash,
        prenom: 'Ange',
        nom: 'MOUKASSA',
        typeUtilisateur: 'PARENT',
        etablissementId: lyceeGeneral.id,
        estActif: true,
      },
    });

    await prisma.userSchoolSecurityGroup.upsert({
      where: {
        userId_groupId: {
          userId: parent1.id,
          groupId: parentsGroup.id,
        },
      },
      update: {},
      create: {
        userId: parent1.id,
        groupId: parentsGroup.id,
        estActif: true,
      },
    });

    // Lier l'élève au parent
    await prisma.userSchool.update({
      where: { id: eleve1.id },
      data: { parentId: parent1.id },
    });

    // Afficher le résumé
    const userMinistryCount = await prisma.userMinistry.count();
    const userSchoolCount = await prisma.userSchool.count();
    const etablissementCount = await prisma.etablissement.count();
    const structureCount = await prisma.structureAdministrative.count();

    console.log('\n📊 Résumé des utilisateurs créés:');
    console.log(`  - Ministère: 1`);
    console.log(`  - Administrations: 3`);
    console.log(`  - Structures administratives: ${structureCount}`);
    console.log(`  - Utilisateurs ministère: ${userMinistryCount}`);
    console.log(`  - Utilisateurs école: ${userSchoolCount}`);
    console.log(`  - Établissements: ${etablissementCount}`);

    console.log('\n📧 Comptes créés:');
    console.log('  ================================================');
    console.log('  UTILISATEURS MINISTÈRE:');
    console.log('  ------------------------------------------------');
    console.log('  Super Admin:');
    console.log('    Email: admin@mepsa.gouv.cg');
    console.log('    Mot de passe: admin123');
    console.log('  ------------------------------------------------');
    console.log('  Ministre:');
    console.log('    Email: ministre@mepsa.gouv.cg');
    console.log('    Mot de passe: admin123');
    console.log('  ------------------------------------------------');
    console.log('  Directeur de Cabinet:');
    console.log('    Email: dircab@mepsa.gouv.cg');
    console.log('    Mot de passe: admin123');
    console.log('  ------------------------------------------------');
    console.log('  Secrétaire Général:');
    console.log('    Email: sg@mepsa.gouv.cg');
    console.log('    Mot de passe: admin123');
    console.log('  ------------------------------------------------');
    console.log('  Inspecteur Général:');
    console.log('    Email: ig@mepsa.gouv.cg');
    console.log('    Mot de passe: admin123');
    console.log('  ------------------------------------------------');
    console.log('  Directeur Enseignement Primaire:');
    console.log('    Email: dep@mepsa.gouv.cg');
    console.log('    Mot de passe: admin123');
    console.log('  ------------------------------------------------');
    console.log('  Directeur Enseignement Secondaire:');
    console.log('    Email: des@mepsa.gouv.cg');
    console.log('    Mot de passe: admin123');
    console.log('  ------------------------------------------------');
    console.log('  Délégué Départemental Brazzaville:');
    console.log('    Email: dd.brazza@mepsa.gouv.cg');
    console.log('    Mot de passe: admin123');
    console.log('  ================================================');
    console.log('  UTILISATEURS ÉCOLE:');
    console.log('  ------------------------------------------------');
    console.log('  Directeur École Primaire:');
    console.log('    Email: directeur.epfrat@education.cg');
    console.log('    Mot de passe: admin123');
    console.log('  ------------------------------------------------');
    console.log('  Proviseur Lycée:');
    console.log('    Email: proviseur.sankara@education.cg');
    console.log('    Mot de passe: admin123');
    console.log('  ------------------------------------------------');
    console.log('  Enseignants:');
    console.log('    Email: prof.maths@sankara.education.cg');
    console.log('    Email: prof.francais@epfrat.education.cg');
    console.log('    Mot de passe: admin123');
    console.log('  ------------------------------------------------');
    console.log('  Élèves:');
    console.log('    Email: grace.moukassa@sankara.education.cg');
    console.log('    Email: jean.biyoudi@epfrat.education.cg');
    console.log('    Mot de passe: admin123');
    console.log('  ------------------------------------------------');
    console.log('  Parent:');
    console.log('    Email: parent.moukassa@gmail.com');
    console.log('    Mot de passe: admin123');
    console.log('  ================================================');

    console.log('\n✅ Utilisateurs et structures créés avec succès');
  } catch (error) {
    console.error('❌ Erreur lors de la création des utilisateurs:', error);
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
