/**
 * Test setup and teardown utilities for NYOTA security testing
 * Provides database seeding, cleanup, and state management for tests
 */

import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import {
  UserMinistryType,
  UserSchoolType,
  TypeEtablissement,
  SecteurEtablissement,
  StatutAdministratif,
  Zone,
  ObjectScope,
  RuleType,
  TypeStructure,
} from '@prisma/client';

/**
 * Test data seeds for consistent testing
 */
export const TestSeeds = {
  departements: [
    { id: 'dept-bz', nom: 'Bouenza', code: 'BZ' },
    { id: 'dept-kl', nom: 'Kouilou', code: 'KL' },
  ],

  districts: [
    { id: 'district-bz-mad', nom: 'Madingou', code: 'BZ-MAD', departementId: 'dept-bz' },
    { id: 'district-kl-ptn', nom: 'Pointe-Noire', code: 'KL-PTN', departementId: 'dept-kl' },
  ],

  communes: [
    { id: 'commune-bz-mad-c', nom: 'Madingou Centre', code: 'BZ-MAD-C', districtId: 'district-bz-mad' },
    { id: 'commune-kl-ptn-1', nom: 'Pointe-Noire 1', code: 'KL-PTN-1', districtId: 'district-kl-ptn' },
  ],

  structures: [
    {
      id: 'structure-1',
      nom: 'Direction Départementale Bouenza',
      code: 'DDB',
      typeStructure: TypeStructure.DELEGATION_REGIONALE,
      departementId: 'dept-bz',
    },
    {
      id: 'structure-2',
      nom: 'Direction Centrale',
      code: 'DC',
      typeStructure: TypeStructure.DIRECTION_CENTRALE,
    },
  ],

  businessObjects: [
    { id: 'bo-etab', nom: 'etablissement.management', scope: ObjectScope.COMMON, module: 'ETABLISSEMENT' },
    { id: 'bo-user', nom: 'user.management', scope: ObjectScope.COMMON, module: 'USER' },
    { id: 'bo-student', nom: 'student.management', scope: ObjectScope.SCHOOL, module: 'ETABLISSEMENT' },
    { id: 'bo-teacher', nom: 'teacher.management', scope: ObjectScope.SCHOOL, module: 'ETABLISSEMENT' },
    { id: 'bo-inspection', nom: 'inspection.management', scope: ObjectScope.MINISTRY, module: 'INSPECTION' },
    { id: 'bo-admin', nom: 'global.admin', scope: ObjectScope.MINISTRY, module: 'ADMIN' },
  ],

  securityGroupsMinistry: [
    { id: 'group-minister', nom: 'Ministre', description: 'Accès total' },
    { id: 'group-director', nom: 'Directeur Ministère', description: 'Accès de direction' },
  ],

  securityGroupsSchool: [
    { id: 'group-school-director', nom: 'Directeur École', description: 'Directeur d\'établissement' },
    { id: 'group-teacher', nom: 'Enseignant', description: 'Enseignant' },
  ],

  ministryUsers: [
    {
      id: 'ministry-user-1',
      email: 'ministre@education.cg',
      passwordHash: '$2b$10$dUFmSVzVoOykj6urBrkKh.yj6Cgr6ZiIgmYYwlY0Ut7C1j3lnpZMu', // password123
      prenom: 'Jean',
      nom: 'Ministre',
      typeUtilisateur: UserMinistryType.MINISTRE,
      estActif: true,
    },
    {
      id: 'ministry-user-2',
      email: 'directeur@ministere.cg',
      passwordHash: '$2b$10$dUFmSVzVoOykj6urBrkKh.yj6Cgr6ZiIgmYYwlY0Ut7C1j3lnpZMu', // password123
      prenom: 'Marie',
      nom: 'Directrice',
      typeUtilisateur: UserMinistryType.DIRECTEUR,
      structureId: 'structure-1',
      estActif: true,
    },
  ],

  establishments: [
    {
      id: 'etablissement-1',
      nom: 'École Primaire de Brazzaville',
      codeEtablissement: 'EPB01',
      typeEtablissement: TypeEtablissement.PRIMAIRE,
      secteur: SecteurEtablissement.PUBLIC,
      statutAdministratif: StatutAdministratif.AUTORISE,
      zone: Zone.URBAINE,
      adresseComplete: '123 Rue de la Paix',
      departementId: 'dept-bz',
      districtId: 'district-bz-mad',
      communeId: 'commune-bz-mad-c',
      creeParId: 'ministry-user-2',
      modifieParId: 'ministry-user-2',
    },
  ],

  schoolUsers: [
    {
      id: 'school-user-1',
      email: 'directeur@ecole1.cg',
      passwordHash: '$2b$10$dUFmSVzVoOykj6urBrkKh.yj6Cgr6ZiIgmYYwlY0Ut7C1j3lnpZMu', // password123
      prenom: 'Sophie',
      nom: 'Directrice',
      typeUtilisateur: UserSchoolType.DIRECTEUR,
      etablissementId: 'etablissement-1',
      estActif: true,
    },
  ],
};

