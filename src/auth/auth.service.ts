import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../cache/redis.service';
import * as bcryptjs from 'bcryptjs';
import {
  UserMinistry,
  UserSchool,
  UserMinistryType,
  UserSchoolType,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

type AuthUser = UserMinistry | UserSchool;

interface UserProfile {
  id: string;
  email: string;
  prenom: string;
  nom: string;
  typeUtilisateur: UserMinistryType | UserSchoolType;
  etablissementId?: string;
  structureId?: string;
  scope: 'MINISTRY' | 'SCHOOL';
}

interface PermissionSet {
  read: boolean;
  write: boolean;
  create: boolean;
  delete: boolean;
  approve: boolean;
}

interface SecurityContext {
  userId: string;
  userScope: 'MINISTRY' | 'SCHOOL';
  userType: UserMinistryType | UserSchoolType;
  etablissementId?: string;
  structureId?: string;
  permissions: { [objectName: string]: PermissionSet };
  visibilityRules: { [table: string]: any };
  uiRules: { [module: string]: any };
  hierarchy?: any;
}

interface LoginResult extends AuthTokens {
  user: UserProfile;
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
    this.MAX_LOGIN_ATTEMPTS = this.configService.get<number>(
      'MAX_LOGIN_ATTEMPTS',
      5,
    );
    this.LOCK_TIME_MINUTES = this.configService.get<number>(
      'LOCK_TIME_MINUTES',
      30,
    );
    this.JWT_SECRET = this.configService.get<string>('JWT_SECRET') || 'default-jwt-secret';
    this.JWT_EXPIRES_IN = this.configService.get<string>(
      'JWT_EXPIRES_IN',
      '15m',
    );
    this.JWT_REFRESH_SECRET =
      this.configService.get<string>('JWT_REFRESH_SECRET') || 'default-refresh-secret';
    this.JWT_REFRESH_EXPIRES_IN = this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    );
  }

  /**
   * Algorithme de connexion avec protection contre brute-force
   * Supporte les deux types d'utilisateurs (Ministry/School)
   */
  async login(
    email: string,
    password: string,
    ipAddress?: string,
  ): Promise<LoginResult> {
    // 1. Vérifier le verrouillage du compte
    const lockKey = `lock:${email}`;
    const isLocked = await this.redisService.get(lockKey);

    if (isLocked) {
      throw new UnauthorizedException(
        'Compte verrouillé. Veuillez réessayer plus tard.',
      );
    }

    // 2. Chercher l'utilisateur dans les deux tables (Ministry puis School)
    let user: AuthUser | null = null;
    let userScope: 'MINISTRY' | 'SCHOOL' = 'MINISTRY';

    // Essayer d'abord dans UserMinistry
    const ministryUser = await this.prisma.userMinistry.findUnique({
      where: { email },
      include: {
        groupesSecurite: {
          include: {
            group: {
              include: {
                permissions: {
                  include: {
                    object: true,
                  },
                },
              },
            },
          },
          where: {
            estActif: true,
            OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
          },
        },
        structure: true,
        departementGeo: true,
      },
    });

    if (ministryUser) {
      user = ministryUser;
      userScope = 'MINISTRY';
    } else {
      // Essayer dans UserSchool
      const schoolUser = await this.prisma.userSchool.findUnique({
        where: { email },
        include: {
          etablissement: true,
          groupesSecurite: {
            include: {
              group: {
                include: {
                  permissions: {
                    include: {
                      object: true,
                    },
                  },
                },
              },
            },
            where: {
              estActif: true,
              OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
            },
          },
        },
      });

      if (schoolUser) {
        user = schoolUser;
        userScope = 'SCHOOL';
      }
    }

    if (!user) {
      await this.incrementLoginAttempts(email);
      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // 3. Vérifier le mot de passe
    const isPasswordValid = await bcryptjs.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      await this.incrementLoginAttempts(email);

      // Vérifier si le compte doit être verrouillé
      if (user.tentativesEchouees >= this.MAX_LOGIN_ATTEMPTS - 1) {
        await this.lockAccount(user.id, email, userScope);
        throw new UnauthorizedException(
          'Compte verrouillé suite à plusieurs tentatives échouées',
        );
      }

      throw new UnauthorizedException('Email ou mot de passe incorrect');
    }

    // 4. Vérifier si le compte est actif
    if (!user.estActif) {
      throw new UnauthorizedException('Compte désactivé');
    }

    // 5. Réinitialiser les tentatives échouées et mettre à jour la dernière connexion
    if (userScope === 'MINISTRY') {
      await this.prisma.userMinistry.update({
        where: { id: user.id },
        data: {
          tentativesEchouees: 0,
          derniereConnexion: new Date(),
        },
      });
    } else {
      await this.prisma.userSchool.update({
        where: { id: user.id },
        data: {
          tentativesEchouees: 0,
          derniereConnexion: new Date(),
        },
      });
    }

    // 6. Générer les tokens JWT
    const tokens = await this.generateTokens(user, userScope);

    // 7. Compiler et mettre en cache le contexte de sécurité
    const securityContext = await this.compileSecurityContext(user, userScope);
    await this.cacheSecurityContext(user.id, securityContext);

    // 8. Créer la session dans Redis
    await this.createSession(user.id, tokens.accessToken, ipAddress);

    // 9. Enregistrer l'audit
    await this.auditLogin(user.id, ipAddress || '', true);

    // 10. Retourner le résultat
    const userProfile: UserProfile = {
      id: user.id,
      email: user.email,
      prenom: user.prenom,
      nom: user.nom,
      typeUtilisateur: user.typeUtilisateur,
      scope: userScope,
      etablissementId:
        userScope === 'SCHOOL' ? (user as any).etablissementId : undefined,
      structureId:
        userScope === 'MINISTRY' ? (user as any).structureId : undefined,
    };

    return {
      ...tokens,
      user: userProfile,
    };
  }

  /**
   * Algorithme de compilation du contexte de sécurité
   * Adapté pour les deux types d'utilisateurs (Ministry/School)
   */
  private async compileSecurityContext(
    user: AuthUser,
    userScope: 'MINISTRY' | 'SCHOOL',
  ): Promise<SecurityContext> {
    const context: SecurityContext = {
      userId: user.id,
      userScope,
      userType: user.typeUtilisateur,
      etablissementId:
        userScope === 'SCHOOL' ? (user as any).etablissementId : undefined,
      structureId:
        userScope === 'MINISTRY' ? (user as any).structureId : undefined,
      permissions: {},
      visibilityRules: {},
      uiRules: {},
      hierarchy: null,
    };

    const userGroups = (user as any).groupesSecurite || [];

    // 1. Compiler les permissions par objet métier
    for (const userGroup of userGroups) {
      for (const permission of userGroup.group.permissions) {
        const objectName = permission.object.nom;

        if (!context.permissions[objectName]) {
          context.permissions[objectName] = {
            read: false,
            write: false,
            create: false,
            delete: false,
            approve: false,
          };
        }

        // Agrégation des permissions (OR logique)
        context.permissions[objectName].read ||= permission.peutLire;
        context.permissions[objectName].write ||= permission.peutEcrire;
        context.permissions[objectName].create ||= permission.peutCreer;
        context.permissions[objectName].delete ||= permission.peutSupprimer;
        context.permissions[objectName].approve ||= permission.peutApprouver;
      }
    }

    // 2. Compiler les règles de visibilité (RLS)
    const groupIds = userGroups.map((ug: any) => ug.groupId);

    if (groupIds.length > 0) {
      let visibilityRules;
      if (userScope === 'MINISTRY') {
        visibilityRules = await this.prisma.visibilityRuleMinistry.findMany({
          where: {
            groupId: { in: groupIds },
            estActive: true,
          },
          include: {
            object: true,
          },
          orderBy: {
            priorite: 'desc',
          },
        });
      } else {
        visibilityRules = await this.prisma.visibilityRuleSchool.findMany({
          where: {
            groupId: { in: groupIds },
            estActive: true,
          },
          include: {
            object: true,
          },
          orderBy: {
            priorite: 'desc',
          },
        });
      }

      for (const rule of visibilityRules) {
        const objectName = rule.object.nom;

        if (!context.visibilityRules[objectName]) {
          context.visibilityRules[objectName] = [];
        }

        context.visibilityRules[objectName].push({
          type: rule.typeRegle,
          condition: rule.condition,
          priority: rule.priorite,
        });
      }
    }

    // 3. Compiler les règles UI
    if (groupIds.length > 0) {
      let uiRules;
      if (userScope === 'MINISTRY') {
        uiRules = await this.prisma.uIRuleMinistry.findMany({
          where: {
            groupId: { in: groupIds },
          },
        });
      } else {
        uiRules = await this.prisma.uIRuleSchool.findMany({
          where: {
            groupId: { in: groupIds },
          },
        });
      }

      for (const rule of uiRules) {
        const moduleName = 'default'; // Since nomModule doesn't exist in the schema
        
        if (!context.uiRules[moduleName]) {
          context.uiRules[moduleName] = [];
        }
        
        context.uiRules[moduleName].push({
          element: rule.nomElement,
          type: rule.typeElement,
          visible: rule.estVisible,
          enabled: rule.estActif,
          conditions: rule.conditions,
        });
      }
    }

    // 4. Calculer la hiérarchie (seulement pour les utilisateurs du ministère)
    if (userScope === 'MINISTRY') {
      context.hierarchy = await this.calculateHierarchy(user.id);
    }

    return context;
  }

  /**
   * Algorithme de calcul de la hiérarchie pour les utilisateurs du ministère
   */
  private async calculateHierarchy(userId: string): Promise<any> {
    try {
      const user = await this.prisma.userMinistry.findUnique({
        where: { id: userId },
        select: { managerId: true }
      });
      
      const subordinates = await this.prisma.userMinistry.findMany({
        where: { managerId: userId, estActif: true },
        select: { id: true, email: true, prenom: true, nom: true }
      });
      
      return {
        managerId: user?.managerId || null,
        subordinates: subordinates.map(sub => ({
          id: sub.id,
          email: sub.email,
          fullName: `${sub.prenom} ${sub.nom}`,
          level: 1
        })),
        level: 0
      };
    } catch (error) {
      console.error(`Error calculating hierarchy for user ${userId}:`, error);
      return { managerId: null, subordinates: [], level: 0 };
    }
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
   * Verrouillage du compte (adapté pour Ministry/School)
   */
  private async lockAccount(
    userId: string,
    email: string,
    userScope: 'MINISTRY' | 'SCHOOL',
  ): Promise<void> {
    const lockKey = `lock:${email}`;
    const lockDuration = this.LOCK_TIME_MINUTES * 60;

    // Verrouiller dans Redis
    await this.redisService.set(lockKey, '1', lockDuration);

    // Mettre à jour la base de données selon le type d'utilisateur
    const lockUntil = new Date(Date.now() + lockDuration * 1000);

    if (userScope === 'MINISTRY') {
      await this.prisma.userMinistry.update({
        where: { id: userId },
        data: {
          verrouJusqua: lockUntil,
        },
      });
    } else {
      await this.prisma.userSchool.update({
        where: { id: userId },
        data: {
          verrouJusqua: lockUntil,
        },
      });
    }
  }

  /**
   * Cache du contexte de sécurité
   */
  private async cacheSecurityContext(
    userId: string,
    context: any,
  ): Promise<void> {
    const key = `security:${userId}`;
    const ttl = this.configService.get<number>('CACHE_TTL_PERMISSIONS', 3600);

    await this.redisService.set(key, JSON.stringify(context), ttl);
  }

  /**
   * Création de session
   */
  private async createSession(
    userId: string,
    token: string,
    ipAddress?: string,
  ): Promise<void> {
    const sessionId = this.generateSessionId();
    const sessionKey = `session:${sessionId}`;
    const userSessionsKey = `user_sessions:${userId}`;

    const session = {
      sessionId,
      userId,
      token,
      ipAddress,
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    // Stocker la session
    await this.redisService.set(
      sessionKey,
      JSON.stringify(session),
      this.configService.get<number>('SESSION_TTL_SECONDS', 1800),
    );

    // Ajouter à la liste des sessions de l'utilisateur
    await this.redisService.sadd(userSessionsKey, sessionId);
  }

  /**
   * Génération des tokens JWT (adapté pour Ministry/School)
   */
  private async generateTokens(
    user: AuthUser,
    userScope: 'MINISTRY' | 'SCHOOL',
  ): Promise<AuthTokens> {
    const payload = {
      sub: user.id,
      email: user.email,
      type: user.typeUtilisateur,
      scope: userScope,
      establishmentId:
        userScope === 'SCHOOL' ? (user as any).etablissementId : undefined,
      structureId:
        userScope === 'MINISTRY' ? (user as any).structureId : undefined,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.JWT_SECRET,
        expiresIn: this.JWT_EXPIRES_IN,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.JWT_REFRESH_SECRET,
        expiresIn: this.JWT_REFRESH_EXPIRES_IN,
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes en secondes
    };
  }

  /**
   * Audit de connexion (adapté pour le modèle JournalAudit)
   */
  private async auditLogin(
    userId: string,
    ipAddress: string,
    success: boolean,
  ): Promise<void> {
    // Vérifier quel type d'utilisateur pour déterminer le champ à utiliser
    const ministryUser = await this.prisma.userMinistry.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    await this.prisma.journalAudit.create({
      data: {
        userMinistryId: ministryUser ? userId : null,
        userSchoolId: ministryUser ? null : userId,
        action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
        module: 'AUTH',
        adresseIp: ipAddress,
        userAgent: '', // À enrichir avec les données de la requête
        creeLe: new Date(),
      },
    });
  }

  /**
   * Génération d'ID de session
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
