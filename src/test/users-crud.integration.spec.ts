/**
 * Integration tests for User Management CRUD operations
 * Tests both Ministry and School user operations with security integration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CreateMinistryUserDto, CreateSchoolUserDto } from '../users/dto';

describe('Users CRUD Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let authToken: string;
  // Test data
  const testMinistryUser: CreateMinistryUserDto = {
    email: 'test.ministry@education.cg',
    password: 'TestPassword123!',
    prenom: 'Jean',
    nom: 'Ministre',
    typeUtilisateur: 'DIRECTEUR',
    titre: 'Directeur de Test',
    structureId: undefined,
    managerId: undefined,
    departementGeoId: undefined,
    securityGroupIds: []
  };

  const testSchoolUser: CreateSchoolUserDto = {
    email: 'test.school@education.cg',
    password: 'TestPassword123!',
    prenom: 'Marie',
    nom: 'Professeur',
    typeUtilisateur: 'ENSEIGNANT',
    matricule: 'TEST001',
    dateNaissance: '1990-01-01',
    classe: '6ème A',
    matierePrincipale: 'Mathématiques',
    etablissementId: 'dummy-etablissement-id',
    securityGroupIds: []
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    authService = moduleFixture.get<AuthService>(AuthService);

    await app.init();

    // Create a test admin user for authentication
    await setupTestData();
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();
    await app.close();
  });

  async function setupTestData() {
    // Create a test super admin user for authentication
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('AdminPassword123!', 10);
    
    const adminUser = await prisma.userMinistry.create({
      data: {
        email: 'admin.test@education.cg',
        motDePasse: hashedPassword,
        prenom: 'Admin',
        nom: 'Test',
        typeUtilisateur: 'DIRECTEUR',
        estActif: true,
        creeLe: new Date(),
        modifieLe: new Date()
      }
    });

    // Get auth token
    const loginResult = await authService.login('admin.test@education.cg', 'AdminPassword123!');
    authToken = loginResult.accessToken;
  }

  async function cleanupTestData() {
    // Delete test users
    await prisma.userMinistry.deleteMany({
      where: {
        email: {
          in: ['admin.test@education.cg', 'test.ministry@education.cg']
        }
      }
    });

    await prisma.userSchool.deleteMany({
      where: {
        email: {
          in: ['test.school@education.cg']
        }
      }
    });
  }

  describe('Ministry User CRUD Operations', () => {
    let ministryUserId: string;

    describe('POST /users/ministry', () => {
      it('should create a new ministry user', async () => {
        const response = await request(app.getHttpServer())
          .post('/users/ministry')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testMinistryUser)
          .expect(201);

        expect(response.body).toMatchObject({
          email: testMinistryUser.email,
          prenom: testMinistryUser.prenom,
          nom: testMinistryUser.nom,
          typeUtilisateur: testMinistryUser.typeUtilisateur,
          titre: testMinistryUser.titre,
          estActif: true
        });

        expect(response.body.id).toBeDefined();
        expect(response.body.motDePasse).toBeUndefined(); // Password should not be returned

        ministryUserId = response.body.id;
      });

      it('should reject duplicate email', async () => {
        await request(app.getHttpServer())
          .post('/users/ministry')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testMinistryUser)
          .expect(409); // Conflict
      });

      it('should reject invalid email format', async () => {
        const invalidUser = { ...testMinistryUser, email: 'invalid-email' };
        
        await request(app.getHttpServer())
          .post('/users/ministry')
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidUser)
          .expect(400);
      });

      it('should reject weak password', async () => {
        const weakPasswordUser = { 
          ...testMinistryUser, 
          email: 'weak@education.cg',
          password: '123' 
        };
        
        await request(app.getHttpServer())
          .post('/users/ministry')
          .set('Authorization', `Bearer ${authToken}`)
          .send(weakPasswordUser)
          .expect(400);
      });
    });

    describe('GET /users/ministry', () => {
      it('should retrieve ministry users with pagination', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/ministry?page=1&limit=10')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('users');
        expect(response.body).toHaveProperty('pagination');
        expect(Array.isArray(response.body.users)).toBe(true);
        expect(response.body.pagination).toMatchObject({
          page: 1,
          limit: 10,
          total: expect.any(Number),
          totalPages: expect.any(Number)
        });
      });

      it('should filter users by search term', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/ministry?search=Jean')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.users.length).toBeGreaterThan(0);
        expect(response.body.users[0]).toMatchObject({
          prenom: 'Jean'
        });
      });

      it('should filter users by type', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/ministry?typeUtilisateur=DIRECTEUR')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        response.body.users.forEach((user: any) => {
          expect(user.typeUtilisateur).toBe('DIRECTEUR');
        });
      });
    });

    describe('GET /users/ministry/:id', () => {
      it('should retrieve a specific ministry user', async () => {
        const response = await request(app.getHttpServer())
          .get(`/users/ministry/${ministryUserId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toMatchObject({
          id: ministryUserId,
          email: testMinistryUser.email,
          prenom: testMinistryUser.prenom,
          nom: testMinistryUser.nom,
          typeUtilisateur: testMinistryUser.typeUtilisateur
        });
      });

      it('should return 404 for non-existent user', async () => {
        const fakeId = '123e4567-e89b-12d3-a456-426614174000';
        await request(app.getHttpServer())
          .get(`/users/ministry/${fakeId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });

    describe('PUT /users/ministry/:id', () => {
      it('should update ministry user', async () => {
        const updateData = {
          prenom: 'Jean-Updated',
          titre: 'Directeur Principal'
        };

        const response = await request(app.getHttpServer())
          .put(`/users/ministry/${ministryUserId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject({
          id: ministryUserId,
          prenom: updateData.prenom,
          titre: updateData.titre
        });
      });

      it('should reject invalid updates', async () => {
        const invalidUpdate = {
          email: 'invalid-email-format'
        };

        await request(app.getHttpServer())
          .put(`/users/ministry/${ministryUserId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(invalidUpdate)
          .expect(400);
      });
    });

    describe('DELETE /users/ministry/:id', () => {
      it('should soft delete ministry user', async () => {
        await request(app.getHttpServer())
          .delete(`/users/ministry/${ministryUserId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Verify user is soft deleted (estActif = false)
        const deletedUser = await prisma.userMinistry.findUnique({
          where: { id: ministryUserId }
        });

        expect(deletedUser?.estActif).toBe(false);
      });

      it('should return 404 for already deleted user', async () => {
        await request(app.getHttpServer())
          .delete(`/users/ministry/${ministryUserId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      });
    });
  });

  describe('School User CRUD Operations', () => {
    let schoolUserId: string;

    describe('POST /users/school', () => {
      it('should create a new school user', async () => {
        const response = await request(app.getHttpServer())
          .post('/users/school')
          .set('Authorization', `Bearer ${authToken}`)
          .send(testSchoolUser)
          .expect(201);

        expect(response.body).toMatchObject({
          email: testSchoolUser.email,
          prenom: testSchoolUser.prenom,
          nom: testSchoolUser.nom,
          typeUtilisateur: testSchoolUser.typeUtilisateur,
          matricule: testSchoolUser.matricule,
          classe: testSchoolUser.classe,
          matierePrincipale: testSchoolUser.matierePrincipale,
          estActif: true
        });

        schoolUserId = response.body.id;
      });
    });

    describe('GET /users/school', () => {
      it('should retrieve school users with filters', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/school?typeUtilisateur=ENSEIGNANT')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.users.length).toBeGreaterThan(0);
        response.body.users.forEach((user: any) => {
          expect(user.typeUtilisateur).toBe('ENSEIGNANT');
        });
      });

      it('should filter by class', async () => {
        const response = await request(app.getHttpServer())
          .get('/users/school?classe=6ème A')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        response.body.users.forEach((user: any) => {
          expect(user.classe).toBe('6ème A');
        });
      });
    });

    describe('PUT /users/school/:id', () => {
      it('should update school user', async () => {
        const updateData = {
          classe: '5ème A',
          matierePrincipale: 'Physique'
        };

        const response = await request(app.getHttpServer())
          .put(`/users/school/${schoolUserId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toMatchObject({
          id: schoolUserId,
          classe: updateData.classe,
          matierePrincipale: updateData.matierePrincipale
        });
      });
    });

    describe('DELETE /users/school/:id', () => {
      it('should soft delete school user', async () => {
        await request(app.getHttpServer())
          .delete(`/users/school/${schoolUserId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        // Verify soft deletion
        const deletedUser = await prisma.userSchool.findUnique({
          where: { id: schoolUserId }
        });

        expect(deletedUser?.estActif).toBe(false);
      });
    });
  });

  describe('Authentication & Authorization', () => {
    it('should reject requests without auth token', async () => {
      await request(app.getHttpServer())
        .get('/users/ministry')
        .expect(401);
    });

    it('should reject requests with invalid token', async () => {
      await request(app.getHttpServer())
        .get('/users/ministry')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('User Statistics', () => {
    it('should return user statistics', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/statistics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('ministry');
      expect(response.body).toHaveProperty('school');
      expect(response.body.ministry).toHaveProperty('total');
      expect(response.body.ministry).toHaveProperty('active');
      expect(response.body.school).toHaveProperty('total');
      expect(response.body.school).toHaveProperty('active');
    });
  });
});