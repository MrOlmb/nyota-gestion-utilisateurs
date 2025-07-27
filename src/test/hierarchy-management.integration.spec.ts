/**
 * Integration tests for Hierarchy Management
 * Tests organizational hierarchy operations, org charts, and bulk updates
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../auth/auth.service';

describe('Hierarchy Management Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let authToken: string;
  
  // Test user IDs
  let directorId: string;
  let managerId: string;
  let subordinate1Id: string;
  let subordinate2Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    authService = moduleFixture.get<AuthService>(AuthService);

    await app.init();
    await setupHierarchyTestData();
  });

  afterAll(async () => {
    await cleanupHierarchyTestData();
    await app.close();
  });

  async function setupHierarchyTestData() {
    // Use bcrypt directly for password hashing
    const bcrypt = require('bcryptjs');
    
    // Create a test admin user for authentication
    const adminUser = await prisma.userMinistry.create({
      data: {
        email: 'hierarchy.admin@education.cg',
        motDePasse: await bcrypt.hash('AdminPassword123!', 10),
        prenom: 'Admin',
        nom: 'Hierarchy',
        typeUtilisateur: 'SUPER_ADMIN',
        estActif: true,
        creeLe: new Date(),
        modifieLe: new Date()
      }
    });

    // Get auth token
    const loginResult = await authService.login('hierarchy.admin@education.cg', 'AdminPassword123!');
    authToken = loginResult.accessToken;

    // Create hierarchy structure: Director -> Manager -> Subordinates
    
    // 1. Director (top level)
    const director = await prisma.userMinistry.create({
      data: {
        email: 'director@education.cg',
        motDePasse: await bcrypt.hash('TestPassword123!', 10),
        prenom: 'Jean',
        nom: 'Directeur',
        typeUtilisateur: 'DIRECTEUR',
        titre: 'Directeur Général',
        estActif: true,
        creeLe: new Date(),
        modifieLe: new Date()
      }
    });
    directorId = director.id;

    // 2. Manager (reports to director)
    const manager = await prisma.userMinistry.create({
      data: {
        email: 'manager@education.cg',
        motDePasse: await bcrypt.hash('TestPassword123!', 10),
        prenom: 'Marie',
        nom: 'Manager',
        typeUtilisateur: 'MANAGER',
        titre: 'Chef de Département',
        managerId: directorId,
        estActif: true,
        creeLe: new Date(),
        modifieLe: new Date()
      }
    });
    managerId = manager.id;

    // 3. Subordinates (report to manager)
    const subordinate1 = await prisma.userMinistry.create({
      data: {
        email: 'subordinate1@education.cg',
        motDePasse: await bcrypt.hash('TestPassword123!', 10),
        prenom: 'Paul',
        nom: 'Subordinate1',
        typeUtilisateur: 'CHEF_DEPARTEMENT',
        titre: 'Chef Section A',
        managerId: managerId,
        estActif: true,
        creeLe: new Date(),
        modifieLe: new Date()
      }
    });
    subordinate1Id = subordinate1.id;

    const subordinate2 = await prisma.userMinistry.create({
      data: {
        email: 'subordinate2@education.cg',
        motDePasse: await bcrypt.hash('TestPassword123!', 10),
        prenom: 'Sophie',
        nom: 'Subordinate2',
        typeUtilisateur: 'CHEF_DEPARTEMENT',
        titre: 'Chef Section B',
        managerId: managerId,
        estActif: true,
        creeLe: new Date(),
        modifieLe: new Date()
      }
    });
    subordinate2Id = subordinate2.id;
  }

  async function cleanupHierarchyTestData() {
    await prisma.userMinistry.deleteMany({
      where: {
        email: {
          in: [
            'hierarchy.admin@education.cg',
            'director@education.cg',
            'manager@education.cg',
            'subordinate1@education.cg',
            'subordinate2@education.cg'
          ]
        }
      }
    });
  }

  describe('Hierarchy Retrieval', () => {
    describe('GET /users/hierarchy', () => {
      it('should get hierarchy starting from director', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/hierarchy?rootUserId=${directorId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('rootNode');
        expect(response.body).toHaveProperty('stats');
        
        const rootNode = response.body.rootNode;
        expect(rootNode.id).toBe(directorId);
        expect(rootNode.subordinates).toHaveLength(1); // Should have manager as subordinate
        expect(rootNode.subordinates[0].id).toBe(managerId);
        expect(rootNode.subordinates[0].subordinates).toHaveLength(2); // Manager should have 2 subordinates
      });

      it('should get hierarchy with depth limit', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/hierarchy?rootUserId=${directorId}&maxDepth=2`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const rootNode = response.body.rootNode;
        expect(rootNode.subordinates[0].subordinates).toHaveLength(2);
      });

      it('should include user data when requested', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/hierarchy?rootUserId=${directorId}&includeUserData=true`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const rootNode = response.body.rootNode;
        expect(rootNode).toHaveProperty('prenom');
        expect(rootNode).toHaveProperty('nom');
        expect(rootNode).toHaveProperty('email');
        expect(rootNode).toHaveProperty('typeUtilisateur');
      });

      it('should return hierarchy statistics', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/hierarchy?rootUserId=${directorId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const stats = response.body.stats;
        expect(stats).toHaveProperty('totalUsers');
        expect(stats).toHaveProperty('activeUsers');
        expect(stats).toHaveProperty('maxDepth');
        expect(stats).toHaveProperty('byUserType');
        
        expect(stats.totalUsers).toBe(3); // Director + Manager + 2 Subordinates = 4, but hierarchy starts from director
        expect(stats.maxDepth).toBe(2); // Director -> Manager -> Subordinates
      });
    });

    describe('GET /users/hierarchy/orgchart', () => {
      it('should generate organizational chart', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/hierarchy/orgchart?rootUserId=${directorId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('orgChart');
        
        const orgChart = response.body.orgChart;
        expect(orgChart.id).toBe(directorId);
        expect(orgChart).toHaveProperty('name');
        expect(orgChart).toHaveProperty('title');
        expect(orgChart).toHaveProperty('children');
        expect(orgChart.children).toHaveLength(1);
        
        // Check manager node
        const managerNode = orgChart.children[0];
        expect(managerNode.id).toBe(managerId);
        expect(managerNode.children).toHaveLength(2);
      });

      it('should include metadata in org chart', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/hierarchy/orgchart?rootUserId=${directorId}&maxDepth=3`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const orgChart = response.body.orgChart;
        expect(orgChart).toHaveProperty('metadata');
        expect(orgChart.metadata).toHaveProperty('employeeCount');
      });
    });
  });

  describe('Hierarchy Updates', () => {
    describe('PUT /users/hierarchy/update', () => {
      it('should update user hierarchy', async () => {
        const updateData = {
          userId: subordinate1Id,
          newManagerId: directorId, // Move subordinate1 to report directly to director
          reason: 'Reorganization test'
        };

        const response = await request(app.getHttpServer())
          .put('/users/hierarchy/update')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toHaveProperty('success');
        expect(response.body.success).toBe(true);
        expect(response.body).toHaveProperty('validation');
        expect(response.body.validation.isValid).toBe(true);

        // Verify the update in database
        const updatedUser = await prisma.userMinistry.findUnique({
          where: { id: subordinate1Id }
        });
        expect(updatedUser?.managerId).toBe(directorId);
      });

      it('should prevent circular hierarchy', async () => {
        const updateData = {
          userId: directorId,
          newManagerId: managerId, // Try to make director report to manager (circular)
          reason: 'Invalid circular test'
        };

        const response = await request(app.getHttpServer())
          .put('/users/hierarchy/update')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('circular');
      });

      it('should remove manager (set to null)', async () => {
        const updateData = {
          userId: subordinate2Id,
          newManagerId: null,
          reason: 'Remove manager test'
        };

        const response = await request(app.getHttpServer())
          .put('/users/hierarchy/update')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify in database
        const updatedUser = await prisma.userMinistry.findUnique({
          where: { id: subordinate2Id }
        });
        expect(updatedUser?.managerId).toBeNull();
      });
    });

    describe('PUT /users/hierarchy/bulk-update', () => {
      it('should perform bulk hierarchy updates', async () => {
        const bulkUpdateData = {
          updates: [
            {
              userId: subordinate1Id,
              newManagerId: managerId, // Move back to manager
              reason: 'Bulk update test 1'
            },
            {
              userId: subordinate2Id,
              newManagerId: managerId, // Move back to manager
              reason: 'Bulk update test 2'
            }
          ]
        };

        const response = await request(app.getHttpServer())
          .put('/users/hierarchy/bulk-update')
          .set('Authorization', `Bearer ${authToken}`)
          .send(bulkUpdateData)
          .expect(200);

        expect(response.body).toHaveProperty('successful');
        expect(response.body).toHaveProperty('failed');
        expect(response.body.successful).toHaveLength(2);
        expect(response.body.failed).toHaveLength(0);

        // Verify updates in database
        const [user1, user2] = await Promise.all([
          prisma.userMinistry.findUnique({ where: { id: subordinate1Id } }),
          prisma.userMinistry.findUnique({ where: { id: subordinate2Id } })
        ]);

        expect(user1?.managerId).toBe(managerId);
        expect(user2?.managerId).toBe(managerId);
      });
    });
  });

  describe('Hierarchy Analytics', () => {
    describe('GET /users/hierarchy/analytics/:userId', () => {
      it('should return hierarchy analytics for manager', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/hierarchy/analytics/${managerId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('spanOfControl');
        expect(response.body).toHaveProperty('hierarchyDepth');
        expect(response.body).toHaveProperty('totalSubordinates');
        expect(response.body).toHaveProperty('directReports');
        expect(response.body).toHaveProperty('typeDistribution');
        expect(response.body).toHaveProperty('recommendations');

        expect(response.body.directReports).toBe(2); // Should have 2 direct reports
        expect(response.body.totalSubordinates).toBe(2);
      });

      it('should provide recommendations for large span of control', async () => {
        // This test would be more meaningful with more subordinates
        const response = await request(app.getHttpServer())
          .get(`/users/hierarchy/analytics/${directorId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('recommendations');
        expect(Array.isArray(response.body.recommendations)).toBe(true);
      });
    });
  });

  describe('Hierarchy Validation', () => {
    describe('POST /users/hierarchy/validate', () => {
      it('should validate hierarchy changes', async () => {
        const validationData = {
          userId: subordinate1Id,
          newManagerId: directorId,
          reason: 'Validation test'
        };

        const response = await request(app.getHttpServer())
          .post('/users/hierarchy/validate')
          .set('Authorization', `Bearer ${authToken}`)
          .send(validationData)
          .expect(200);

        expect(response.body).toHaveProperty('isValid');
        expect(response.body).toHaveProperty('errors');
        expect(response.body).toHaveProperty('warnings');
        
        expect(response.body.isValid).toBe(true);
        expect(response.body.errors).toHaveLength(0);
      });

      it('should detect invalid hierarchy changes', async () => {
        const invalidValidationData = {
          userId: managerId,
          newManagerId: subordinate1Id, // Manager reporting to subordinate
          reason: 'Invalid validation test'
        };

        const response = await request(app.getHttpServer())
          .post('/users/hierarchy/validate')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidValidationData)
          .expect(200);

        expect(response.body.isValid).toBe(false);
        expect(response.body.errors.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Hierarchy Health Check', () => {
    describe('GET /users/hierarchy/health', () => {
      it('should return hierarchy health status', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/hierarchy/health')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('overallHealth');
        expect(response.body).toHaveProperty('issues');
        expect(response.body).toHaveProperty('recommendations');

        expect(['HEALTHY', 'WARNING', 'CRITICAL']).toContain(response.body.overallHealth);
        expect(response.body.issues).toHaveProperty('orphanedUsers');
        expect(response.body.issues).toHaveProperty('circularReferences');
        expect(response.body.issues).toHaveProperty('deepHierarchies');
      });
    });
  });

  describe('Manager Search', () => {
    describe('GET /users/hierarchy/managers/search', () => {
      it('should search available managers', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/hierarchy/managers/search?q=Manager')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('managers');
        expect(Array.isArray(response.body.managers)).toBe(true);
        
        if (response.body.managers.length > 0) {
          const manager = response.body.managers[0];
          expect(manager).toHaveProperty('id');
          expect(manager).toHaveProperty('name');
          expect(manager).toHaveProperty('email');
          expect(manager).toHaveProperty('title');
        }
      });

      it('should exclude specified user from search', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/hierarchy/managers/search?q=&excludeUserId=${managerId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        const managerIds = response.body.managers.map(m => m.id);
        expect(managerIds).not.toContain(managerId);
      });
    });
  });

  describe('Remove Manager', () => {
    describe('DELETE /users/hierarchy/:userId/manager', () => {
      it('should remove manager from user', async () => {
        const response = await request(app.getHttpServer())
          .delete(`/users/hierarchy/${subordinate1Id}/manager`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({ reason: 'Test remove manager' })
          .expect(200);

        expect(response.body).toHaveProperty('success');
        expect(response.body.success).toBe(true);

        // Verify in database
        const updatedUser = await prisma.userMinistry.findUnique({
          where: { id: subordinate1Id }
        });
        expect(updatedUser?.managerId).toBeNull();
      });
    });
  });
});