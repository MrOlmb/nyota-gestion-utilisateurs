# 🚀 NYOTA User Management API - Testing Guide

## Overview

This guide provides comprehensive instructions for testing the NYOTA User Management API using Postman. The API includes full CRUD operations for Ministry and School users, advanced hierarchy management, and comprehensive security features.

## 📋 Prerequisites

1. **Application Running**: Ensure the NYOTA application is running on `http://localhost:3000`
2. **Database Setup**: Database should be seeded with basic data
3. **Postman**: Install Postman for API testing
4. **Environment**: Import the provided Postman collection and environment

## 📦 Postman Setup

### 1. Import Collection
```bash
# Import the collection file
postman/NYOTA-User-Management-API.postman_collection.json
```

### 2. Import Environment
```bash
# Import the environment file
postman/NYOTA-Development.postman_environment.json
```

### 3. Set Base URL
- Ensure `base_url` is set to `http://localhost:3000` in your environment

## 🔐 Authentication Flow

### Step 1: Login
**Endpoint**: `POST /auth/login`

**Request Body**:
```json
{
  "email": "admin@education.cg",
  "password": "AdminPassword123!",
  "ipAddress": "127.0.0.1"
}
```

**Expected Response**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900,
  "user": {
    "id": "user-uuid",
    "email": "admin@education.cg",
    "prenom": "Admin",
    "nom": "System",
    "scope": "MINISTRY"
  }
}
```

**Auto-setup**: The Postman collection automatically saves the `access_token` for subsequent requests.

## 👥 User Management Testing

### Ministry Users

#### Create Ministry User
**Endpoint**: `POST /users/ministry`

**Request Body**:
```json
{
  "email": "test.ministry@education.cg",
  "password": "TestPassword123!",
  "prenom": "Jean",
  "nom": "Dupont",
  "typeUtilisateur": "DIRECTEUR",
  "titre": "Directeur de Test",
  "securityGroupIds": []
}
```

**Expected Response** (201):
```json
{
  "id": "new-user-uuid",
  "email": "test.ministry@education.cg",
  "prenom": "Jean",
  "nom": "Dupont",
  "typeUtilisateur": "DIRECTEUR",
  "titre": "Directeur de Test",
  "estActif": true,
  "creeLe": "2024-01-15T10:00:00.000Z",
  "modifieLe": "2024-01-15T10:00:00.000Z"
}
```

#### Get All Ministry Users
**Endpoint**: `GET /users/ministry`

**Query Parameters**:
- `page=1` - Pagination page number
- `limit=10` - Number of users per page
- `search=Jean` - Search by name
- `typeUtilisateur=DIRECTEUR` - Filter by user type

#### Update Ministry User
**Endpoint**: `PUT /users/ministry/{id}`

**Request Body**:
```json
{
  "prenom": "Jean-Updated",
  "titre": "Directeur Principal"
}
```

### School Users

#### Create School User
**Endpoint**: `POST /users/school`

**Request Body**:
```json
{
  "email": "test.school@education.cg",
  "password": "TestPassword123!",
  "prenom": "Marie",
  "nom": "Martin",
  "typeUtilisateur": "ENSEIGNANT",
  "matricule": "ENS001",
  "dateNaissance": "1985-06-15",
  "classe": "6ème A",
  "matierePrincipale": "Mathématiques",
  "etablissementId": "dummy-etablissement-id",
  "securityGroupIds": []
}
```

## 🏗️ Hierarchy Management Testing

### Get User Hierarchy
**Endpoint**: `GET /users/hierarchy`

**Query Parameters**:
- `rootUserId` - Starting user for hierarchy
- `maxDepth=3` - Maximum hierarchy depth
- `includeUserData=true` - Include detailed user information

**Expected Response**:
```json
{
  "rootNode": {
    "id": "user-uuid",
    "email": "director@education.cg",
    "subordinates": [
      {
        "id": "manager-uuid",
        "level": 1,
        "subordinates": [],
        "subordinateCount": 2
      }
    ]
  },
  "stats": {
    "totalUsers": 5,
    "activeUsers": 5,
    "maxDepth": 2,
    "byUserType": {
      "DIRECTEUR": { "count": 1, "averageSubordinates": 3 },
      "MANAGER": { "count": 2, "averageSubordinates": 1 }
    }
  }
}
```

### Get Organizational Chart
**Endpoint**: `GET /users/hierarchy/orgchart`

**Expected Response**:
```json
{
  "orgChart": {
    "id": "director-uuid",
    "name": "Jean Directeur",
    "title": "Directeur Général",
    "email": "director@education.cg",
    "children": [
      {
        "id": "manager-uuid",
        "name": "Marie Manager",
        "title": "Chef de Département",
        "children": []
      }
    ],
    "metadata": {
      "employeeCount": 5,
      "departmentName": "Direction Générale"
    }
  }
}
```

### Update User Hierarchy
**Endpoint**: `PUT /users/hierarchy/update`

**Request Body**:
```json
{
  "userId": "subordinate-uuid",
  "newManagerId": "new-manager-uuid",
  "reason": "Reorganization - test via Postman"
}
```

### Bulk Hierarchy Update
**Endpoint**: `PUT /users/hierarchy/bulk-update`

**Request Body**:
```json
{
  "updates": [
    {
      "userId": "user1-uuid",
      "newManagerId": "manager-uuid",
      "reason": "Bulk reorganization"
    },
    {
      "userId": "user2-uuid",
      "newManagerId": null,
      "reason": "Remove manager"
    }
  ]
}
```

### Hierarchy Analytics
**Endpoint**: `GET /users/hierarchy/analytics/{userId}`

**Expected Response**:
```json
{
  "spanOfControl": 3,
  "hierarchyDepth": 2,
  "totalSubordinates": 5,
  "directReports": 3,
  "structureDistribution": {},
  "typeDistribution": {
    "MANAGER": 2,
    "CHEF_DEPARTEMENT": 3
  },
  "recommendations": [
    "Span of control optimal",
    "Consider cross-training for redundancy"
  ]
}
```

## 🔄 Reorganization Planning

### Create Reorganization Plan
**Endpoint**: `POST /users/hierarchy/reorganization/plan`

**Request Body**:
```json
{
  "name": "Q1 2024 Reorganization",
  "description": "Quarterly reorganization to improve efficiency",
  "changes": [
    {
      "userId": "user-uuid",
      "newManagerId": "new-manager-uuid",
      "reason": "Better alignment with department goals"
    }
  ],
  "effectiveDate": "2024-02-01T00:00:00.000Z"
}
```

### Simulate Reorganization
**Endpoint**: `POST /users/hierarchy/reorganization/simulate`

**Request Body**:
```json
{
  "changes": [
    {
      "userId": "user-uuid",
      "newManagerId": null,
      "reason": "Simulation test - remove manager"
    }
  ]
}
```

## 📊 Statistics and Analytics

### Get User Statistics
**Endpoint**: `GET /users/statistics`

**Expected Response**:
```json
{
  "ministry": {
    "total": 150,
    "active": 145,
    "byType": {
      "DIRECTEUR": 5,
      "MANAGER": 15,
      "CHEF_DEPARTEMENT": 25
    },
    "byStructure": {
      "Direction Générale": 20,
      "DRH": 15
    }
  },
  "school": {
    "total": 5000,
    "active": 4850,
    "byType": {
      "DIRECTEUR": 150,
      "ENSEIGNANT": 4000,
      "ELEVE": 800
    },
    "byEtablissement": {
      "Lycée A": 500,
      "Collège B": 300
    }
  }
}
```

## 🧪 Testing Scenarios

### 1. Complete User Lifecycle
1. **Create** a ministry user
2. **Read** the user details
3. **Update** user information
4. **Assign** to hierarchy
5. **Delete** (soft delete)

### 2. Hierarchy Operations
1. **Create** multiple users
2. **Build** hierarchy relationships
3. **Generate** org chart
4. **Analyze** hierarchy metrics
5. **Simulate** reorganization

### 3. Security Testing
1. **Test** without authentication (should get 401)
2. **Test** with invalid token
3. **Test** permission restrictions
4. **Test** data validation

### 4. Error Handling
1. **Test** invalid email formats
2. **Test** weak passwords
3. **Test** duplicate email creation
4. **Test** non-existent user operations

## 🔍 Validation Checklist

### Authentication
- [ ] Login with valid credentials returns access token
- [ ] Login with invalid credentials returns 401
- [ ] Protected endpoints require authentication
- [ ] Token refresh works correctly

### User Management
- [ ] Create ministry user with valid data
- [ ] Create school user with valid data
- [ ] Email validation rejects invalid formats
- [ ] Password validation rejects weak passwords
- [ ] User search and filtering work correctly
- [ ] User updates apply correctly
- [ ] Soft delete preserves data but marks inactive

### Hierarchy Management
- [ ] Hierarchy retrieval shows correct structure
- [ ] Org chart generation works
- [ ] Hierarchy updates apply correctly
- [ ] Bulk updates process all changes
- [ ] Circular reference detection works
- [ ] Analytics provide meaningful insights

### Error Handling
- [ ] 404 for non-existent resources
- [ ] 400 for invalid data
- [ ] 401 for authentication failures
- [ ] 403 for permission denials
- [ ] Proper error messages returned

## 🚨 Common Issues & Solutions

### Issue: 401 Unauthorized
**Solution**: Ensure you've logged in and the access token is set in environment variables.

### Issue: 400 Bad Request
**Solution**: Check request body format and required fields. Validate email format and password strength.

### Issue: 404 Not Found
**Solution**: Verify the user ID exists and the endpoint URL is correct.

### Issue: Connection Refused
**Solution**: Ensure the application is running on the correct port (3000).

## 📝 Notes

1. **Auto Token Management**: The Postman collection automatically manages authentication tokens
2. **Environment Variables**: User IDs are automatically saved for subsequent requests
3. **Test Order**: Some tests depend on previous tests (e.g., update requires create)
4. **Data Persistence**: Created test data should be cleaned up after testing

## 🎯 Next Steps

After successful API testing:
1. **Performance Testing**: Test with larger datasets
2. **Security Audit**: Comprehensive security testing
3. **Integration Testing**: Test with real frontend
4. **Load Testing**: Test concurrent user scenarios
5. **Documentation**: Update API documentation based on testing results