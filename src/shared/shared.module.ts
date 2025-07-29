import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';

/**
 * SharedModule - Global module that provides common services
 * 
 * This module is marked as @Global() so its providers are available
 * throughout the application without needing to import this module
 * in every module that needs these services.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    PrismaService,
    RedisService,
  ],
  exports: [
    PrismaService,
    RedisService,
  ],
})
export class SharedModule {}