# NYOTA Security System - Test Suite

This directory contains a comprehensive test suite for the NYOTA security system, covering all four layers of security implementation.

## Test Structure

### Unit Tests
- **`auth.service.spec.ts`** - Authentication service tests
- **`permission-checker.service.spec.ts`** - Permission checking logic tests  
- **`rls-filter.service.spec.ts`** - Row-level security filter tests
- **`security.guard.spec.ts`** - Security guard integration tests

### Integration Tests
- **`security-integration.spec.ts`** - Cross-service integration tests
- **`end-to-end-security.spec.ts`** - Complete workflow tests

### Test Utilities
- **`test-helpers.ts`** - Mock data, test utilities, and assertion helpers
- **`setup-teardown.ts`** - Database seeding and cleanup utilities

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Suites
```bash
# Unit tests only
npm test -- --testPathPattern="\.spec\.ts$"

# Integration tests only  
npm test -- --testPathPattern="integration|end-to-end"

# Specific service tests
npm test auth.service.spec.ts
npm test permission-checker.service.spec.ts
```

### With Coverage
```bash
npm run test:cov
```

### Watch Mode
```bash
npm run test:watch
```

## Test Environment Setup

### Prerequisites
1. **PostgreSQL Test Database** - Separate from development database
2. **Redis Test Instance** - Separate from development Redis
3. **Environment Variables** - Set test-specific configuration

### Configuration
Create a `.env.test` file:
```env
# Database
DATABASE_URL="postgresql://username:password@localhost:5432/nyota_test"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=1

# JWT Secrets (use test-specific secrets)
JWT_SECRET=test-jwt-secret-key
JWT_REFRESH_SECRET=test-refresh-secret-key

# Test-specific settings
NODE_ENV=test
LOG_LEVEL=error
```

### Database Setup
```bash
# Create test database
createdb nyota_test

# Run migrations
npx prisma migrate deploy --schema=./prisma/schema.prisma

# Generate Prisma client
npx prisma generate
```

## Test Data Management

### Seeding Test Data
The test suite includes comprehensive test data seeding:

```typescript
import { TestEnvironmentManager } from './setup-teardown';

// In your test
const environmentManager = new TestEnvironmentManager(prisma, redis);
await environmentManager.setupTestEnvironment();
```

### Available Test Data
- **Reference Data**: Departments, districts, communes
- **Users**: Ministry and school users with different roles
- **Establishments**: Sample schools and institutions
- **Security Groups**: Predefined permission groups
- **Business Objects**: Security-managed entities

### Cleanup
Tests automatically clean up after themselves:
```typescript
afterEach(async () => {
  await environmentManager.cleanupTestEnvironment();
});
```

## Test Categories

### 1. Authentication Tests (`auth.service.spec.ts`)
- ✅ Successful login flows (ministry and school users)
- ✅ Password validation and hashing
- ✅ Account lockout mechanisms
- ✅ Session management
- ✅ Security context compilation
- ✅ Audit logging

### 2. Permission Tests (`permission-checker.service.spec.ts`)
- ✅ Basic permission checking
- ✅ Contextual permission rules
- ✅ Multiple permission validation
- ✅ Business logic enforcement
- ✅ Error handling

### 3. RLS Filter Tests (`rls-filter.service.spec.ts`)
- ✅ Filter compilation for different user types
- ✅ Hierarchy-based filtering
- ✅ Geography-based filtering
- ✅ Tenant isolation
- ✅ Custom business rules
- ✅ Query integration

### 4. Security Guard Tests (`security.guard.spec.ts`)
- ✅ JWT token validation
- ✅ Permission enforcement
- ✅ Scope restrictions
- ✅ User type validation
- ✅ Combined security checks

### 5. Integration Tests (`security-integration.spec.ts`)
- ✅ Complete authentication flow
- ✅ Security context caching
- ✅ Cross-service communication
- ✅ Error propagation
- ✅ Performance characteristics

### 6. End-to-End Tests (`end-to-end-security.spec.ts`)
- ✅ Login to data access workflows
- ✅ Permission-to-RLS integration
- ✅ UI rule generation
- ✅ Audit trail consistency
- ✅ Error handling across layers

## Mock Data and Helpers

### Mock Users
```typescript
import { MockUsers } from './test-helpers';

// Ministry users
MockUsers.ministryDirector
MockUsers.ministryMinister

// School users  
MockUsers.schoolDirector
MockUsers.schoolTeacher
```

### Security Contexts
```typescript
import { MockSecurityContexts } from './test-helpers';

// Pre-compiled security contexts
MockSecurityContexts.ministryDirector
MockSecurityContexts.schoolDirector
```

### Test Scenarios
```typescript
import { TestScenarios } from './test-helpers';

// Login scenarios
const successScenario = TestScenarios.createSuccessfulLogin('ministry');
const failureScenario = TestScenarios.createFailedLogin('wrong-password');

// Permission scenarios
const permissionScenario = TestScenarios.createPermissionScenario(
  true, 
  'etablissement.management', 
  'read'
);
```

### Assertions
```typescript
import { TestAssertions } from './test-helpers';

// Verify login success
TestAssertions.expectSuccessfulLogin(result, 'MINISTRY');

// Verify audit logging
TestAssertions.expectAuditLog(auditCall, 'LOGIN_SUCCESS', 'user-1');
```

## Test Performance

### Execution Times
- **Unit tests**: ~500ms per service
- **Integration tests**: ~2s for full suite
- **End-to-end tests**: ~5s for complete workflows

### Coverage Targets
- **Line Coverage**: >95%
- **Branch Coverage**: >90%
- **Function Coverage**: >98%

### Performance Tests
The test suite includes performance benchmarks:
- Concurrent login handling
- Permission check performance
- Cache efficiency validation
- Memory usage monitoring

## Debugging Tests

### Verbose Output
```bash
npm test -- --verbose
```

### Debug Specific Test
```bash
npm test -- --testNamePattern="should handle login" --verbose
```

### Database Query Logging
Set `LOG_LEVEL=debug` in test environment to see Prisma queries.

### Redis Command Logging
Enable Redis logging to monitor cache operations during tests.

## Continuous Integration

### GitHub Actions
```yaml
name: Security Tests
on: [push, pull_request]
jobs:
  security-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:6
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test:security
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/nyota_test
          REDIS_HOST: localhost
```

## Best Practices

### 1. Test Isolation
- Each test runs in isolation
- Database is reset between test suites
- Cache is cleared between tests

### 2. Mock Management
- Use provided test helpers
- Avoid direct mock setup in tests
- Leverage scenario builders

### 3. Error Testing
- Test both success and failure paths
- Verify error messages and types
- Test edge cases and boundaries

### 4. Performance Testing
- Include performance assertions
- Monitor memory usage
- Test concurrent scenarios

### 5. Security Testing
- Test all authentication flows
- Verify permission enforcement
- Test data isolation
- Validate audit logging

## Troubleshooting

### Common Issues

**Database Connection Errors**
- Verify test database exists
- Check connection string in `.env.test`
- Ensure migrations are applied

**Redis Connection Errors**
- Verify Redis is running
- Check Redis configuration
- Ensure test database number is separate

**Test Timeouts**
- Increase Jest timeout for integration tests
- Check for async operations without await
- Monitor database query performance

**Permission Test Failures**
- Verify test data seeding
- Check security group assignments
- Validate business object configuration

### Getting Help
- Check the test output for detailed error messages
- Review the mock data in `test-helpers.ts`
- Examine the setup/teardown logic
- Consult the main security system documentation