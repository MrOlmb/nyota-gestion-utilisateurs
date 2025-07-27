import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { HierarchyController } from './hierarchy.controller';
import { HierarchyService } from './hierarchy.service';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import { PermissionCheckerService } from '../security/permissions/permission-checker.service';
import { RLSFilterService } from '../security/filters/rls-filter.service';
import { SecurityContextService } from '../security/security-context.service';

@Module({
  controllers: [UsersController, HierarchyController],
  providers: [
    UsersService,
    HierarchyService,
    PrismaService,
    RedisService,
    PermissionCheckerService,
    RLSFilterService,
    SecurityContextService,
  ],
  exports: [UsersService, HierarchyService],
})
export class UsersModule {}