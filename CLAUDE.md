# CLAUDE.md - AI Assistant Guide for Schema2

> **Last Updated**: 2025-11-13
> **Version**: 2.0.0 (Phase 2 Refactoring)

This document provides comprehensive guidance for AI assistants (like Claude) working on the Schema2 codebase. It explains the architecture, conventions, workflows, and key concepts needed to effectively understand and modify this project.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Directory Structure](#directory-structure)
4. [Core Concepts](#core-concepts)
5. [Development Workflow](#development-workflow)
6. [Code Conventions & Patterns](#code-conventions--patterns)
7. [Common Tasks](#common-tasks)
8. [Key Files Reference](#key-files-reference)
9. [API & Routes](#api--routes)
10. [Security Considerations](#security-considerations)
11. [Troubleshooting](#troubleshooting)

---

## Project Overview

**Schema2** is a schema-driven Node.js CMS with dynamic CRUD interface, JWT authentication, and sophisticated Role-Based Access Control (RBAC). The entire application is configured through a single `schema.js` file that defines:

- Database tables and fields
- Role hierarchy and inheritance
- Permissions (table, row, and field level)
- UI rendering rules
- Relations and data access patterns

**Key Features:**
- ✅ Schema-driven development (zero boilerplate)
- ✅ RBAC with role inheritance
- ✅ Row-level security (draft/shared/published)
- ✅ Field-level permissions
- ✅ Auto database synchronization
- ✅ Dynamic page rendering with Mustache templates
- ✅ RESTful API with relations
- ✅ Service-layer architecture (Phase 2 refactoring)

---

## Architecture & Tech Stack

### Layered Architecture

```
┌─────────────────────────────────────┐
│     Routes (HTTP Layer)             │  routes/*.js
├─────────────────────────────────────┤
│     Services (Business Logic)       │  services/*.js
├─────────────────────────────────────┤
│     Repository (Data Access)        │  services/repositoryService.js
├─────────────────────────────────────┤
│     Database (MySQL)                │  MySQL2 with connection pool
└─────────────────────────────────────┘
```

### Tech Stack

**Backend:**
- **Runtime**: Node.js
- **Framework**: Express.js 4.18.2
- **Database**: MySQL (via mysql2 ^3.6.5)
- **Authentication**: JWT (jsonwebtoken ^9.0.2)
- **Templating**: Mustache
- **Password Hashing**: bcrypt ^5.1.1 (installed but not yet active)

**Frontend:**
- Pure HTML/CSS/JavaScript (no framework)
- 11 modular CSS files
- Component-based vanilla JS (FieldSelectorUI)

**Development:**
- nodemon ^3.0.2 (auto-reload)
- dotenv ^16.3.1 (environment config)

---

## Directory Structure

```
schema2/
├── schema.js                    # ⭐ CENTRAL CONFIGURATION (341 lines)
├── server.js                    # Express app entry point (111 lines)
│
├── config/
│   └── database.js             # MySQL2 connection pool
│
├── constants/
│   └── permissions.js          # Permission constants (GRANTED_VALUES, ROLES)
│
├── services/                   # ⭐ Business logic layer (Phase 2)
│   ├── authService.js          # JWT & authentication
│   ├── permissionService.js    # RBAC permission checking
│   ├── schemaService.js        # Schema validation & queries
│   ├── entityService.js        # Entity access control
│   ├── pageService.js          # Page & section management
│   ├── tableDataService.js     # Data retrieval with relations
│   ├── templateService.js      # HTML template generation
│   ├── repositoryService.js    # Data access layer (Repository Pattern)
│   └── dbSyncService.js        # Database synchronization
│
├── routes/                     # Express route handlers
│   ├── auth.js                 # Authentication (/_user/login, logout, me)
│   ├── crud.js                 # CRUD interface (/_crud/:table)
│   ├── api.js                  # RESTful API (/_api/:table)
│   ├── pages.js                # ⚠️ Legacy (917 lines - to be removed)
│   └── pages_refactored.js     # ✅ Refactored version (185 lines)
│
├── utils/
│   ├── mustacheAuto.js         # Template generation utilities
│   ├── dataProxy.js            # Data transformation proxy
│   └── buildUrl.js             # URL building helper
│
├── public/
│   ├── css/                    # 11 modular stylesheets
│   │   ├── common.css
│   │   ├── navigation.css
│   │   ├── header.css
│   │   ├── sidebar-menu.css
│   │   ├── user-menu.css
│   │   ├── login-form.css
│   │   ├── pages-content.css
│   │   ├── crud.css
│   │   └── json-viewer.css
│   │
│   └── js/
│       └── fieldSelectorUI.js  # Field selector component
│
└── Documentation/
    ├── README.md               # Project overview (French)
    ├── REFACTORING_PHASE2.md   # Phase 2 refactoring details
    ├── CROSS_REFERENCE.md      # Detailed cross-reference (940 lines)
    ├── SERVICES_API.md         # Services API documentation
    └── SERVICES_STATS.md       # Services statistics
```

---

## Core Concepts

### 1. Schema-Driven Development

**Everything is defined in `schema.js`:**

```javascript
// schema.js
module.exports = {
  appName: "Crudable Site",
  roles: { /* role hierarchy */ },
  tables: {
    Page: {
      fields: {
        id: { type: "integer", isPrimary: true, autoIncrement: true },
        slug: { type: "varchar" },
        name: { type: "varchar" },
        // ... more fields
      },
      granted: {
        "public": { read: false },
        "member": { read: true, create: false },
        "admin": { read: true, create: true, update: true, delete: true }
      }
    }
  }
}
```

**Benefits:**
- Database auto-syncs on server start
- CRUD operations auto-generated
- API routes auto-configured
- Permissions enforced automatically

### 2. RBAC with Role Inheritance

**Role Hierarchy** (defined in schema.js:15-24):

```
dev → dir → admin → promo, road → premium → member → public
```

**Key Points:**
- Roles inherit permissions from parents recursively
- Lower-level roles automatically get higher-level permissions
- Use `PermissionService.getUserAllRoles(user)` to get effective roles

**Example:**
```javascript
// A user with role "admin" inherits permissions from:
// admin, promo, road, premium, member, public
```

### 3. Three-Level Permission System

#### A. Table-Level Permissions
Defined in `schema.js` under `granted`:
```javascript
granted: {
  "member": { read: true, create: false, update: false, delete: false },
  "admin": { read: true, create: true, update: true, delete: true }
}
```

#### B. Row-Level Security (granted field)
Every row has a `granted` field with three states:
- **`draft`**: Only owner (ownerId) can access
- **`shared`**: Table-level permissions apply
- **`published @role`**: Accessible by specified role and descendants

#### C. Field-Level Permissions
Individual fields can have grants:
```javascript
fields: {
  salary: {
    type: "integer",
    grant: { "admin": ["read", "update"] }  // Only admin can see/edit
  }
}
```

### 4. Service Layer Pattern (Phase 2)

**All business logic is in services:**

```
Route Handler (thin) → Service (thick) → Repository → Database
```

**Key Services:**
- `AuthService`: Authentication & JWT
- `PermissionService`: RBAC logic
- `SchemaService`: Schema validation
- `EntityService`: Entity access control
- `PageService`: Page/section management
- `RepositoryService`: SQL queries

**Always use services in routes:**
```javascript
// ✅ Good
const user = await AuthService.verifyToken(token);
const canRead = PermissionService.hasPermission(user, 'Person', 'read');

// ❌ Bad (logic in route)
const user = jwt.verify(token, process.env.JWT_SECRET);
// ... permission logic here
```

### 5. Common Fields

Auto-added to all tables (defined in schema.js:26-32):
```javascript
{
  ownerId: integer,        // Creator of the record
  granted: varchar,        // Access control: draft/shared/published @role
  createdAt: datetime,     // Auto timestamp
  updatedAt: datetime      // Auto timestamp on update
}
```

---

## Development Workflow

### Initial Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your database credentials

# 3. Start development server
npm run dev

# Database will auto-sync from schema.js on startup
```

### Making Changes

#### Adding a New Table

1. **Define in `schema.js`** (lines 89-340):
```javascript
tables: {
  MyNewTable: {
    fields: {
      id: { type: "integer", isPrimary: true, autoIncrement: true },
      name: { type: "varchar", length: 255 },
      description: { type: "text" },
      // ... more fields
    },
    granted: {
      "member": { read: true, create: true },
      "admin": { read: true, create: true, update: true, delete: true }
    }
  }
}
```

2. **Restart server** - table is auto-created
3. **Access via**:
   - `/_crud/MyNewTable` (UI)
   - `/_api/MyNewTable` (JSON API)

#### Adding a New Service

1. **Create file** `services/myService.js`:
```javascript
const pool = require('../config/database');
const SchemaService = require('./schemaService');

class MyService {
  static async myMethod(param) {
    // Business logic here
    return result;
  }
}

module.exports = MyService;
```

2. **Use in routes**:
```javascript
const MyService = require('../services/myService');

router.get('/my-route', async (req, res) => {
  const result = await MyService.myMethod(param);
  res.json(result);
});
```

#### Modifying Routes

**Current State:**
- `routes/pages.js` is **legacy** (917 lines)
- Use `routes/pages_refactored.js` (185 lines) as reference
- Always extract business logic to services

**Pattern:**
```javascript
// routes/myRoute.js
router.get('/:id', async (req, res) => {
  try {
    // 1. Extract parameters
    const { id } = req.params;
    const user = req.user;

    // 2. Check permissions (via service)
    const canRead = PermissionService.hasPermission(user, 'MyTable', 'read');
    if (!canRead) return res.status(403).json({ error: 'Forbidden' });

    // 3. Get data (via service)
    const data = await MyService.getData(id, user);

    // 4. Return response
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Git Workflow

```bash
# 1. Create feature branch
git checkout -b feature/my-feature

# 2. Make changes
# ... edit files ...

# 3. Commit with descriptive message
git add .
git commit -m "Add feature: description of changes"

# 4. Push to remote
git push -u origin feature/my-feature

# 5. Create pull request (via GitHub)
```

**Commit Message Conventions:**
- `Add feature: ...` - New functionality
- `Fix bug: ...` - Bug fix
- `Refactor: ...` - Code refactoring
- `Update: ...` - Enhancement to existing feature
- `Docs: ...` - Documentation changes

---

## Code Conventions & Patterns

### Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| **Tables** | PascalCase | `Person`, `MusicAlbum`, `OrganizationPerson` |
| **Fields** | camelCase | `givenName`, `familyName`, `createdAt` |
| **Database Columns** | snake_case | `given_name`, `family_name`, `created_at` |
| **Routes** | kebab-case | `/_user/login`, `/_api/music-albums` |
| **Services** | PascalCase class | `AuthService`, `PermissionService` |
| **Functions** | camelCase | `getUserAllRoles()`, `hasPermission()` |
| **Constants** | UPPER_SNAKE_CASE | `GRANTED_VALUES`, `PERMISSIONS` |

### File Organization

**Services Pattern:**
```javascript
// services/myService.js
class MyService {
  // ✅ Use static methods
  static async findById(id) {
    const [rows] = await pool.query('SELECT * FROM Table WHERE id = ?', [id]);
    return rows[0];
  }

  // ✅ Always handle errors
  static async create(data) {
    try {
      const [result] = await pool.query('INSERT INTO Table SET ?', [data]);
      return result.insertId;
    } catch (error) {
      throw new Error(`Failed to create: ${error.message}`);
    }
  }
}

module.exports = MyService;
```

### Error Handling

**Consistent error responses:**
```javascript
// ✅ 401 - Unauthorized (not logged in)
res.status(401).json({ error: 'Authentication required' });

// ✅ 403 - Forbidden (logged in but no permission)
res.status(403).json({ error: 'Permission denied' });

// ✅ 404 - Not found
res.status(404).json({ error: 'Resource not found' });

// ✅ 500 - Server error
res.status(500).json({ error: 'Internal server error' });
```

### Permission Checking Pattern

**Always check at multiple levels:**
```javascript
// 1. Table-level
const canRead = PermissionService.hasPermission(user, 'Person', 'read');

// 2. Row-level
const canAccess = await EntityService.canAccessEntity(user, 'Person', row);

// 3. Field-level (if needed)
const field = SchemaService.getFieldDefinition('Person', 'salary');
const canReadField = PermissionService.hasFieldPermission(user, field, 'read');
```

### Data Flow Pattern

```javascript
// Request → Route → Service → Repository → Database
router.get('/:id', async (req, res) => {
  // Route: Extract & validate
  const { id } = req.params;

  // Service: Business logic & permissions
  const data = await EntityService.getWithPermissions('Person', id, req.user);

  // Response
  res.json({ success: true, data });
});
```

---

## Common Tasks

### Task 1: Add a New Endpoint

```javascript
// routes/api.js
router.get('/custom-endpoint', async (req, res) => {
  try {
    const user = req.user;

    // Use services for business logic
    const result = await MyService.customOperation(user);

    res.json({ success: true, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Task 2: Add Computed Field to Schema

```javascript
// schema.js
tables: {
  Person: {
    fields: {
      givenName: { type: "varchar" },
      familyName: { type: "varchar" },

      // SQL computed field
      fullName: {
        as: "CONCAT(givenName, ' ', familyName)"
      },

      // JavaScript computed field
      abbreviation: {
        calculate: async (row) => {
          return `${row.givenName[0]}${row.familyName[0]}`.toUpperCase();
        }
      }
    }
  }
}
```

### Task 3: Add Relation Between Tables

```javascript
// schema.js
tables: {
  Project: {
    fields: {
      id: { type: "integer", isPrimary: true, autoIncrement: true },
      name: { type: "varchar" },

      // N:1 relation (Many projects to one organization)
      organizationId: {
        type: "integer",
        relation: "Organization",          // Target table
        foreignKey: "id",                  // Target field
        relationshipStrength: "Strong",    // Cascade delete
        arrayName: "projects",             // Reverse property name
        defaultSort: { field: "name", order: "ASC" }
      }
    }
  }
}
```

### Task 4: Query Data with Relations

```javascript
// Using TableDataService
const result = await TableDataService.getTableData(
  pool,
  'Project',
  {
    limit: 10,
    offset: 0,
    orderBy: 'name',
    order: 'ASC',
    relation: 'all',  // or ['Organization', 'Person'] or 'default'
    where: 'status = "active"'
  },
  req.user
);
```

### Task 5: Create Custom Template

```javascript
// services/templateService.js
class TemplateService {
  static generateMyCustomPage(data) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <link rel="stylesheet" href="/css/common.css">
        <link rel="stylesheet" href="/css/my-custom.css">
      </head>
      <body>
        <h1>${data.title}</h1>
        ${data.items.map(item => `
          <div class="item">${item.name}</div>
        `).join('')}
      </body>
      </html>
    `;
  }
}
```

---

## Key Files Reference

### Critical Files (Must Understand)

| File | Lines | Purpose | When to Edit |
|------|-------|---------|--------------|
| **schema.js** | 341 | Central configuration | Adding tables, changing permissions, defining roles |
| **server.js** | 111 | App entry point | Adding middleware, changing port, app-level config |
| **constants/permissions.js** | 58 | Permission constants | Never (unless adding new permission types) |
| **config/database.js** | 28 | MySQL connection | Changing DB config |

### Services (Business Logic)

| File | Lines | Purpose | Key Methods |
|------|-------|---------|-------------|
| **authService.js** | ~100 | Authentication | `generateToken()`, `verifyToken()`, `authMiddleware()` |
| **permissionService.js** | ~170 | RBAC | `hasPermission()`, `getUserAllRoles()`, `checkEntityAccess()` |
| **schemaService.js** | ~400 | Schema queries | `getTableSchema()`, `getTableFields()`, `validateFieldValue()` |
| **entityService.js** | ~250 | Entity access | `getEntityWithPermissions()`, `filterEntitiesByAccess()` |
| **pageService.js** | ~200 | Pages/sections | `getPageBySlug()`, `getPageSections()` |
| **tableDataService.js** | ~300 | Data retrieval | `getTableData()` (with relations, pagination) |
| **templateService.js** | ~680 | HTML generation | `htmlSitePage()`, `htmlLogin()` |
| **repositoryService.js** | ~200 | Data access | `findById()`, `findAll()`, `create()`, `update()`, `delete()` |

### Routes (HTTP Handlers)

| File | Lines | Routes | Status |
|------|-------|--------|--------|
| **auth.js** | 87 | `/_user/login`, `/_user/logout`, `/_user/me` | ✅ Active |
| **crud.js** | 500+ | `/_crud/:table` (GET, POST, PUT, DELETE) | ✅ Active |
| **api.js** | 500+ | `/_api/:table` (RESTful JSON API) | ✅ Active |
| **pages_refactored.js** | 185 | `/:slug` (dynamic pages) | ✅ Refactored |
| **pages.js** | 917 | `/:slug` (legacy) | ⚠️ To be removed |

---

## API & Routes

### Authentication Routes (`/_user`)

```
POST /_user/login
  Body: { email, password }
  Response: { success: true, user: {...} }
  Sets: JWT cookie (httpOnly)

POST /_user/logout
  Response: { success: true }
  Clears: JWT cookie

GET /_user/me
  Response: { user: {...} } or { user: null }
  Requires: JWT cookie
```

### CRUD Routes (`/_crud`)

```
GET /_crud/:table
  Query: ?limit=10&offset=0&orderBy=name&order=ASC
  Response: HTML interface or JSON list
  Permissions: table.granted[role].read

GET /_crud/:table/:id
  Response: JSON entity with permissions
  Permissions: table.granted[role].read + row-level check

POST /_crud/:table
  Body: { field1: value1, ... }
  Response: { success: true, id: N }
  Permissions: table.granted[role].create

PUT /_crud/:table/:id
  Body: { field1: value1, ... }
  Response: { success: true }
  Permissions: table.granted[role].update + row-level check

DELETE /_crud/:table/:id
  Response: { success: true }
  Permissions: table.granted[role].delete + row-level check
```

### API Routes (`/_api`)

```
GET /_api/:table
  Query:
    - limit, offset (pagination)
    - orderBy, order (sorting)
    - where (SQL WHERE clause)
    - relation (all | default | field1,field2)
    - schema=1 (include schema in response)
    - compact=1 (compact n:1 relations)
    - noSystemFields=1 (remove system fields)
    - noId=1 (remove id fields)
  Response: {
    success: true,
    table: "TableName",
    rows: [...],
    pagination: { total, count, limit, offset },
    schema: {...}  // if requested
  }

GET /_api/:table/:id
  Query: Same as above
  Response: { success: true, row: {...} }
```

### Page Routes (`/`)

```
GET /
  Response: Homepage (slug='index')

GET /:slug
  Query: ?debug=1 (show JSON instead of HTML)
  Response: Rendered page with sections
  Uses: PageService + TemplateService
```

---

## Security Considerations

### Current State (Development)

⚠️ **WARNING**: The following are NOT production-ready:

- **Passwords in plaintext** - bcrypt installed but not active
- **Default JWT_SECRET** - Change in production
- **Cookies not secure** - HTTP allowed (not HTTPS only)
- **No rate limiting** - Vulnerable to brute force
- **No input sanitization** - XSS/injection risks

### Production Checklist

Before deploying to production:

- [ ] **Enable bcrypt password hashing**
  ```javascript
  // In routes/auth.js, replace:
  if (user.password !== password)  // ❌ Current

  // With:
  const valid = await bcrypt.compare(password, user.password);  // ✅ Production
  ```

- [ ] **Change JWT_SECRET in .env**
  ```bash
  # Generate secure secret:
  node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
  ```

- [ ] **Enable secure cookies**
  ```javascript
  // In authService.js:
  res.cookie('token', token, {
    httpOnly: true,
    secure: true,  // ✅ Enable in production
    sameSite: 'strict'
  });
  ```

- [ ] **Add rate limiting**
  ```javascript
  const rateLimit = require('express-rate-limit');

  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5 // 5 attempts
  });

  router.post('/login', loginLimiter, ...);
  ```

- [ ] **Input validation & sanitization**
  ```javascript
  const { body, validationResult } = require('express-validator');

  router.post('/create', [
    body('email').isEmail().normalizeEmail(),
    body('name').trim().escape()
  ], ...);
  ```

- [ ] **SQL injection protection** (already in place via parameterized queries ✅)

- [ ] **Add HTTPS/TLS**

- [ ] **Environment-specific configs**

### Permission Checking Best Practices

**Always check permissions before data access:**

```javascript
// ✅ Correct pattern
router.get('/:table/:id', async (req, res) => {
  // 1. Check table permission
  if (!PermissionService.hasPermission(req.user, req.params.table, 'read')) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 2. Check row permission
  const canAccess = await EntityService.canAccessEntity(
    req.user,
    req.params.table,
    req.params.id
  );
  if (!canAccess) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // 3. Get filtered data (field-level permissions applied)
  const data = await EntityService.getWithPermissions(
    req.params.table,
    req.params.id,
    req.user
  );

  res.json({ success: true, data });
});
```

---

## Troubleshooting

### Common Issues

#### Issue 1: "Cannot set headers after they are sent"

**Cause**: Response sent multiple times (fixed in pages_refactored.js)

**Solution**: Check for early `res.send()` or `res.json()` calls
```javascript
// ❌ Bad
res.send('hello');
// ... more code ...
res.json({ data }); // Error!

// ✅ Good
return res.json({ data }); // Use return
```

#### Issue 2: Database table not syncing

**Cause**: Schema definition error or DB connection issue

**Solution**:
1. Check schema.js syntax
2. Restart server (syncs on startup)
3. Check logs for SQL errors
4. Manually run: `node services/dbSyncService.js`

#### Issue 3: Permission denied but should have access

**Cause**: Role inheritance not working or granted value incorrect

**Solution**:
1. Check role hierarchy in schema.js:15-24
2. Verify user roles: `GET /_user/me`
3. Check effective roles:
   ```javascript
   const allRoles = PermissionService.getUserAllRoles(user);
   console.log(allRoles); // Should include inherited roles
   ```
4. Verify table granted config in schema.js

#### Issue 4: Relations not loading

**Cause**: Incorrect relation configuration or query parameter

**Solution**:
1. Check schema.js relation definition:
   ```javascript
   field: {
     relation: "TargetTable",  // Must match exact table name
     foreignKey: "id",
     relationshipStrength: "Strong"
   }
   ```
2. Use correct query parameter:
   ```
   /_api/Project?relation=all  // Load all relations
   /_api/Project?relation=Organization,Person  // Specific relations
   ```

#### Issue 5: JWT token invalid

**Cause**: Token expired, secret changed, or cookie not sent

**Solution**:
1. Check JWT_SECRET in .env matches when token was created
2. Token expires after 24h (default)
3. Ensure cookie is sent in request
4. Clear cookie and re-login

### Debugging Tools

**Enable debug mode:**
```javascript
// In routes
console.log('User:', req.user);
console.log('Permissions:', PermissionService.getUserAllRoles(req.user));
```

**Check database:**
```bash
# Connect to MySQL
mysql -u root -p schema2

# View tables
SHOW TABLES;

# View user roles
SELECT id, email, roles FROM Person;

# View permissions
DESCRIBE Person;
```

**API debug endpoint:**
```
GET /:slug?debug=1
# Returns JSON instead of HTML
```

---

## Additional Resources

### Documentation Files

- **README.md**: Project overview (French)
- **REFACTORING_PHASE2.md**: Phase 2 refactoring details (917 → 185 lines)
- **CROSS_REFERENCE.md**: Comprehensive cross-reference (940 lines)
- **SERVICES_API.md**: Services API documentation
- **SERVICES_STATS.md**: Services statistics

### External Documentation

- [Express.js](https://expressjs.com/)
- [MySQL2](https://github.com/sidorares/node-mysql2)
- [JSON Web Tokens](https://jwt.io/)
- [Mustache.js](https://github.com/janl/mustache.js)

### Architecture Patterns

- **Service Layer Pattern**: Business logic in services
- **Repository Pattern**: Data access in repositoryService
- **Middleware Pattern**: Authentication, enrichment
- **Schema-Driven**: Configuration over code

---

## Quick Reference Card

### Starting the App

```bash
npm install              # Install dependencies
npm run dev              # Development (nodemon)
npm start                # Production
```

### Key URLs

```
http://localhost:3000/                    # Homepage
http://localhost:3000/_user/login         # Login
http://localhost:3000/_user/me            # Current user
http://localhost:3000/_crud/Person        # CRUD interface
http://localhost:3000/_api/Person         # JSON API
```

### Environment Variables (.env)

```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=schema2
DB_PORT=8889
DB_TIMEZONE=+00:00
JWT_SECRET=dev-secret-key-change-in-production
UPLOADS_DIR=./uploads
```

### Role Hierarchy (Lowest to Highest)

```
public → member → premium → promo/road → admin → dir → dev
```

### Permission Actions

```javascript
["read", "create", "update", "delete", "publish"]
```

### Granted Values (Row-Level)

```
"draft"              // Only owner
"shared"             // Table permissions apply
"published @role"    // Role and descendants
```

---

## Version History

- **v2.0.0** (2025-11-13): Phase 2 refactoring - Service layer extraction
- **v1.0.0**: Initial release with CRUD and RBAC

---

## Contact & Support

For questions about this codebase, consult:
1. This CLAUDE.md file
2. CROSS_REFERENCE.md for detailed function references
3. REFACTORING_PHASE2.md for recent changes
4. Schema.js for configuration

---

**End of CLAUDE.md**
