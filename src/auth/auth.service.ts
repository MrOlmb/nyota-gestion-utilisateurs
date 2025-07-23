import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import * as bcrypt from 'bcrypt';
import { User, Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface LoginResult extends AuthTokens {
  user: Partial<User>;
}

@Injectable()
export class AuthService {
  private readonly MAX_LOGIN_ATTEMPTS: number;
  private readonly LOCK_TIME_MINUTES: number;
  private readonly JWT_SECRET: string;
  private readonly JWT_EXPIRES_IN: string;
  private readonly JWT_REFRESH_SECRET: string;
  private readonly JWT_REFRESH_EXPIRES_IN: string;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private redisService: RedisService,
    private configService: ConfigService,
  ) {
    this.MAX_LOGIN_ATTEMPTS = this.configService.get<number>('MAX_LOGIN_ATTEMPTS', 5);
    this.LOCK_TIME_MINUTES = this.configService.get<number>('LOCK_TIME_MINUTES', 30);
    this.JWT_SECRET = this.configService.get<string>('JWT_SECRET');
    this.JWT_EXPIRES_IN = this.configService.get<string>('JWT_EXPIRES_IN', '15m');
    this.JWT_REFRESH_SECRET = this.configService.get<string>('JWT_REFRESH_SECRET');
    this.JWT_REFRESH_EXPIRES_IN = this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d');
  }

  /**
   * Algorithme de connexion avec protection contre brute-force
   */
  async login(email: string, password: string, ipAddress?: string): Promise<LoginResult> {
    // 1. Vérifier le verrouillage du compte
    const lockKey = `lock:${email}`;
    const isLocked = await this.redisService.get(lockKey);
    
    if (isLocked) {
      throw new UnauthorizedException('Compte verrouillé. Veuillez réessayer plus tard.');
    }

    // 2. Récupérer l'utilisateur avec ses groupes
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userGroups: {
          include: {
            group: {
              include: {
                permissions: {
                  include: {
                    object: true
                  }
                }
              }
            }
          },
          where: {
            isActive: true,
            OR: [
              { expiresAt: null },
              { expiresAt: { gte: new Date() } }
            ]
          }
        },
        establishment: true
      }
    });

    if (!user) {
      await this.incrementLoginAttempts(email);
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // 3. Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    
    if (!isPasswordValid) {
      await this.incrementLoginAttempts(email);
      
      // Vérifier si le compte doit être verrouillé
      if (user.failedLoginAttempts >= this.MAX_LOGIN_ATTEMPTS - 1) {
        await this.lockAccount(user.id, email);
        throw new UnauthorizedException('Compte verrouillé suite à plusieurs tentatives échouées');
      }
      
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // 4. Vérifier si le compte est actif
    if (!user.isActive) {
      throw new UnauthorizedException('Compte désactivé');
    }

    // 5. Réinitialiser les tentatives échouées
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lastLogin: new Date()
      }
    });

    // 6. Générer les tokens JWT
    const tokens = await this.generateTokens(user);

    // 7. Compiler et mettre en cache le contexte de sécurité
    const securityContext = await this.compileSecurityContext(user);
    await this.cacheSecurityContext(user.id, securityContext);

    // 8. Créer la session dans Redis
    await this.createSession(user.id, tokens.accessToken, ipAddress);

    // 9. Enregistrer l'audit
    await this.auditLogin(user.id, ipAddress, true);

    // 10. Retourner le résultat
    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        userType: user.userType,
        establishmentId: user.establishmentId
      }
    };
  }

  /**
   * Algorithme de compilation du contexte de sécurité
   */
  private async compileSecurityContext(user: any): Promise<any> {
    const context = {
      userId: user.id,
      userType: user.userType,
      establishmentId: user.establishmentId,
      permissions: {},
      dataFilters: {},
      uiRules: [],
      hierarchy: null,
      lastUpdated: Date.now()
    };

    // 1. Compiler les permissions par objet métier
    for (const userGroup of user.userGroups) {
      for (const permission of userGroup.group.permissions) {
        const objectName = permission.object.name;
        
        if (!context.permissions[objectName]) {
          context.permissions[objectName] = {
            read: false,
            write: false,
            create: false,
            delete: false,
            approve: false
          };
        }

        // Agrégation des permissions (OR logique)
        context.permissions[objectName].read ||= permission.canRead;
        context.permissions[objectName].write ||= permission.canWrite;
        context.permissions[objectName].create ||= permission.canCreate;
        context.permissions[objectName].delete ||= permission.canDelete;
        context.permissions[objectName].approve ||= permission.canApprove;
      }
    }

    // 2. Compiler les règles de visibilité (RLS)
    const visibilityRules = await this.prisma.visibilityRule.findMany({
      where: {
        groupId: {
          in: user.userGroups.map(ug => ug.groupId)
        },
        isActive: true
      },
      include: {
        object: true
      },
      orderBy: {
        priority: 'desc'
      }
    });

    for (const rule of visibilityRules) {
      const objectName = rule.object.name;
      
      if (!context.dataFilters[objectName]) {
        context.dataFilters[objectName] = [];
      }

      context.dataFilters[objectName].push({
        type: rule.ruleType,
        condition: rule.condition,
        priority: rule.priority
      });
    }

    // 3. Compiler les règles UI
    const uiRules = await this.prisma.uIRule.findMany({
      where: {
        groupId: {
          in: user.userGroups.map(ug => ug.groupId)
        }
      }
    });

    context.uiRules = uiRules.map(rule => ({
      element: rule.elementName,
      type: rule.elementType,
      visible: rule.isVisible,
      enabled: rule.isEnabled,
      conditions: rule.conditions
    }));

    // 4. Calculer la hiérarchie
    if (user.userType === 'MINISTRY_STAFF') {
      context.hierarchy = await this.calculateHierarchy(user.id);
    }

    return context;
  }

  /**
   * Algorithme de calcul de la hiérarchie
   */
  private async calculateHierarchy(userId: string): Promise<any> {
    const hierarchy = {
      managerId: null,
      subordinates: [],
      level: 0
    };

    // Requête récursive pour obtenir toute la hiérarchie
    const result = await this.prisma.$queryRaw`
      WITH RECURSIVE subordinates AS (
        SELECT id, email, first_name, last_name, manager_id, 0 as level
        FROM users
        WHERE id = ${userId}::uuid
        
        UNION ALL
        
        SELECT u.id, u.email, u.first_name, u.last_name, u.manager_id, s.level + 1
        FROM users u
        INNER JOIN subordinates s ON u.manager_id = s.id
        WHERE u.is_active = true
      )
      SELECT * FROM subordinates;
    `;

    // Traiter les résultats
    for (const row of result as any[]) {
      if (row.id === userId) {
        hierarchy.managerId = row.manager_id;
      } else {
        hierarchy.subordinates.push({
          id: row.id,
          email: row.email,
          fullName: `${row.first_name} ${row.last_name}`,
          level: row.level
        });
      }
    }

    return hierarchy;
  }

  /**
   * Gestion des tentatives de connexion échouées
   */
  private async incrementLoginAttempts(email: string): Promise<number> {
    const attemptsKey = `attempts:${email}`;
    const attempts = await this.redisService.increment(attemptsKey);
    
    // Définir l'expiration à 30 minutes
    if (attempts === 1) {
      await this.redisService.expire(attemptsKey, this.LOCK_TIME_MINUTES * 60);
    }
    
    return attempts;
  }

  /**
   * Verrouillage du compte
   */
  private async lockAccount(userId: string, email: string): Promise<void> {
    const lockKey = `lock:${email}`;
    const lockDuration = this.LOCK_TIME_MINUTES * 60;
    
    // Verrouiller dans Redis
    await this.redisService.set(lockKey, '1', lockDuration);
    
    // Mettre à jour la base de données
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        lockedUntil: new Date(Date.now() + lockDuration * 1000)
      }
    });
  }

  /**
   * Cache du contexte de sécurité
   */
  private async cacheSecurityContext(userId: string, context: any): Promise<void> {
    const key = `security:${userId}`;
    const ttl = this.configService.get<number>('CACHE_TTL_PERMISSIONS', 3600);
    
    await this.redisService.set(key, JSON.stringify(context), ttl);
  }

  /**
   * Création de session
   */
  private async createSession(userId: string, token: string, ipAddress?: string): Promise<void> {
    const sessionId = this.generateSessionId();
    const sessionKey = `session:${sessionId}`;
    const userSessionsKey = `user_sessions:${userId}`;
    
    const session = {
      sessionId,
      userId,
      token,
      ipAddress,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };

    // Stocker la session
    await this.redisService.set(
      sessionKey, 
      JSON.stringify(session),
      this.configService.get<number>('SESSION_TTL_SECONDS', 1800)
    );

    // Ajouter à la liste des sessions de l'utilisateur
    await this.redisService.sadd(userSessionsKey, sessionId);
  }

  /**
   * Génération des tokens JWT
   */
  private async generateTokens(user: any): Promise<AuthTokens> {
    const payload = {
      sub: user.id,
      email: user.email,
      type: user.userType,
      establishmentId: user.establishmentId
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.JWT_SECRET,
        expiresIn: this.JWT_EXPIRES_IN
      }),
      this.jwtService.signAsync(payload, {
        secret: this.JWT_REFRESH_SECRET,
        expiresIn: this.JWT_REFRESH_EXPIRES_IN
      })
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900 // 15 minutes en secondes
    };
  }

  /**
   * Audit de connexion
   */
  private async auditLogin(userId: string, ipAddress: string, success: boolean): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
        module: 'AUTH',
        ipAddress,
        createdAt: new Date()
      }
    });
  }

  /**
   * Génération d'ID de session
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}