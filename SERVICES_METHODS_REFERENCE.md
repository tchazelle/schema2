# SERVICES METHODS REFERENCE

> **Date**: 2025-11-14
> **Purpose**: Complete reference of all available methods in all services

This document lists ALL available methods for each service in the Schema2 project. Use this as a reference to avoid calling non-existent methods.

---

## 1. SchemaService (`services/schemaService.js`)

### Available Methods:

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `getTableName` | `(tableName: string)` | `string\|null` | Finds exact table name (case-insensitive) |
| `tableExists` | `(tableName: string)` | `boolean` | Checks if table exists in schema |
| `getTableConfig` | `(tableName: string)` | `Object\|null` | Gets complete table configuration |
| `getTableRelations` | `(user: Object, tableName: string)` | `Object` | Loads N:1 and 1:N relations |
| `buildFilteredSchema` | `(user: Object, tableName: string)` | `Object` | Builds filtered schema based on permissions |
| `getAllTableNames` | `()` | `Array<string>` | Gets list of all table names |
| `getDisplayFields` | `(tableName: string)` | `Array<string>\|null` | Gets display fields for a table |
| `fieldExists` | `(tableName: string, fieldName: string)` | `boolean` | Checks if field exists in table |
| `getFieldConfig` | `(tableName: string, fieldName: string)` | `Object\|null` | Gets field configuration |
| `getTableStructure` | `(user: Object, tableName: string)` | `Object\|null` | Gets complete table structure with permissions |

### ❌ Non-Existent Methods (DO NOT USE):
- ~~`getTableSchema()`~~ → Use `getTableConfig()` instead
- ~~`getFieldDefinition()`~~ → Use `getFieldConfig()` instead
- ~~`validateField()`~~ → Not implemented
- ~~`getSchema()`~~ → Use `getTableConfig()` instead

---

## 2. PermissionService (`services/permissionService.js`)

### Available Methods:

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `getInheritedRoles` | `(role: string, inherited?: Set)` | `Array` | Gets all inherited roles recursively |
| `parseUserRoles` | `(userRoles: string\|Array)` | `Array` | Parses user roles from string or array |
| `getUserAllRoles` | `(user: Object)` | `Array` | Gets all user roles including inheritance |
| `hasPermission` | `(user: Object, tableName: string, action: string)` | `boolean` | Checks if user has permission for action |
| `getAllPermissions` | `(user: Object)` | `Object` | Gets all permissions organized by table/action |
| `getAccessibleTables` | `(user: Object)` | `Array` | Gets tables accessible to user (read permission) |

### ❌ Non-Existent Methods (DO NOT USE):
- ~~`checkPermission()`~~ → Use `hasPermission()` instead
- ~~`canAccess()`~~ → Use `hasPermission()` instead
- ~~`getUserRoles()`~~ → Use `getUserAllRoles()` instead

---

## 3. EntityService (`services/entityService.js`)

### Available Methods:

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `canAccessEntity` | `(user: Object, tableName: string, entity: Object)` | `boolean` | Checks if user can access entity based on granted |
| `filterEntityFields` | `(user: Object, tableName: string, entity: Object)` | `Object` | Filters entity fields based on permissions |
| `buildWhereClause` | `(user: Object, baseWhere?: string)` | `Object` | Builds WHERE clause for granted filtering |
| `compactRelation` | `(relatedEntity: Object, relatedTable: string)` | `Object` | Reduces relation to compact version (displayFields only) |
| `canPerformAction` | `(user: Object, tableName: string, action: string, entity?: Object)` | `boolean` | Checks if user can perform CRUD action |
| `filterAccessibleEntities` | `(user: Object, tableName: string, entities: Array)` | `Array` | Filters list to accessible entities only |

### ❌ Non-Existent Methods (DO NOT USE):
- ~~`canAccessRow()`~~ → Use `canAccessEntity()` instead
- ~~`canAccessPage()`~~ → Use `canAccessEntity()` instead
- ~~`canAccessSection()`~~ → Use `canAccessEntity()` instead
- ~~`filterFields()`~~ → Use `filterEntityFields()` instead

---

## 4. AuthService (`services/authService.js`)

