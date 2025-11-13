# 📚 API Documentation - Services

Documentation complète de tous les services avec signatures de fonctions.

---

## 🔐 authService.js

**Gestion de l'authentification JWT et des cookies**

```javascript
generateToken(user) → string                                    // Génère un token JWT
verifyToken(token) → Object|null                               // Vérifie et décode un token JWT
authMiddleware(req, res, next) → void                          // Middleware Express d'authentification
requireAuth(req, res, next) → void                             // Middleware de protection de route
setAuthCookie(res, token) → void                               // Crée un cookie d'authentification
clearAuthCookie(res) → void                                    // Supprime le cookie d'authentification
```

**Constantes:**
- `COOKIE_MAX_AGE` - Durée de vie du cookie (défaut: 400 jours)

---

## 🔑 permissionService.js

**Gestion des permissions et rôles avec héritage**

```javascript
getInheritedRoles(role, inherited = new Set()) → Array         // Récupère tous les rôles hérités (récursif)
parseUserRoles(userRoles) → Array                              // Parse les rôles depuis string ou array
getUserAllRoles(user) → Array                                  // Obtient tous les rôles d'un user (avec héritage)
hasPermission(user, tableName, action) → boolean               // Vérifie si user a permission sur table/action
getAllPermissions(user) → Object                               // Récupère toutes les permissions par table
getAccessibleTables(user) → Array                              // Retourne les tables accessibles (read)
```

**Actions supportées:** `read`, `create`, `update`, `delete`, `publish`

---

## 📊 tableDataService.js

**Récupération de données avec relations et filtres**

```javascript
loadRelationsForRow(user, tableName, row, options) → Object    // Charge les relations d'une row (récursif)
  // options: { requestedRelations: Array, loadN1InRelations: boolean, compact: boolean }

getTableData(user, tableName, options) → Object                // Récupère données table avec relations
  // options: { id, limit, offset, orderBy, order, customWhere, relation, includeSchema, compact }
  // Retourne: { success, table, rows, pagination, schema? }
```

**Relations supportées:**
- N:1 (many-to-one) - Champs avec FK
- 1:N (one-to-many) - Relations inverses

---

## 🗂️ schemaService.js

**Manipulation et interrogation du schéma de base de données**

```javascript
SchemaService.getTableName(tableName) → string|null            // Trouve le nom exact (case-insensitive)
SchemaService.tableExists(tableName) → boolean                 // Vérifie existence d'une table
SchemaService.getTableConfig(tableName) → Object|null          // Obtient config complète d'une table
SchemaService.getTableRelations(user, tableName) → Object      // Charge relations N:1 et 1:N
  // Retourne: { relationsN1: {}, relations1N: {} }

SchemaService.buildFilteredSchema(user, tableName) → Object    // Construit schéma filtré selon permissions
SchemaService.getAllTableNames() → Array                       // Liste tous les noms de tables
SchemaService.getDisplayFields(tableName) → Array|null         // Obtient displayFields d'une table
SchemaService.fieldExists(tableName, fieldName) → boolean      // Vérifie existence d'un champ
SchemaService.getFieldConfig(tableName, fieldName) → Object|null // Config d'un champ
SchemaService.getTableStructure(user, tableName) → Object|null // Structure complète avec permissions
```

---

## 🎯 entityService.js

**Gestion des entités avec permissions et filtrage**

```javascript
EntityService.canAccessEntity(user, tableName, entity) → boolean        // Vérifie accès selon granted
EntityService.filterEntityFields(user, tableName, entity) → Object      // Filtre champs selon permissions
EntityService.buildWhereClause(user, baseWhere = null) → Object         // Construit WHERE avec granted
  // Retourne: { where: string, params: Array }

EntityService.compactRelation(relatedEntity, relatedTable) → Object     // Réduit relation à displayFields
EntityService.canPerformAction(user, tableName, action, entity) → boolean // Vérifie CRUD action
EntityService.filterAccessibleEntities(user, tableName, entities) → Array // Filtre liste d'entités
```

**Valeurs granted supportées:**
- `draft` - Accessible uniquement par le propriétaire
- `shared` - Selon permissions de la table
- `published @role` - Selon le rôle spécifié
- `null`/`''` - Public

---

## 📄 pageService.js

**Gestion des pages dynamiques et sections**

```javascript
PageService.getPageBySlug(slug, user) → Object|null            // Récupère une page par slug
  // Retourne: { id, slug, title, template, sections, ... }

PageService.getPageSections(pageId, user) → Array              // Récupère sections d'une page
  // Retourne: Array<{ id, pageId, sqlTable, sqlWhere, ... }>

PageService.loadSectionData(section, user) → Object            // Charge données d'une section
  // Retourne: { rows, pagination, schema? }
```

