# NYOTA 4-Layer Security System Documentation

## Overview

The NYOTA Security System implements a comprehensive 4-layer security architecture designed to provide granular access control for educational management systems. This multi-layered approach ensures data protection, user authorization, and context-aware security enforcement across Ministry and School domains.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    NYOTA 4-Layer Security                   │
├─────────────────────────────────────────────────────────────┤
│ Layer 1: Authentication                                     │
│ ├─ JWT Token-based Authentication                          │
│ ├─ Ministry vs School User Separation                      │
│ ├─ Account Locking & Failed Attempt Tracking              │
│ └─ Password Security & Session Management                  │
├─────────────────────────────────────────────────────────────┤
│ Layer 2: Authorization (Permissions/ACL)                   │
│ ├─ Role-Based Access Control (RBAC)                       │
│ ├─ Business Object Permissions                            │
│ ├─ Action-Level Granularity (CRUD + Approve)              │
│ └─ Security Group Management                               │
├─────────────────────────────────────────────────────────────┤
│ Layer 3: Row-Level Security (RLS)                          │
│ ├─ Data Visibility Rules                                   │
│ ├─ Hierarchy-Based Filtering                              │
│ ├─ Tenant Isolation                                       │
│ └─ Geographic & Structural Boundaries                     │
├─────────────────────────────────────────────────────────────┤
│ Layer 4: UI Rules                                          │
│ ├─ Dynamic Interface Control                              │
│ ├─ Element Visibility Management                          │
│ ├─ Context-Aware UI Generation                            │
│ └─ User Experience Optimization                           │
└─────────────────────────────────────────────────────────────┘
```

## Layer 1: Authentication System

### Implementation
- **Service**: `AuthService` (`src/auth/auth.service.ts`)
- **Security Context**: `SecurityContextService` (`src/security/security-context.service.ts`)

### Features

#### Dual User System
```typescript
// Ministry Users
interface MinistryUser {
  scope: 'MINISTRY';
  typeUtilisateur: UserMinistryType;
  structureId?: string;
  // Can access ministry-wide data
}

// School Users  
interface SchoolUser {
  scope: 'SCHOOL';
  typeUtilisateur: UserSchoolType;
  etablissementId: string;
  // Limited to specific establishment
}
```

#### Authentication Flow
1. **Email/Password Validation**: bcryptjs password hashing
2. **Account Security**: Failed attempt tracking with Redis-based locking
3. **JWT Token Generation**: Access + Refresh token pair
4. **Security Context Compilation**: Permissions, hierarchy, and filters cached
5. **Audit Logging**: All authentication events tracked

#### Security Features
- **Account Locking**: Configurable max attempts (default: 5)
- **Session Management**: Redis-based session storage
- **Password Security**: bcryptjs with salt rounds
- **Geographic Context**: Ministry users can have departmental restrictions

### Example Usage
```typescript
// Login Process
const result = await authService.login(email, password, ipAddress);
// Returns: { accessToken, refreshToken, user: UserProfile }

// Security Context Retrieval
const context = await securityContextService.getSecurityContext(userId);
// Returns: Complete security profile with permissions, filters, and UI rules
```

## Layer 2: Authorization (Permissions/ACL)

### Implementation
- **Service**: `PermissionCheckerService` (`src/security/permissions/permission-checker.service.ts`)
- **Database Models**: `SecurityGroupMinistry`, `SecurityGroupSchool`, `GroupPermissions*`

### Core Concepts

#### Business Objects
Granular permissions are defined per business object:
```typescript
const businessObjects = [
  'etablissement.management',    // School management
  'user.management',            // User administration  
  'student.management',         // Student records
  'teacher.management',         // Teacher management
  'inspection.management',      // Quality inspections
  'global.admin'               // System administration
];
```

#### Permission Actions
Each business object supports fine-grained actions:
```typescript
enum PermissionAction {
  READ = 'read',       // View data
  WRITE = 'write',     // Modify existing data
  CREATE = 'create',   // Create new records
  DELETE = 'delete',   // Remove data
  APPROVE = 'approve'  // Workflow approval
}
```

#### Security Groups
Users are assigned to security groups that define their permissions:

**Ministry Groups**:
- `Ministre`: Full system access
- `Directeur Ministère`: Departmental management
- `Inspecteur`: Quality control and inspections
- `Secrétaire Général`: Administrative oversight

**School Groups**:
- `Directeur École`: School-level management
- `Enseignant`: Classroom and student management
- `Secrétaire École`: Administrative support

### Permission Checking Flow
```typescript
// Basic Permission Check
const result = await permissionChecker.checkPermission(
  userId,
  'etablissement.management',
  PermissionAction.READ
);