### Available Methods:

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `generateToken` | `(user: Object)` | `string` | Generates JWT token for user |
| `verifyToken` | `(token: string)` | `Object\|null` | Verifies and decodes JWT token |
| `authMiddleware` | `(req, res, next)` | `void` | Middleware to extract user from JWT cookie |
| `requireAuth` | `(req, res, next)` | `void` | Middleware to protect routes (requires auth) |
| `setAuthCookie` | `(res: Object, token: string)` | `void` | Creates authentication cookie |
| `clearAuthCookie` | `(res: Object)` | `void` | Removes authentication cookie |
| `userEnrich` | `(user: Object\|null)` | `Object` | Enriches user data with computed fields |
| `userEnrichMiddleware` | `(req, res, next)` | `void` | Middleware to enrich req.user |

### Constants:
- `COOKIE_MAX_AGE` - Cookie expiration time in seconds

### ❌ Non-Existent Methods (DO NOT USE):
- ~~`login()`~~ → Handle in routes, use `generateToken()` and `setAuthCookie()`
- ~~`logout()`~~ → Use `clearAuthCookie()` instead
- ~~`authenticate()`~~ → Use `authMiddleware` instead

---

## 5. TableDataService (`services/tableDataService.js`)

### Available Methods:

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `getTableData` | `(user: Object, tableName: string, options?: Object)` | `Promise<Object>` | Gets table data with relations and filters |
| `loadRelationsForRow` | `(user: Object, tableName: string, row: Object, options?: Object)` | `Promise<Object>` | Loads relations for a single row |

### Options for `getTableData()`:
```javascript
{
  id?: number,              // Specific ID to fetch
  limit?: number,           // Max results
  offset?: number,          // Pagination offset
  orderBy?: string,         // Sort field
  order?: string,           // ASC/DESC
  customWhere?: string,     // Custom WHERE clause
  relation?: string,        // 'all', 'default', or CSV list
  includeSchema?: string,   // '1' to include schema
  compact?: boolean,        // Compact relations
  useProxy?: boolean,       // Use data proxy
  noSystemFields?: boolean, // Remove system fields
  noId?: boolean           // Remove ID fields
}
```

### ❌ Non-Existent Methods (DO NOT USE):
- ~~`getData()`~~ → Use `getTableData()` instead
- ~~`loadRelations()`~~ → Use `loadRelationsForRow()` instead
- ~~`fetchTableData()`~~ → Use `getTableData()` instead

---

## 6. CrudService (`services/crudService.js`)

### Available Methods:

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `getListData` | `(user: Object, tableName: string, options?: Object)` | `Promise<Object>` | Gets complete list data for CRUD interface |
| `getRecordDetails` | `(user: Object, tableName: string, id: number)` | `Promise<Object>` | Gets single record with full details |
| `getVisibleFields` | `(user: Object, table: string, showSystemFields?: boolean, selectedFields?: Array)` | `Array` | Gets visible fields based on permissions |
| `getSearchableFields` | `(user: Object, table: string)` | `Array` | Gets searchable text fields |
| `removeAccents` | `(text: string)` | `string` | Removes French accents from text |
| `formatFieldValue` | `(value: any, field: Object, country?: string)` | `Object` | Formats field value with renderer |
| `getMenuTables` | `(user: Object)` | `Array` | Gets tables user can create/update in |

### ❌ Non-Existent Methods (DO NOT USE):
- ~~`getList()`~~ → Use `getListData()` instead
- ~~`getRecord()`~~ → Use `getRecordDetails()` instead
- ~~`getFields()`~~ → Use `getVisibleFields()` instead

---

## 7. PageService (`services/pageService.js`)

### Available Methods:

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `pagesLoad` | `(user: Object)` | `Promise<Array>` | Loads all pages from Page table |
| `buildSectionsAsTableData` | `(user: Object, sections: Array)` | `Promise<Array>` | Builds sections with data from getTableData |
| `pageRender` | `(user: Object, slug: string, options?: Object)` | `Promise<string>` | Renders complete page with sections |

### ❌ Non-Existent Methods (DO NOT USE):
- ~~`getPage()`~~ → Use `pageRender()` instead
- ~~`loadSections()`~~ → Use `buildSectionsAsTableData()` instead
- ~~`renderPage()`~~ → Use `pageRender()` instead

---

## 8. RepositoryService (`services/repositoryService.js`)

### Available Methods:

