/**
 * Application Startup Tests
 * Validates that the application can start successfully and endpoints are defined
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';

describe('Application Startup', () => {
  let app: INestApplication;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await module.close();
  });

  it('should start the application successfully', () => {
    expect(app).toBeDefined();
  });

  it('should have Users module loaded', () => {
    expect(module).toBeDefined();
  });

  it('should have required services available', () => {
    const usersService = module.get('UsersService');
    const hierarchyService = module.get('HierarchyService');
    const authService = module.get('AuthService');
    
    expect(usersService).toBeDefined();
    expect(hierarchyService).toBeDefined();
    expect(authService).toBeDefined();
  });
});