// Returns: { allowed: boolean, reason?: string }

// Multiple Permission Check
const results = await permissionChecker.checkMultiplePermissions(
  userId,
  [
    { businessObject: 'etablissement.management', action: PermissionAction.READ },
    { businessObject: 'etablissement.management', action: PermissionAction.WRITE }
  ]
);
```

### Contextual Rules
The system applies additional context-based restrictions:

#### Establishment Context
```typescript
// School users can only access their own establishment
if (securityContext.userScope === 'SCHOOL') {
  if (context.etablissementId !== securityContext.etablissementId) {
    return { allowed: false, reason: 'Accès autorisé uniquement pour votre établissement' };
  }
}
```

#### Hierarchy Context
```typescript
// Ministry users can manage their direct subordinates
const subordinateIds = securityContext.hierarchy.subordinates.map(s => s.id);
if (!subordinateIds.includes(context.targetUserId)) {
  return { allowed: false, reason: 'Gestion autorisée uniquement pour vos subordinés directs' };
}
```

## Layer 3: Row-Level Security (RLS)

### Implementation
- **Service**: `RLSFilterService` (`src/security/filters/rls-filter.service.ts`)
- **Database Models**: `VisibilityRuleMinistry`, `VisibilityRuleSchool`

### Filter Types

#### 1. Hierarchy Filters
```typescript
type: RuleType.HIERARCHY
condition: { field: 'creeParId' }
// Users see data they created + data from subordinates
```

#### 2. Tenant Filters
```typescript
type: RuleType.TENANT
condition: { allowMultipleEstablishments: false }
// School users limited to their establishment
```

#### 3. Geographic Filters
```typescript
type: RuleType.GEOGRAPHIC
condition: { departementIds: ['dept-bz'] }
// Ministry users limited to specific departments
```

#### 4. Custom Filters
```typescript
type: RuleType.CUSTOM
condition: { customRule: 'specific_business_logic' }
// Application-specific filtering logic
```

### Filter Compilation Process
```typescript
// 1. Retrieve user's security context
const securityContext = await securityContextService.getSecurityContext(userId);

// 2. Compile applicable visibility rules
const filters = await rlsFilterService.compileFilters({
  userId,
  businessObject: 'etablissement.management',
  operation: 'read'
});

// 3. Apply filters to Prisma queries
const filteredQuery = await rlsFilterService.applyFiltersToQuery(
  { userId, businessObject, operation },
  baseQuery
);
```

### Restriction Levels
```typescript
enum RestrictionLevel {
  NONE = 'NONE',       // No data restrictions
  PARTIAL = 'PARTIAL', // Filtered data access
  FULL = 'FULL'        // Complete data restriction
}
```

### Example Filter Application
```typescript
// Original Query
const establishments = await prisma.etablissement.findMany({
  where: { estActif: true }
});