---

## 🎨 templateService.js

**Génération de templates HTML pour le rendu**

```javascript
TemplateService.htmlLogin() → string                   // Génère formulaire de connexion
TemplateService.scriptHumanize() → string              // Script pour humaniser dates/durées
TemplateService.htmlSitePage(options) → string             // Génère page d'accueil
  // options: { user, accessibleTables, schema, ... }
```

---

## 📦 Dépendances entre services

```
authService          → (aucune)
permissionService    → schema.js
repositoryService    → config/database
dbSyncService        → config/database, schema.js
schemaService        → permissionService
entityService        → permissionService, schemaService, constants/permissions
tableDataService     → permissionService, schemaService, entityService, repositoryService
pageService          → tableDataService, schemaService, permissionService
templateService      → schema.js
```

---

## 🔧 Utils (helpers purs)

### dataProxy.js
```javascript
dataProxy(data) → Proxy                                        // Proxyfie _relations pour accès direct
```

### buildUrl.js
```javascript
buildUrl(base, params) → string                                // Construit URL avec query params
```

### mustacheAuto.js
```javascript
mustacheAuto(tableName, options) → string                      // Génère template Mustache auto depuis schéma
MustacheTemplateGenerator.generateTemplate(tableName) → string // Classe de génération
```

### dbSync.js
```javascript
syncDatabase() → Promise                                       // Synchronise DB avec schema.js
```

---

## 🗄️ repositoryService.js

**Pattern Repository pour centraliser les requêtes SQL**

```javascript
RepositoryService.findById(tableName, id) → Promise<Object|null>                          // Récupère un enregistrement par ID
RepositoryService.findByIds(tableName, ids) → Promise<Array>                             // Récupère plusieurs enregistrements
RepositoryService.findAll(tableName, options) → Promise<Array>                           // Récupère tous les enregistrements
  // options: { where, params, orderBy, order, limit, offset }

RepositoryService.findOne(tableName, where, params) → Promise<Object|null>               // Récupère un seul enregistrement
RepositoryService.count(tableName, where, params) → Promise<number>                      // Compte les enregistrements
RepositoryService.create(tableName, data) → Promise<Object>                              // Crée un enregistrement
  // Retourne: { insertId, affectedRows }

RepositoryService.update(tableName, id, data) → Promise<Object>                          // Met à jour par ID
  // Retourne: { affectedRows, changedRows }

RepositoryService.updateWhere(tableName, data, where, whereParams) → Promise<Object>     // Met à jour avec condition
RepositoryService.delete(tableName, id) → Promise<number>                                // Supprime par ID
RepositoryService.deleteWhere(tableName, where, params) → Promise<number>                // Supprime avec condition
RepositoryService.findByForeignKey(tableName, foreignKey, foreignValue, options) → Promise<Array> // Trouve par FK
RepositoryService.exists(tableName, id) → Promise<boolean>                               // Vérifie existence
RepositoryService.raw(query, params) → Promise<Array>                                    // Requête SQL brute
RepositoryService.transaction(callback) → Promise<any>                                   // Exécute une transaction
```

**Avantages:**
- Centralisation SQL (facilite tests)
- Abstraction DB (changement de driver facilité)
- API uniforme pour toutes les tables

---

## 🔄 dbSyncService.js

**Synchronisation de la base de données avec schema.js**

```javascript
syncDatabase() → Promise<void>                                   // Synchronise DB avec schema.js
  // Crée/met à jour tables, colonnes, indexes selon schema.js
```

**Fonctionnalités:**
- Création automatique des tables
- Ajout de colonnes manquantes
- Mise à jour des types de colonnes
- Gestion des indexes et FK

---

## 📝 Conventions

### Paramètres communs
- `user` - Object avec `{ id, email, roles, ... }`
- `tableName` - String (nom de la table)
- `entity` - Object (row de DB avec granted, ownerId, etc.)
- `options` - Object avec paramètres optionnels

### Retours communs
- Fonctions sync → `boolean` | `Object` | `Array` | `null`
- Fonctions async → `Promise<Object>` | `Promise<Array>`
- Erreurs → `{ status: number, error: string }`

---

**Dernière mise à jour:** Phase 3 (commit en cours)

## 🎯 Notes Phase 3

**RepositoryService** introduit le pattern Repository pour:
- ✅ Centraliser toutes les requêtes SQL
- ✅ Faciliter les tests unitaires (mockable)
- ✅ Uniformiser l'accès aux données
- ✅ Préparer une future migration de DB driver

**dbSyncService** déplacé de utils/ vers services/ car:
- Logique métier (synchronisation DB)
- Dépendances avec schema.js et config/database
- Cohérence avec l'architecture finale