/**
 * Test database manager
 */
export class TestDatabaseManager {
  constructor(private prisma: PrismaService) {}

  async seedTestData(): Promise<void> {
    try {
      await this.seedReferenceData();
      await this.seedUsersAndStructures();
      await this.seedSecurityModel();
      console.log('✅ Test database seeded successfully');
    } catch (error) {
      console.error('❌ Error seeding test database:', error);
      throw error;
    }
  }

  async cleanupTestData(): Promise<void> {
    try {
      // Delete in reverse dependency order
      await this.prisma.userMinistrySecurityGroup.deleteMany({});
      await this.prisma.userSchoolSecurityGroup.deleteMany({});
      await this.prisma.groupPermissionMinistry.deleteMany({});
      await this.prisma.groupPermissionSchool.deleteMany({});
      await this.prisma.visibilityRuleMinistry.deleteMany({});
      await this.prisma.visibilityRuleSchool.deleteMany({});
      await this.prisma.uIRuleMinistry.deleteMany({});
      await this.prisma.uIRuleSchool.deleteMany({});
      await this.prisma.securityGroupMinistry.deleteMany({});
      await this.prisma.securityGroupSchool.deleteMany({});
      await this.prisma.businessObject.deleteMany({});
      await this.prisma.journalAudit.deleteMany({});
      await this.prisma.userSchool.deleteMany({});
      await this.prisma.etablissement.deleteMany({});
      await this.prisma.userMinistry.deleteMany({});
      await this.prisma.structureAdministrative.deleteMany({});
      await this.prisma.commune.deleteMany({});
      await this.prisma.district.deleteMany({});
      await this.prisma.departement.deleteMany({});

      console.log('✅ Test database cleaned successfully');
    } catch (error) {
      console.error('❌ Error cleaning test database:', error);
      throw error;
    }
  }

  async resetTestDatabase(): Promise<void> {
    await this.cleanupTestData();
    await this.seedTestData();
  }

  private async seedReferenceData(): Promise<void> {
    await this.prisma.departement.createMany({ data: TestSeeds.departements, skipDuplicates: true });
    await this.prisma.district.createMany({ data: TestSeeds.districts, skipDuplicates: true });
    await this.prisma.commune.createMany({ data: TestSeeds.communes, skipDuplicates: true });
    await this.prisma.businessObject.createMany({ data: TestSeeds.businessObjects, skipDuplicates: true });
  }

  private async seedUsersAndStructures(): Promise<void> {
    await this.prisma.structureAdministrative.createMany({ data: TestSeeds.structures, skipDuplicates: true });
    await this.prisma.userMinistry.createMany({ data: TestSeeds.ministryUsers, skipDuplicates: true });
    await this.prisma.etablissement.createMany({ data: TestSeeds.establishments, skipDuplicates: true });
    await this.prisma.userSchool.createMany({ data: TestSeeds.schoolUsers, skipDuplicates: true });
  }