// With RLS Applied
const establishments = await prisma.etablissement.findMany({
  where: {
    AND: [
      { estActif: true },
      { creeParId: { in: hierarchyUserIds } }, // Hierarchy filter
      { departementId: { in: allowedDepartments } } // Geographic filter
    ]
  }
});
```

## Layer 4: UI Rules

### Implementation
- **Service**: `UIVisibilityService` (`src/security/ui-rules/ui-visibility.service.ts`)
- **Database Models**: `UIRuleMinistry`, `UIRuleSchool`

### UI Element Control

#### Element Types
```typescript
enum ElementType {
  BUTTON = 'BUTTON',
  MENU = 'MENU',
  TAB = 'TAB',
  FIELD = 'FIELD',
  SECTION = 'SECTION'
}
```

#### Visibility Rules
```typescript
interface UIRule {
  element: string;        // Element identifier
  type: ElementType;      // Element type
  visible: boolean;       // Show/hide element
  enabled: boolean;       // Enable/disable interaction
  conditions?: any;       // Dynamic conditions
}
```

### UI Configuration Generation
```typescript
// Generate UI configuration for user
const uiConfig = await uiVisibilityService.generateUIConfig(
  userId,
  'etablissement-management'
);

// Returns configuration object:
{
  'delete-button': { visible: false, enabled: false },
  'edit-form': { visible: true, enabled: true },
  'approval-section': { visible: true, enabled: false }
}
```

### Element Visibility Checking
```typescript
// Check specific element visibility
const isVisible = await uiVisibilityService.checkElementVisibility(
  userId,
  'delete-button',
  ElementType.BUTTON
);

// Get all rules for element
const rules = await uiVisibilityService.getElementRules(
  userId,
  'approval-workflow'
);
```

### Dynamic UI Adaptation
The system generates context-aware interfaces based on:
- **User Role**: Different interfaces for ministers vs teachers
- **Current Context**: Establishment-specific vs ministry-wide views
- **Permission Level**: Show only accessible actions
- **Workflow State**: Hide/show approval buttons based on current state

## Security Context Caching

### Implementation
- **Service**: `SecurityContextService`
- **Cache Backend**: Redis
- **TTL**: Configurable (default: 1 hour)

### Cache Strategy
```typescript
// Cache Structure
const securityContextCache: SecurityContextCache = {
  userId: string;
  userScope: 'MINISTRY' | 'SCHOOL';
  userType: UserMinistryType | UserSchoolType;
  etablissementId?: string;
  structureId?: string;
  permissions: { [businessObject: string]: PermissionSet };
  dataFilters: { [businessObject: string]: FilterRule[] };
  uiRules: UIRule[];
  hierarchy?: HierarchyInfo;
  lastUpdated: number;
};
```

### Cache Management
```typescript
// Get cached context (with fallback to database)
const context = await securityContextService.getSecurityContext(userId);

// Invalidate specific user context
await securityContextService.invalidateSecurityContext(userId);

// Invalidate all contexts (after permission updates)
await securityContextService.invalidateAllContexts();
```

## Integration Examples

### 1. Secure Controller Endpoint
```typescript
@Controller('etablissements')
export class EtablissementController {
  