| Method | Signature | Returns | Description |
|--------|-----------|---------|-------------|
| `findById` | `(tableName: string, id: number)` | `Promise<Object\|null>` | Finds record by ID |
| `findByIds` | `(tableName: string, ids: Array<number>)` | `Promise<Array>` | Finds multiple records by IDs |
| `findAll` | `(tableName: string, options?: Object)` | `Promise<Array>` | Finds all records with filters |
| `findOne` | `(tableName: string, where: string, params?: Array)` | `Promise<Object\|null>` | Finds one record by condition |
| `count` | `(tableName: string, where?: string, params?: Array)` | `Promise<number>` | Counts records |
| `create` | `(tableName: string, data: Object)` | `Promise<Object>` | Creates new record |
| `update` | `(tableName: string, id: number, data: Object)` | `Promise<Object>` | Updates record by ID |
| `updateWhere` | `(tableName: string, data: Object, where: string, params?: Array)` | `Promise<Object>` | Updates records by condition |
| `delete` | `(tableName: string, id: number)` | `Promise<number>` | Deletes record by ID |
| `deleteWhere` | `(tableName: string, where: string, params?: Array)` | `Promise<number>` | Deletes records by condition |
| `findByForeignKey` | `(tableName: string, foreignKey: string, foreignValue: number, options?: Object)` | `Promise<Array>` | Finds records by foreign key |
| `raw` | `(query: string, params?: Array)` | `Promise<Array>` | Executes raw SQL query |
| `exists` | `(tableName: string, id: number)` | `Promise<boolean>` | Checks if record exists |
| `transaction` | `(callback: Function)` | `Promise<any>` | Executes transaction |

### ❌ Non-Existent Methods (DO NOT USE):
- ~~`find()`~~ → Use `findById()`, `findOne()`, or `findAll()`
- ~~`insert()`~~ → Use `create()` instead
- ~~`remove()`~~ → Use `delete()` instead
- ~~`query()`~~ → Use `raw()` instead

---

## 9. TemplateService (`services/templateService.js`)

This service is not fully audited yet, but key methods include:

### Known Methods:
- `htmlSitePage(options)` - Renders complete site page with navigation
- `htmlCrudPage(options)` - Renders CRUD interface page
- `htmlSection(section)` - Renders a section with data
- `htmlDebugJSON(data)` - Renders debug JSON view
- `htmlLogin()` - Renders login page
- `htmlRow(row, level)` - Internal method for rendering rows (used by htmlDebugJSON)

---

## Common Mistakes & Corrections

### ❌ SchemaService Issues

```javascript
// ❌ WRONG - Method doesn't exist
const schema = SchemaService.getTableSchema('Person');
const field = SchemaService.getFieldDefinition('Person', 'name');

// ✅ CORRECT
const schema = SchemaService.getTableConfig('Person');
const field = SchemaService.getFieldConfig('Person', 'name');
```

### ❌ Permission Checking

```javascript
// ❌ WRONG - Method doesn't exist
const canRead = PermissionService.checkPermission(user, 'Person', 'read');

// ✅ CORRECT
const canRead = PermissionService.hasPermission(user, 'Person', 'read');
```

### ❌ Entity Access

```javascript
// ❌ WRONG - Old methods
const canAccess = EntityService.canAccessRow(user, 'Person', row);
const canAccess = EntityService.canAccessPage(user, 'Page', page);

// ✅ CORRECT - Unified method
const canAccess = EntityService.canAccessEntity(user, 'Person', row);
const canAccess = EntityService.canAccessEntity(user, 'Page', page);
```

### ❌ Table Data Retrieval

```javascript
// ❌ WRONG - Method doesn't exist
const data = await TableDataService.getData(user, 'Person');
const data = await TableDataService.fetchTableData(user, 'Person');

// ✅ CORRECT
const data = await TableDataService.getTableData(user, 'Person', options);
```

---

## How to Use This Reference

1. **Before calling a service method**: Check this document first
2. **If method not found**: Read the service file directly to see available methods
3. **Update this document**: When new methods are added to services
4. **Report issues**: If you find incorrect information in this reference

---

## Quick Lookup by Task

| Task | Service | Method |
|------|---------|--------|
| Get table configuration | `SchemaService` | `getTableConfig(tableName)` |
| Check permissions | `PermissionService` | `hasPermission(user, table, action)` |
| Get user roles | `PermissionService` | `getUserAllRoles(user)` |
| Check entity access | `EntityService` | `canAccessEntity(user, table, entity)` |
| Get table data | `TableDataService` | `getTableData(user, table, options)` |
| Get CRUD list | `CrudService` | `getListData(user, table, options)` |
| Render page | `PageService` | `pageRender(user, slug, options)` |
| Database query | `RepositoryService` | `findById()`, `findAll()`, etc. |
| Generate JWT | `AuthService` | `generateToken(user)` |

---

## Version History

- **2025-11-14**: Initial creation - Complete audit of all services

---

**End of Reference**
