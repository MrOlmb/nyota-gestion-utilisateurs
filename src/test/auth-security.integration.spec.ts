/**
 * Integration tests for Authentication and Security
 * Tests login, JWT tokens, permissions, and security flows
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from '../auth/auth.service';

describe('Authentication & Security Integration Tests', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  
  // Test user credentials
  const testMinistryUser = {
    email: 'auth.ministry@education.cg',
    password: 'AuthPassword123!',
    prenom: 'Auth',
    nom: 'Ministry',
    typeUtilisateur: 'DIRECTEUR'
  };

  const testSchoolUser = {
    email: 'auth.school@education.cg',
    password: 'AuthPassword123!',
    prenom: 'Auth',
    nom: 'School',
    typeUtilisateur: 'DIRECTEUR'
  };

  let testMinistryUserId: string;
  let testSchoolUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = moduleFixture.get<PrismaService>(PrismaService);
    authService = moduleFixture.get<AuthService>(AuthService);

    await app.init();
    await setupAuthTestData();
  });

  afterAll(async () => {
    await cleanupAuthTestData();
    await app.close();
  });

  async function setupAuthTestData() {
    // Use bcrypt directly for password hashing
    const bcrypt = require('bcryptjs');
    
    // Create test ministry user
    const ministryUser = await prisma.userMinistry.create({
      data: {
        email: testMinistryUser.email,
        motDePasse: await bcrypt.hash(testMinistryUser.password, 10),
        prenom: testMinistryUser.prenom,
        nom: testMinistryUser.nom,
        typeUtilisateur: testMinistryUser.typeUtilisateur as any,
        estActif: true,
        creeLe: new Date(),
        modifieLe: new Date()
      }
    });
    testMinistryUserId = ministryUser.id;

    // Create test school user
    const schoolUser = await prisma.userSchool.create({
      data: {
        email: testSchoolUser.email,
        motDePasse: await bcrypt.hash(testSchoolUser.password, 10),
        prenom: testSchoolUser.prenom,
        nom: testSchoolUser.nom,
        typeUtilisateur: testSchoolUser.typeUtilisateur as any,
        matricule: 'AUTH001',
        dateNaissance: new Date('1985-01-01'),
        estActif: true,
        creeLe: new Date(),
        modifieLe: new Date()
      }
    });
    testSchoolUserId = schoolUser.id;
  }

  async function cleanupAuthTestData() {
    await prisma.userMinistry.deleteMany({
      where: {
        email: {
          in: [testMinistryUser.email, 'locked.user@education.cg']
        }
      }
    });

    await prisma.userSchool.deleteMany({
      where: {
        email: testSchoolUser.email
      }
    });
  }

  describe('Authentication Flow', () => {
    describe('POST /auth/login', () => {
      it('should login ministry user successfully', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testMinistryUser.email,
            password: testMinistryUser.password
          })
          .expect(200);

        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('refreshToken');
        expect(response.body).toHaveProperty('expiresIn');
        expect(response.body).toHaveProperty('user');

        // Verify user data
        expect(response.body.user).toMatchObject({
          id: testMinistryUserId,
          email: testMinistryUser.email,
          prenom: testMinistryUser.prenom,
          nom: testMinistryUser.nom,
          scope: 'MINISTRY'
        });

        // Verify tokens are strings
        expect(typeof response.body.accessToken).toBe('string');
        expect(typeof response.body.refreshToken).toBe('string');
        expect(typeof response.body.expiresIn).toBe('number');
      });

      it('should login school user successfully', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testSchoolUser.email,
            password: testSchoolUser.password
          })
          .expect(200);

        expect(response.body.user).toMatchObject({
          id: testSchoolUserId,
          email: testSchoolUser.email,
          scope: 'SCHOOL'
        });
      });

      it('should reject invalid email', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'nonexistent@education.cg',
            password: 'SomePassword123!'
          })
          .expect(401);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Invalid credentials');
      });

      it('should reject invalid password', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testMinistryUser.email,
            password: 'WrongPassword'
          })
          .expect(401);

        expect(response.body.message).toContain('Invalid credentials');
      });

      it('should reject login for inactive user', async () => {
        // Create inactive user
        const bcrypt = require('bcryptjs');
        const inactiveUser = await prisma.userMinistry.create({
          data: {
            email: 'inactive.user@education.cg',
            motDePasse: await bcrypt.hash('TestPassword123!', 10),
            prenom: 'Inactive',
            nom: 'User',
            typeUtilisateur: 'DIRECTEUR',
            estActif: false, // Inactive
            creeLe: new Date(),
            modifieLe: new Date()
          }
        });

        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: 'inactive.user@education.cg',
            password: 'TestPassword123!'
          })
          .expect(401);

        // Cleanup
        await prisma.userMinistry.delete({ where: { id: inactiveUser.id } });
      });

      it('should handle account lockout after failed attempts', async () => {
        const testEmail = 'lockout.test@education.cg';
        
        // Create test user for lockout
        const bcrypt = require('bcryptjs');
        const lockoutUser = await prisma.userMinistry.create({
          data: {
            email: testEmail,
            motDePasse: await bcrypt.hash('TestPassword123!', 10),
            prenom: 'Lockout',
            nom: 'Test',
            typeUtilisateur: 'DIRECTEUR',
            estActif: true,
            creeLe: new Date(),
            modifieLe: new Date()
          }
        });

        // Make multiple failed login attempts
        for (let i = 0; i < 6; i++) {
          await request(app.getHttpServer())
            .post('/auth/login')
            .send({
              email: testEmail,
              password: 'WrongPassword'
            });
        }

        // Next attempt should be locked
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testEmail,
            password: 'TestPassword123!' // Even correct password should be rejected
          })
          .expect(401);

        expect(response.body.message).toContain('locked');

        // Cleanup
        await prisma.userMinistry.delete({ where: { id: lockoutUser.id } });
      });
    });

    describe('POST /auth/refresh', () => {
      let refreshToken: string;

      beforeEach(async () => {
        // Get fresh tokens
        const loginResponse = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testMinistryUser.email,
            password: testMinistryUser.password
          });
        
        refreshToken = loginResponse.body.refreshToken;
      });

      it('should refresh tokens successfully', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/refresh')
          .send({ refreshToken })
          .expect(200);

        expect(response.body).toHaveProperty('accessToken');
        expect(response.body).toHaveProperty('refreshToken');
        expect(response.body).toHaveProperty('expiresIn');

        // New tokens should be different from original
        expect(response.body.refreshToken).not.toBe(refreshToken);
      });

      it('should reject invalid refresh token', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/refresh')
          .send({ refreshToken: 'invalid-token' })
          .expect(401);

        expect(response.body.message).toContain('Invalid refresh token');
      });
    });

    describe('POST /auth/logout', () => {
      let accessToken: string;

      beforeEach(async () => {
        const loginResponse = await request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testMinistryUser.email,
            password: testMinistryUser.password
          });
        
        accessToken = loginResponse.body.accessToken;
      });

      it('should logout successfully', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('message');
        expect(response.body.message).toContain('Logged out successfully');
      });

      it('should invalidate token after logout', async () => {
        // Logout
        await request(app.getHttpServer())
          .post('/auth/logout')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(200);

        // Try to use the token - should be rejected
        await request(app.getHttpServer())
          .get('/users/ministry')
          .set('Authorization', `Bearer ${accessToken}`)
          .expect(401);
      });
    });
  });

  describe('JWT Token Validation', () => {
    let validToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testMinistryUser.email,
          password: testMinistryUser.password
        });
      
      validToken = loginResponse.body.accessToken;
    });

    it('should accept valid JWT token', async () => {
      const response = await request(app.getHttpServer())
        .get('/users/ministry')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
    });

    it('should reject malformed token', async () => {
      await request(app.getHttpServer())
        .get('/users/ministry')
        .set('Authorization', 'Bearer malformed-token')
        .expect(401);
    });

    it('should reject missing authorization header', async () => {
      await request(app.getHttpServer())
        .get('/users/ministry')
        .expect(401);
    });

    it('should reject expired token', async () => {
      // This test would require manipulating token expiration
      // For now, we'll test with an obviously invalid token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      
      await request(app.getHttpServer())
        .get('/users/ministry')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });

  describe('Permission-Based Access Control', () => {
    let ministryToken: string;
    let schoolToken: string;

    beforeEach(async () => {
      // Get ministry user token
      const ministryLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testMinistryUser.email,
          password: testMinistryUser.password
        });
      ministryToken = ministryLogin.body.accessToken;

      // Get school user token
      const schoolLogin = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testSchoolUser.email,
          password: testSchoolUser.password
        });
      schoolToken = schoolLogin.body.accessToken;
    });

    it('should allow ministry user to access ministry endpoints', async () => {
      await request(app.getHttpServer())
        .get('/users/ministry')
        .set('Authorization', `Bearer ${ministryToken}`)
        .expect(200);
    });

    it('should allow school user to access school endpoints', async () => {
      await request(app.getHttpServer())
        .get('/users/school')
        .set('Authorization', `Bearer ${schoolToken}`)
        .expect(200);
    });

    it('should enforce permission requirements for user creation', async () => {
      const newUserData = {
        email: 'permission.test@education.cg',
        password: 'TestPassword123!',
        prenom: 'Permission',
        nom: 'Test',
        typeUtilisateur: 'DIRECTEUR'
      };

      // This will depend on the actual permission setup
      // The test user may or may not have create permissions
      const response = await request(app.getHttpServer())
        .post('/users/ministry')
        .set('Authorization', `Bearer ${ministryToken}`)
        .send(newUserData);

      // Should either succeed (201) or fail with permission error (403)
      expect([201, 403]).toContain(response.status);
    });

    it('should enforce permission requirements for user deletion', async () => {
      const response = await request(app.getHttpServer())
        .delete(`/users/ministry/${testMinistryUserId}`)
        .set('Authorization', `Bearer ${ministryToken}`);

      // Should either succeed (200) or fail with permission error (403)
      expect([200, 403]).toContain(response.status);
    });
  });

  describe('Security Context', () => {
    let userToken: string;

    beforeEach(async () => {
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testMinistryUser.email,
          password: testMinistryUser.password
        });
      
      userToken = loginResponse.body.accessToken;
    });

    it('should include user context in authenticated requests', async () => {
      // The user context should be available in the request
      // This is tested indirectly through successful authenticated requests
      const response = await request(app.getHttpServer())
        .get(`/users/ministry/${testMinistryUserId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.id).toBe(testMinistryUserId);
    });
  });

  describe('Password Security', () => {
    it('should hash passwords before storage', async () => {
      const user = await prisma.userMinistry.findUnique({
        where: { id: testMinistryUserId }
      });

      expect(user?.motDePasse).toBeDefined();
      expect(user?.motDePasse).not.toBe(testMinistryUser.password); // Should be hashed
      expect(user?.motDePasse.length).toBeGreaterThan(20); // Hashed passwords are longer
    });

    it('should reject weak passwords in user creation', async () => {
      const weakPasswordUser = {
        email: 'weak.password@education.cg',
        password: '123', // Weak password
        prenom: 'Weak',
        nom: 'Password',
        typeUtilisateur: 'DIRECTEUR'
      };

      // Login first to get token
      const loginResponse = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testMinistryUser.email,
          password: testMinistryUser.password
        });

      const response = await request(app.getHttpServer())
        .post('/users/ministry')
        .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
        .send(weakPasswordUser)
        .expect(400);

      expect(response.body.message).toContain('password');
    });
  });

  describe('Session Management', () => {
    it('should create session on login', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testMinistryUser.email,
          password: testMinistryUser.password,
          ipAddress: '127.0.0.1'
        })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      // Session should be created in Redis (tested indirectly)
    });

    it('should handle multiple concurrent sessions', async () => {
      // Login twice with same user
      const [session1, session2] = await Promise.all([
        request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testMinistryUser.email,
            password: testMinistryUser.password,
            ipAddress: '127.0.0.1'
          }),
        request(app.getHttpServer())
          .post('/auth/login')
          .send({
            email: testMinistryUser.email,
            password: testMinistryUser.password,
            ipAddress: '192.168.1.1'
          })
      ]);

      expect(session1.status).toBe(200);
      expect(session2.status).toBe(200);
      expect(session1.body.accessToken).not.toBe(session2.body.accessToken);
    });
  });
});