  private async seedSecurityModel(): Promise<void> {
    await this.prisma.securityGroupMinistry.createMany({ data: TestSeeds.securityGroupsMinistry, skipDuplicates: true });
    await this.prisma.securityGroupSchool.createMany({ data: TestSeeds.securityGroupsSchool, skipDuplicates: true });

    // Assign groups
    await this.prisma.userMinistrySecurityGroup.create({
      data: { userId: 'ministry-user-1', groupId: 'group-minister' },
    });
    await this.prisma.userMinistrySecurityGroup.create({
      data: { userId: 'ministry-user-2', groupId: 'group-director' },
    });
    await this.prisma.userSchoolSecurityGroup.create({
      data: { userId: 'school-user-1', groupId: 'group-school-director' },
    });

    // Permissions Ministry
    await this.prisma.groupPermissionMinistry.create({
      data: {
        groupId: 'group-minister',
        objectId: 'bo-admin',
        peutLire: true, peutEcrire: true, peutCreer: true, peutSupprimer: true, peutApprouver: true,
      },
    });
    await this.prisma.groupPermissionMinistry.create({
      data: {
        groupId: 'group-director',
        objectId: 'bo-etab',
        peutLire: true, peutEcrire: true, peutCreer: true, peutSupprimer: false, peutApprouver: true,
      },
    });

    // Permissions School
    await this.prisma.groupPermissionSchool.create({
      data: {
        groupId: 'group-school-director',
        objectId: 'bo-student',
        peutLire: true, peutEcrire: true, peutCreer: true, peutSupprimer: false,
      },
    });

    // Visibility Rules
    await this.prisma.visibilityRuleMinistry.create({
      data: {
        nom: 'Hierarchy Rule for Directors',
        groupId: 'group-director',
        objectId: 'bo-etab',
        typeRegle: RuleType.HIERARCHY,
        condition: { field: 'creeParId' },
        priorite: 1,
      },
    });
    await this.prisma.visibilityRuleSchool.create({
      data: {
        nom: 'Tenant Rule for School Directors',
        groupId: 'group-school-director',
        objectId: 'bo-student',
        typeRegle: RuleType.TENANT,
        condition: { allowMultipleEstablishments: false },
        priorite: 1,
      },
    });
  }
}

/**
 * Test Redis manager
 */
export class TestRedisManager {
  constructor(private redis: RedisService) {}

  async clearTestCache(): Promise<void> {
    try {
      const redisClient = this.redis.getClient();
      if (redisClient) {
        const keys = await (redisClient as any).keys('test:*');
        if (keys.length > 0) {
          await (redisClient as any).del(keys);
        }
        console.log('✅ Test Redis cache cleared successfully');
      }
    } catch (error) {
      console.error('❌ Error clearing test Redis cache:', error);
    }
  }

  async trackKey(key: string): Promise<void> {
    try {
      const redisClient = this.redis.getClient();
      if(redisClient) {
        await (redisClient as any).sadd('test:keys', key);
      }
    } catch (error) {
      // Silent fail
    }
  }
}

/**
 * Complete test environment manager
 */
export class TestEnvironmentManager {
  private dbManager: TestDatabaseManager;
  private redisManager: TestRedisManager;

  constructor(private prisma: PrismaService, private redis: RedisService) {
    this.dbManager = new TestDatabaseManager(prisma);
    this.redisManager = new TestRedisManager(redis);
  }

  async setupTestEnvironment(): Promise<void> {
    console.log('🚀 Setting up test environment...');
    await this.dbManager.resetTestDatabase();
    await this.redisManager.clearTestCache();
    console.log('✅ Test environment ready');
  }

  async cleanupTestEnvironment(): Promise<void> {
    console.log('🧹 Cleaning up test environment...');
    await this.dbManager.cleanupTestData();
    await this.redisManager.clearTestCache();
    await this.prisma.$disconnect();
    const redisClient = this.redis.getClient();
    if (redisClient) {
      await redisClient.quit();
    }
    console.log('✅ Test environment cleaned');
  }

  getDatabaseManager(): TestDatabaseManager {
    return this.dbManager;
  }

  getRedisManager(): TestRedisManager {
    return this.redisManager;
  }
}

/**
 * Jest setup and teardown hooks
 */
export function setupTestHooks(environmentManager: TestEnvironmentManager) {
  beforeAll(async () => {
    await environmentManager.setupTestEnvironment();
  });

  afterAll(async () => {
    await environmentManager.cleanupTestEnvironment();
  });

  beforeEach(async () => {
    await environmentManager.getRedisManager().clearTestCache();
  });
}

/**
 * Test database transaction wrapper
 */
export async function withTestTransaction<T>(
  prisma: PrismaService,
  callback: (tx: any) => Promise<T>
): Promise<T> {
  return await prisma.$transaction(async (tx) => {
    try {
      const result = await callback(tx);
      // We throw a custom error to ensure rollback.
      throw { rollback: true, result };
    } catch (error) {
      if (error.rollback) {
        // This is expected, do nothing. The transaction is rolled back.
        return error.result;
      }
      // Re-throw other errors
      throw error;
    }
  });
}