  @Get()
  async findAll(@CurrentUser() user: UserProfile) {
    // Layer 2: Check read permission
    await this.permissionChecker.requirePermission(
      user.id,
      'etablissement.management',
      PermissionAction.READ
    );
    
    // Layer 3: Apply RLS filters
    const baseQuery = { where: { estActif: true } };
    const filteredQuery = await this.rlsFilterService.applyFiltersToQuery(
      {
        userId: user.id,
        businessObject: 'etablissement.management',
        operation: 'read'
      },
      baseQuery
    );
    
    return this.prisma.etablissement.findMany(filteredQuery);
  }
  
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() user: UserProfile) {
    // Layer 2: Check delete permission
    await this.permissionChecker.requirePermission(
      user.id,
      'etablissement.management',
      PermissionAction.DELETE
    );
    
    // Additional context-based validation
    const establishment = await this.prisma.etablissement.findUnique({
      where: { id }
    });
    
    // Layer 3: Verify user can access this specific record
    const hasAccess = await this.rlsFilterService.canAccessRecord(
      user.id,
      'etablissement.management',
      establishment
    );
    
    if (!hasAccess) {
      throw new ForbiddenException('Accès non autorisé à cet établissement');
    }
    
    return this.prisma.etablissement.delete({ where: { id } });
  }
}
```

### 2. Security Guard Implementation
```typescript
@Injectable()
export class SecurityGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    
    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }
    
    // Layer 1: Validate JWT and get security context
    const securityContext = await this.securityContextService.getSecurityContext(user.id);
    
    if (!securityContext) {
      throw new UnauthorizedException('Invalid security context');
    }
    
    // Attach security context to request for use in controllers
    request.securityContext = securityContext;
    
    return true;
  }
}
```

### 3. Frontend Integration
```typescript
// Frontend service for UI rules
class UISecurityService {
  async loadUserInterface(userId: string, module: string) {
    // Get UI configuration from backend
    const uiConfig = await api.get(`/security/ui-config/${module}`);
    
    // Apply visibility rules
    this.applyVisibilityRules(uiConfig);
    
    // Generate dynamic interface
    return this.buildInterface(uiConfig);
  }
  
  private applyVisibilityRules(uiConfig: any) {
    Object.keys(uiConfig).forEach(elementId => {
      const element = document.getElementById(elementId);
      const rule = uiConfig[elementId];
      
      if (element) {
        element.style.display = rule.visible ? 'block' : 'none';
        element.disabled = !rule.enabled;
      }
    });
  }
}
```

## Security Best Practices

### 1. Principle of Least Privilege
- Users receive minimum permissions required for their role
- Permissions are granted explicitly, not by default
- Regular permission audits and reviews

### 2. Defense in Depth
- Multiple security layers prevent single points of failure
- Each layer validates independently
- Comprehensive audit logging

### 3. Separation of Concerns
- Ministry and School data are logically separated
- Geographic boundaries are enforced
- Establishment-level tenant isolation

### 4. Performance Optimization
- Security contexts are cached in Redis
- Batch permission checking for efficiency
- Optimized database queries with proper indexing

### 5. Audit and Compliance
- All security events are logged
- Permission changes are tracked
- User activities are audited

## Testing Strategy

### Real Database Testing
The security system is tested using a dedicated PostgreSQL test database:

```typescript
// Test Environment Setup
const testManager = new TestEnvironmentManager(prismaService, redisService);
await testManager.setupTestEnvironment();

// Test with real data
const loginResult = await authService.login('directeur@ministere.cg', 'password123');
const permissionResult = await permissionChecker.checkPermission(
  loginResult.user.id,
  'etablissement.management',
  PermissionAction.READ
);

expect(permissionResult.allowed).toBe(true);
```

### Test Coverage
- **Authentication**: Login flows, account locking, JWT validation
- **Authorization**: Permission checking, contextual rules, hierarchy
- **RLS Filters**: Data visibility, geographic restrictions, tenant isolation
- **UI Rules**: Dynamic interface generation, element visibility
- **Integration**: End-to-end security flows, cross-service validation

## Monitoring and Maintenance

### Performance Monitoring
- Redis cache hit rates
- Security context compilation time
- Permission checking latency
- Database query performance

### Security Monitoring
- Failed authentication attempts
- Permission violation attempts
- Unusual access patterns
- Account lockout events

### Maintenance Tasks
- Regular permission audits
- Security rule optimization
- Cache performance tuning
- Database index maintenance

## Conclusion

The NYOTA 4-Layer Security System provides comprehensive protection for educational management systems through:

1. **Robust Authentication** with dual user types and account security
2. **Granular Authorization** with role-based permissions and contextual rules
3. **Data Protection** through row-level security and filtering
4. **Dynamic UI Control** with context-aware interface generation

This multi-layered approach ensures data integrity, user privacy, and regulatory compliance while maintaining system performance and user experience.