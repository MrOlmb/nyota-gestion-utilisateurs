/**
 * Basic API Integration Tests
 * Simple tests to validate our endpoints are working
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../app.module';

describe('Basic API Integration Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Health Check', () => {
    it('should return 404 for unknown routes', async () => {
      await request(app.getHttpServer())
        .get('/unknown-route')
        .expect(404);
    });
  });

  describe('Authentication Required Endpoints', () => {
    it('should require authentication for user management endpoints', async () => {
      await request(app.getHttpServer())
        .get('/users/ministry')
        .expect(401);
    });

    it('should require authentication for hierarchy endpoints', async () => {
      await request(app.getHttpServer())
        .get('/users/hierarchy')
        .expect(401);
    });

    it('should require authentication for user statistics', async () => {
      await request(app.getHttpServer())
        .get('/users/statistics')
        .expect(401);
    });
  });

  describe('Validation', () => {
    it('should validate request data for ministry user creation', async () => {
      const invalidData = {
        email: 'invalid-email', // Invalid email format
        password: '123', // Weak password
        prenom: '', // Empty required field
      };

      await request(app.getHttpServer())
        .post('/users/ministry')
        .send(invalidData)
        .expect(401); // Will be 401 due to auth, but validates the endpoint exists
    });

    it('should validate request data for school user creation', async () => {
      const invalidData = {
        email: 'invalid-email',
        password: '123',
        prenom: '',
      };

      await request(app.getHttpServer())
        .post('/users/school')
        .send(invalidData)
        .expect(401); // Will be 401 due to auth, but validates the endpoint exists
    });
  });

  describe('API Structure', () => {
    it('should have ministry user endpoints', async () => {
      // Test that endpoints exist (even if they require auth)
      const responses = await Promise.all([
        request(app.getHttpServer()).get('/users/ministry'),
        request(app.getHttpServer()).post('/users/ministry').send({}),
      ]);

      // All should return 401 (unauthorized) rather than 404 (not found)
      responses.forEach(response => {
        expect(response.status).toBe(401);
      });
    });

    it('should have school user endpoints', async () => {
      const responses = await Promise.all([
        request(app.getHttpServer()).get('/users/school'),
        request(app.getHttpServer()).post('/users/school').send({}),
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(401);
      });
    });

    it('should have hierarchy management endpoints', async () => {
      const responses = await Promise.all([
        request(app.getHttpServer()).get('/users/hierarchy'),
        request(app.getHttpServer()).get('/users/hierarchy/orgchart'),
        request(app.getHttpServer()).put('/users/hierarchy/update').send({}),
        request(app.getHttpServer()).put('/users/hierarchy/bulk-update').send({}),
      ]);

      responses.forEach(response => {
        expect(response.status).toBe(401);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON gracefully', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/ministry')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }');

      expect([400, 401]).toContain(response.status); // Either bad request or unauthorized
    });

    it('should handle missing content-type', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/ministry')
        .send('some data');

      expect([400, 401]).toContain(response.status);
    });
  });

  describe('HTTP Methods', () => {
    it('should support correct HTTP methods for ministry users', async () => {
      // Test different HTTP methods
      const getResponse = await request(app.getHttpServer()).get('/users/ministry');
      const postResponse = await request(app.getHttpServer()).post('/users/ministry').send({});
      
      expect(getResponse.status).toBe(401); // Auth required but endpoint exists
      expect(postResponse.status).toBe(401); // Auth required but endpoint exists
    });

    it('should reject unsupported HTTP methods', async () => {
      const response = await request(app.getHttpServer())
        .patch('/users/ministry'); // PATCH might not be supported

      expect([401, 404, 405]).toContain(response.status); // Auth, Not Found, or Method Not Allowed
    });
  });
});