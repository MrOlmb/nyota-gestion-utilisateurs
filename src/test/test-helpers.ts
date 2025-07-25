/**
 * Test helpers and utilities for NYOTA security testing
 */

import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { SecurityContextCache } from '../security/security-context.service';
import { UserMinistryType, UserSchoolType, ObjectScope, RuleType } from '@prisma/client';

/**
 * JWT token generators for testing
 */
export class TestTokenGenerator {
  constructor(private jwtService: JwtService) {}

  generateMinistryToken(userId: string = 'ministry-user-2', userType: UserMinistryType = UserMinistryType.DIRECTEUR) {
    return this.jwtService.sign({
      sub: userId,
      email: `user-${userId}@ministere.cg`,
      type: userType,
      scope: 'MINISTRY',
      structureId: 'structure-1',
    });
  }

  generateSchoolToken(userId: string = 'school-user-1', etablissementId: string = 'etablissement-1') {
    return this.jwtService.sign({
      sub: userId,
      email: `user-${userId}@ecole.cg`,
      type: UserSchoolType.DIRECTEUR,
      scope: 'SCHOOL',
      etablissementId,
    });
  }
}

/**
 * Mock Express request and response objects
 */
export function createMockHttpObjects(overrides: any = {}) {
  const req = {
    headers: {
      'user-agent': 'jest-test',
      'x-forwarded-for': '127.0.0.1',
    },
    body: {},
    user: null,
    ...overrides.req,
  };

  const res = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
    ...overrides.res,
  };

  return { req, res };
}
