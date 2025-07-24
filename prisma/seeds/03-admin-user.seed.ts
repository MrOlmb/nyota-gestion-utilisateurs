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
    const ministere = await prisma.ministere.create({
      data: {
        nom: "Ministère de l'Éducation",
        nomComplet:
          "Ministère de l'Enseignement Primaire, Secondaire et de l'Alphabétisation",
        code: 'MEPSA',
        acronyme: 'MEPSA',
        logoUrl: '/logos/ministere-education.png',
        siteWeb: 'https://www.mepsa.gouv.cg',
        email: 'contact@mepsa.gouv.cg',
        telephone: '+242 06 666 00 00',
        adresse: "Avenue de l'Indépendance, Brazzaville",
        estActif: true,
      },
    });

    // 2. Créer les départements ministériels
    console.log('  🏢 Création des départements ministériels...');
    const deptCabinet = await prisma.departementMinisteriel.create({
      data: {
        nom: 'Cabinet du Ministre',
        code: 'CAB',
        description: 'Cabinet du ministre et conseillers',
        ministereId: ministere.id,
        estActif: true,
      },
    });

    const deptSecGen = await prisma.departementMinisteriel.create({
      data: {
        nom: 'Secrétariat Général',
        code: 'SG',
        description: 'Secrétariat général du ministère',
        ministereId: ministere.id,
        estActif: true,
      },
    });

    const deptRH = await prisma.departementMinisteriel.create({
      data: {
        nom: 'Direction des Ressources Humaines',
        code: 'DRH',
        description: 'Gestion des ressources humaines',
        ministereId: ministere.id,
        departementParentId: deptSecGen.id,
        estActif: true,
      },
    });

    const deptPlanif = await prisma.departementMinisteriel.create({
      data: {
        nom: 'Direction de la Planification',
        code: 'DPLAN',
        description: 'Planification et statistiques',
        ministereId: ministere.id,
        departementParentId: deptSecGen.id,
        estActif: true,
      },
    });

    const deptInspection = await prisma.departementMinisteriel.create({
      data: {
        nom: 'Inspection Générale',
        code: 'IG',
        description: "Inspection générale de l'éducation",
        ministereId: ministere.id,
        estActif: true,
      },
    });

    // 3. Récupérer les groupes de sécurité
    const superAdminGroup = await prisma.securityGroupMinistry.findFirst({
      where: { nom: 'Super Administrateurs' },
    });

    const directionCabinetGroup = await prisma.securityGroupMinistry.findFirst({
      where: { nom: 'Direction Cabinet' },
    });

    const inspecteursGroup = await prisma.securityGroupMinistry.findFirst({
      where: { nom: 'Inspecteurs Généraux' },
    });

    const directeursDeptGroup = await prisma.securityGroupMinistry.findFirst({
      where: { nom: 'Directeurs Départementaux' },
    });

    const analystesGroup = await prisma.securityGroupMinistry.findFirst({
      where: { nom: 'Analystes Statistiques' },
    });

    // 4. Récupérer un département géographique (Brazzaville)
    const deptBrazzaville = await prisma.departement.findFirst({
      where: { code: 'BR' },
    });

    // 5. Hasher les mots de passe
    const defaultPasswordHash = await bcryptjs.hash('ChangeMe2024!', 12);

    // 6. Créer le super administrateur
    console.log('  👤 Création du super administrateur...');
    const superAdmin = await prisma.userMinistry.create({
      data: {
        email: 'admin@mepsa.gouv.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Super',
        nom: 'Administrateur',
        typeUtilisateur: 'DIRECTEUR',
        titre: 'Administrateur Système',
        departementId: deptSecGen.id,
        estActif: true,
      },
    });

    // Assigner au groupe Super Admin
    await prisma.userMinistrySecurityGroup.create({
      data: {
        userId: superAdmin.id,
        groupId: superAdminGroup.id,
        estActif: true,
      },
    });

    // 7. Créer le ministre
    console.log('  👤 Création du ministre...');
    const ministre = await prisma.userMinistry.create({
      data: {
        email: 'ministre@mepsa.gouv.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Jean-Luc',
        nom: 'MOUTHOU',
        typeUtilisateur: 'MINISTRE',
        titre: "Ministre de l'Éducation",
        departementId: deptCabinet.id,
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

    // Assigner au groupe Direction Cabinet
    await prisma.userMinistrySecurityGroup.create({
      data: {
        userId: ministre.id,
        groupId: directionCabinetGroup.id,
        estActif: true,
      },
    });

    // 8. Créer d'autres utilisateurs ministère
    console.log('  👥 Création des utilisateurs ministère...');

    // Secrétaire Général
    const secGen = await prisma.userMinistry.create({
      data: {
        email: 'sg@mepsa.gouv.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Marie',
        nom: 'BOUANGA',
        typeUtilisateur: 'SECRETAIRE_GENERAL',
        titre: 'Secrétaire Générale',
        departementId: deptSecGen.id,
        managerId: ministre.id,
        estActif: true,
      },
    });

    // Directeur RH
    const directeurRH = await prisma.userMinistry.create({
      data: {
        email: 'drh@mepsa.gouv.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Pierre',
        nom: 'NGOLO',
        typeUtilisateur: 'DIRECTEUR',
        titre: 'Directeur des Ressources Humaines',
        departementId: deptRH.id,
        managerId: secGen.id,
        estActif: true,
      },
    });

    // Inspecteur Général
    const inspecteurGeneral = await prisma.userMinistry.create({
      data: {
        email: 'ig@mepsa.gouv.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Alphonse',
        nom: 'MBEMBA',
        typeUtilisateur: 'INSPECTEUR',
        titre: 'Inspecteur Général',
        departementId: deptInspection.id,
        managerId: ministre.id,
        estActif: true,
      },
    });

    await prisma.userMinistrySecurityGroup.create({
      data: {
        userId: inspecteurGeneral.id,
        groupId: inspecteursGroup.id,
        estActif: true,
      },
    });

    // Directeur Départemental Brazzaville
    const directeurDeptBrazza = await prisma.userMinistry.create({
      data: {
        email: 'dd.brazza@mepsa.gouv.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Sylvain',
        nom: 'MAKAYA',
        typeUtilisateur: 'DIRECTEUR',
        titre: 'Directeur Départemental - Brazzaville',
        departementId: deptSecGen.id,
        departementGeoId: deptBrazzaville.id,
        managerId: secGen.id,
        estActif: true,
      },
    });

    await prisma.userMinistrySecurityGroup.create({
      data: {
        userId: directeurDeptBrazza.id,
        groupId: directeursDeptGroup.id,
        estActif: true,
      },
    });

    // Analyste Statistique
    const analyste = await prisma.userMinistry.create({
      data: {
        email: 'analyste@mepsa.gouv.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Clarisse',
        nom: 'MOUKOKO',
        typeUtilisateur: 'ANALYSTE',
        titre: 'Analyste Statistique Senior',
        departementId: deptPlanif.id,
        managerId: directeurRH.id,
        estActif: true,
      },
    });

    await prisma.userMinistrySecurityGroup.create({
      data: {
        userId: analyste.id,
        groupId: analystesGroup.id,
        estActif: true,
      },
    });

    // 9. Créer un établissement scolaire de test
    console.log("  🏫 Création d'un établissement de test...");

    const district = await prisma.district.findFirst({
      where: { code: 'BR-MK' }, // Makélékélé
    });

    const commune = await prisma.commune.findFirst({
      where: { districtId: district.id },
    });

    const arrondissement = await prisma.arrondissement.findFirst({
      where: { communeId: commune.id },
    });

    const lyceeTest = await prisma.etablissement.create({
      data: {
        nom: 'Lycée de la Révolution',
        codeEtablissement: 'LYC-REV-001',
        typeEtablissement: 'LYCEE_GENERAL',
        secteur: 'PUBLIC',
        statutAdministratif: 'AUTORISE',
        zone: 'URBAINE',
        adresseComplete: '123 Avenue de la Paix, Makélékélé',
        latitude: -4.2634,
        longitude: 15.2429,
        departementId: deptBrazzaville.id,
        districtId: district.id,
        communeId: commune.id,
        arrondissementId: arrondissement.id,
        numeroTelephone: '+242 06 666 11 11',
        emailOfficiel: 'lycee.revolution@education.cg',
        effectifTotalEleves: 800,
        effectifTotalPersonnel: 65,
        dateOuverture: new Date('1985-09-01'),
        estActif: true,
        creeParId: superAdmin.id,
        modifieParId: superAdmin.id,
      },
    });

    // 10. Créer des utilisateurs école
    console.log('  🏫 Création des utilisateurs école...');

    // Récupérer les groupes école
    const directionEcoleGroup = await prisma.securityGroupSchool.findFirst({
      where: { nom: 'Direction École' },
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

    // Proviseur
    const proviseur = await prisma.userSchool.create({
      data: {
        email: 'proviseur.lyceerev@education.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'François',
        nom: 'NKOUKA',
        typeUtilisateur: 'PROVISEUR',
        etablissementId: lyceeTest.id,
        matricule: 'DIR-001',
        estActif: true,
      },
    });

    await prisma.userSchoolSecurityGroup.create({
      data: {
        userId: proviseur.id,
        groupId: directionEcoleGroup.id,
        estActif: true,
      },
    });

    // Enseignant
    const enseignant = await prisma.userSchool.create({
      data: {
        email: 'prof.maths@lyceerev.education.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'Jeanne',
        nom: 'MABIALA',
        typeUtilisateur: 'ENSEIGNANT',
        etablissementId: lyceeTest.id,
        matricule: 'ENS-042',
        matierePrincipale: 'Mathématiques',
        estActif: true,
      },
    });

    await prisma.userSchoolSecurityGroup.create({
      data: {
        userId: enseignant.id,
        groupId: enseignantsGroup.id,
        estActif: true,
      },
    });

    // Élève
    const eleve = await prisma.userSchool.create({
      data: {
        email: 'eleve.test@lyceerev.education.cg',
        passwordHash: defaultPasswordHash,
        prenom: 'David',
        nom: 'MOUAYA',
        typeUtilisateur: 'ELEVE',
        etablissementId: lyceeTest.id,
        matricule: 'EL-2024-156',
        dateNaissance: new Date('2007-03-15'),
        classe: 'Terminale S1',
        estActif: true,
      },
    });

    await prisma.userSchoolSecurityGroup.create({
      data: {
        userId: eleve.id,
        groupId: elevesGroup.id,
        estActif: true,
      },
    });

    // Parent
    const parent = await prisma.userSchool.create({
      data: {
        email: 'parent.mouaya@gmail.com',
        passwordHash: defaultPasswordHash,
        prenom: 'André',
        nom: 'MOUAYA',
        typeUtilisateur: 'PARENT',
        etablissementId: lyceeTest.id,
        estActif: true,
      },
    });

    await prisma.userSchoolSecurityGroup.create({
      data: {
        userId: parent.id,
        groupId: parentsGroup.id,
        estActif: true,
      },
    });

    // Lier l'élève au parent
    await prisma.userSchool.update({
      where: { id: eleve.id },
      data: { parentId: parent.id },
    });

    // Afficher le résumé
    const userMinistryCount = await prisma.userMinistry.count();
    const userSchoolCount = await prisma.userSchool.count();

    console.log('\n📊 Résumé des utilisateurs créés:');
    console.log(`  - Utilisateurs ministère: ${userMinistryCount}`);
    console.log(`  - Utilisateurs école: ${userSchoolCount}`);
    console.log(`  - Établissements: 1`);

    console.log('\n📧 Comptes créés:');
    console.log('  =====================================');
    console.log('  UTILISATEURS MINISTÈRE:');
    console.log('  -------------------------------------');
    console.log('  Super Admin:');
    console.log('    Email: admin@mepsa.gouv.cg');
    console.log('    Mot de passe: ChangeMe2024!');
    console.log('  -------------------------------------');
    console.log('  Ministre:');
    console.log('    Email: ministre@mepsa.gouv.cg');
    console.log('    Mot de passe: ChangeMe2024!');
    console.log('  -------------------------------------');
    console.log('  Secrétaire Général:');
    console.log('    Email: sg@mepsa.gouv.cg');
    console.log('    Mot de passe: ChangeMe2024!');
    console.log('  -------------------------------------');
    console.log('  Inspecteur Général:');
    console.log('    Email: ig@mepsa.gouv.cg');
    console.log('    Mot de passe: ChangeMe2024!');
    console.log('  -------------------------------------');
    console.log('  Directeur Départemental Brazza:');
    console.log('    Email: dd.brazza@mepsa.gouv.cg');
    console.log('    Mot de passe: ChangeMe2024!');
    console.log('  -------------------------------------');
    console.log('  Analyste:');
    console.log('    Email: analyste@mepsa.gouv.cg');
    console.log('    Mot de passe: ChangeMe2024!');
    console.log('  =====================================');
    console.log('  UTILISATEURS ÉCOLE:');
    console.log('  -------------------------------------');
    console.log('  Proviseur:');
    console.log('    Email: proviseur.lyceerev@education.cg');
    console.log('    Mot de passe: ChangeMe2024!');
    console.log('  -------------------------------------');
    console.log('  Enseignant:');
    console.log('    Email: prof.maths@lyceerev.education.cg');
    console.log('    Mot de passe: ChangeMe2024!');
    console.log('  -------------------------------------');
    console.log('  Élève:');
    console.log('    Email: eleve.test@lyceerev.education.cg');
    console.log('    Mot de passe: ChangeMe2024!');
    console.log('  -------------------------------------');
    console.log('  Parent:');
    console.log('    Email: parent.mouaya@gmail.com');
    console.log('    Mot de passe: ChangeMe2024!');
    console.log('  =====================================');

    console.log('\n✅ Utilisateurs créés avec succès');
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
