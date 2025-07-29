import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { HierarchyController } from './hierarchy.controller';
import { HierarchyService } from './hierarchy.service';
import { PermissionCheckerService } from '../security/permissions/permission-checker.service';
import { RLSFilterService } from '../security/filters/rls-filter.service';
import { SecurityContextService } from '../security/security-context.service';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [UsersController, HierarchyController],
  providers: [
    UsersService,
    HierarchyService,
    PermissionCheckerService,
    RLSFilterService,
    SecurityContextService,
  ],
  exports: [UsersService, HierarchyService],
})
export class UsersModule {}