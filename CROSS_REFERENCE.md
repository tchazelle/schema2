# Référence Croisée du Projet Schema2

## Vue d'ensemble

**Schema2** est un système de gestion de contenu (CMS) Node.js avec interface CRUD dynamique, authentification JWT et contrôle d'accès basé sur les rôles (RBAC).

---

## 1. Structure du Projet

```
schema2/
├── config/                     # Configuration
├── routes/                     # Routeurs Express
├── utils/                      # Utilitaires et services
│   └── services/              # Couche de services (Phase 2)
├── public/                     # Assets statiques
│   ├── js/                    # JavaScript client
│   └── css/                   # Feuilles de style
├── constants/                  # Constantes applicatives
├── schema.js                   # Configuration centrale
└── server.js                   # Point d'entrée
```

---

## 2. Fichiers Principaux et Lignes de Code

### 2.1 Configuration et Entrée

| Fichier | Lignes | Description | Références |
|---------|--------|-------------|------------|
| `server.js` | 108 | Point d'entrée Express | → `config/database.js`, `routes/*`, `utils/auth.js` |
| `schema.js` | 340 | Configuration centrale | ← Référencé par tous les modules |
| `config/database.js` | 28 | Pool de connexion MySQL | ← `server.js`, `routes/*`, `utils/*` |

### 2.2 Routes (Contrôleurs)

| Fichier | Lignes | Objets Principaux | Références |
|---------|--------|-------------------|------------|
| **`routes/auth.js`** | 87 | • `POST /login`<br>• `POST /logout`<br>• `GET /me` | → `utils/auth.js`<br>→ `utils/permissions.js`<br>→ `config/database.js` |
| **`routes/crud.js`** | 500+ | • `GET /crud/:table`<br>• `POST /crud/:table`<br>• `PUT /crud/:table/:id`<br>• `DELETE /crud/:table/:id` | → `schema.js`<br>→ `utils/permissions.js`<br>→ `utils/services/schemaService.js` |
| **`routes/api.js`** | 500+ | • `GET /api/:table`<br>• `POST /api/:table`<br>• `PUT /api/:table/:id`<br>• `DELETE /api/:table/:id` | → `schema.js`<br>→ `utils/apiTables.js`<br>→ `utils/permissions.js` |
| **`routes/pages.js`** | 917 | • `GET /` (home)<br>• `GET /:slug` (pages dynamiques) | → `schema.js`<br>→ `utils/mustacheAuto.js`<br>→ `config/database.js`<br>⚠️ **Legacy - À refactorer** |
| **`routes/pages_refactored.js`** | 185 | • `GET /` (home)<br>• `GET /:slug` (pages dynamiques) | → `utils/services/pageService.js`<br>→ `utils/services/templateService.js`<br>✅ **Version refactorisée (-80% lignes)** |

### 2.3 Utilitaires Core

| Fichier | Lignes | Fonctions Principales | Références |
|---------|--------|----------------------|------------|
| **`utils/auth.js`** | 99 | • `generateToken(user)`: 15-28<br>• `verifyToken(token)`: 30-42<br>• `authMiddleware(req, res, next)`: 44-99 | ← `routes/auth.js`<br>← `server.js` (middleware)<br>→ `jsonwebtoken` |
| **`utils/permissions.js`** | 168 | • `getUserAllRoles(user)`: 20-35<br>• `hasPermission(user, table, action)`: 50-90<br>• `getAccessibleTables(user)`: 120-145<br>• `checkEntityAccess(user, table, entityId)`: 147-168 | ← Tous les routes<br>← Services<br>→ `schema.js`<br>→ `constants/permissions.js` |
| **`utils/dbSync.js`** | 200+ | • `syncDatabase(pool)`: 10-200<br>• `createTable(pool, tableName, schema)`: 50-100<br>• `alterTable(pool, tableName, changes)`: 102-150 | ← `server.js` (au démarrage)<br>→ `schema.js`<br>→ `config/database.js` |
| **`utils/dataProxy.js`** | 200+ | • `applyProxy(data, proxyConfig)`: 10-50<br>• `transformData(row, fields)`: 52-100<br>• `filterByPermission(data, user)`: 102-150 | ← `routes/api.js`<br>← `routes/crud.js`<br>→ `schema.js` |
| **`utils/buildUrl.js`** | ~50 | • `buildUrl(base, params)`: 10-30<br>• `buildApiUrl(table, id, query)`: 32-50 | ← `routes/*`<br>← `utils/services/*` |
| **`utils/mustacheAuto.js`** | ~150 | • `renderTemplate(template, data, partials)`: 10-50<br>• `loadTemplate(path)`: 52-80<br>• `processTemplateData(data)`: 82-150 | ← `routes/pages.js` (legacy)<br>→ `mustache` |
| **`utils/apiTables.js`** | ~200 | • `getTableData(pool, table, filters)`: 10-70<br>• `insertRow(pool, table, data)`: 72-120<br>• `updateRow(pool, table, id, data)`: 122-170<br>• `deleteRow(pool, table, id)`: 172-200 | ← `routes/api.js`<br>→ `config/database.js`<br>→ `schema.js` |

### 2.4 Couche Services (Phase 2 Refactoring)

| Fichier | Lignes | Fonctions Principales | Références |
|---------|--------|----------------------|------------|
| **`utils/services/pageService.js`** | ~200 | • `loadPageData(slug, user)`: 10-80<br>• `loadSectionsByPageId(pageId, user)`: 82-140<br>• `filterSectionsByPermission(sections, user)`: 142-180<br>• `enrichSectionsWithData(sections)`: 182-200 | ← `routes/pages_refactored.js`<br>→ `config/database.js`<br>→ `utils/permissions.js`<br>→ `schemaService.js` |
| **`utils/services/entityService.js`** | ~250 | • `checkEntityAccess(user, table, entityId)`: 10-60<br>• `filterEntitiesByAccess(entities, user, table)`: 62-120<br>• `getEntityWithPermissions(table, id, user)`: 122-180<br>• `validateEntityData(table, data)`: 182-250 | ← `routes/crud.js`<br>← `routes/api.js`<br>← `pageService.js`<br>→ `config/database.js`<br>→ `utils/permissions.js` |
| **`utils/services/schemaService.js`** | ~400 | • `getTableSchema(tableName)`: 10-40<br>• `getTableFields(tableName)`: 42-80<br>• `getFieldDefinition(table, field)`: 82-110<br>• `getRelatedTables(tableName)`: 112-160<br>• `buildQueryFromSchema(table, filters)`: 162-250<br>• `validateFieldValue(field, value)`: 252-300<br>• `getAllTablesForUser(user)`: 302-350<br>• `getTableActions(table, user)`: 352-400 | ← Tous les services<br>← Tous les routes<br>→ `schema.js`<br>→ `utils/permissions.js` |
| **`utils/services/templateService.js`** | ~680 | • `generateLoginForm()`: 10-80<br>• `generateHomePage(user, pages)`: 82-180<br>• `generateNavigationMenu(user)`: 182-250<br>• `generateUserMenu(user)`: 252-300<br>• `generateCRUDForm(table, data, action)`: 302-450<br>• `generateTableView(table, rows, user)`: 452-550<br>• `generatePageScripts()`: 552-620<br>• `generateCommonStyles()`: 622-680 | ← `routes/pages_refactored.js`<br>← `routes/crud.js`<br>→ `schema.js`<br>→ `public/css/*` (inline) |

### 2.5 Constantes

| Fichier | Lignes | Objets Principaux | Références |
|---------|--------|-------------------|------------|
| **`constants/permissions.js`** | 58 | • `PERMISSIONS`: 5-20<br>&nbsp;&nbsp;- `READ`, `CREATE`, `UPDATE`, `DELETE`, `PUBLISH`<br>• `GRANTED_VALUES`: 22-35<br>&nbsp;&nbsp;- `FALSE`, `LOGIN`, `SELF`, `TRUE`<br>• `ROLES`: 37-50<br>&nbsp;&nbsp;- `public`, `member`, `premium`, `promo`, `road`, `admin`, `dir`, `dev`<br>• `exporté par`: 52-58 | ← `schema.js`<br>← `utils/permissions.js`<br>← Tous les modules utilisant les permissions |

### 2.6 Frontend (Client)

| Fichier | Lignes | Composants Principaux | Références |
|---------|--------|----------------------|------------|
| **`public/js/fieldSelectorUI.js`** | ~300 | • `FieldSelectorUI` (class): 1-300<br>&nbsp;&nbsp;- `constructor()`: 5-30<br>&nbsp;&nbsp;- `render()`: 32-100<br>&nbsp;&nbsp;- `handleSelection()`: 102-150<br>&nbsp;&nbsp;- `updatePreview()`: 152-200<br>&nbsp;&nbsp;- `saveSelection()`: 202-250<br>&nbsp;&nbsp;- `loadSelection()`: 252-300 | ← Chargé par `templateService.js`<br>→ DOM API<br>→ Fetch API |

### 2.7 CSS (Feuilles de Style Modulaires)

| Fichier | Lignes | Styles Principaux | Utilisé Par |
|---------|--------|-------------------|-------------|
| `public/css/common.css` | ~100 | • Reset CSS<br>• Typographie de base<br>• Layout général | Toutes les pages |
| `public/css/navigation.css` | ~80 | • Menu hamburger<br>• Navigation responsive<br>• Animations menu | En-têtes de pages |
| `public/css/login-form.css` | ~60 | • Formulaire de connexion<br>• Inputs stylisés<br>• Bouton submit | `routes/auth.js` (GET /login) |
| `public/css/user-menu.css` | ~70 | • Menu utilisateur popup<br>• Avatar/icône user<br>• Dropdown logout | En-têtes de pages connectées |
| `public/css/crud.css` | ~150 | • Tables CRUD<br>• Formulaires édition<br>• Boutons actions | `routes/crud.js` |
| `public/css/page.css` | ~90 | • Sections de page<br>• Layout dynamique<br>• Cards | `routes/pages*.js` |
| `public/css/forms.css` | ~120 | • Inputs génériques<br>• Selects<br>• Textareas<br>• Validation | Tous les formulaires |
| `public/css/buttons.css` | ~50 | • Boutons primaires<br>• Boutons secondaires<br>• États hover/active | Toutes les interfaces |
| `public/css/tables.css` | ~100 | • Tables responsive<br>• Headers fixes<br>• Zebra striping | CRUD et API lists |
| `public/css/modals.css` | ~80 | • Overlays modaux<br>• Dialogues<br>• Confirmations | Formulaires et actions |
| `public/css/responsive.css` | ~70 | • Media queries<br>• Mobile adaptations<br>• Tablet layouts | Toutes les pages |

---

## 3. Architecture et Flux de Données

### 3.1 Pipeline de Requête

```
Requête HTTP
    ↓
Express Server (server.js:1-108)
    ↓
authMiddleware (utils/auth.js:44-99)
    ↓ [Extraction JWT]
    ↓
Route Handler (routes/*.js)
    ↓
Service Layer (utils/services/*.js)
    ├─→ schemaService.js - Validation schéma
    ├─→ entityService.js - Contrôle d'accès
    ├─→ pageService.js - Chargement données
    └─→ templateService.js - Génération HTML
    ↓
Database Pool (config/database.js:1-28)
    ↓
MySQL Database
    ↓
Response (HTML ou JSON)
```

### 3.2 Système d'Authentification

```
POST /login (routes/auth.js:20-50)
    ↓
Vérification mot de passe (routes/auth.js:35-40)
    ↓
generateToken(user) (utils/auth.js:15-28)
    ↓
JWT Token → Cookie httpOnly
    ↓
Requêtes suivantes
    ↓
authMiddleware (utils/auth.js:44-99)
    ↓
verifyToken(token) (utils/auth.js:30-42)
    ↓
req.user enrichi
```

### 3.3 Système d'Autorisation (RBAC)

```
getUserAllRoles(user) (utils/permissions.js:20-35)
    ↓ [Héritage des rôles]
    ↓
hasPermission(user, table, action) (utils/permissions.js:50-90)
    ↓
Vérification schema.js
    ├─→ table.granted[role][action]
    └─→ GRANTED_VALUES (constants/permissions.js:22-35)
        • FALSE (0) → Refusé
        • LOGIN (1) → Si connecté
        • SELF (2) → Si propriétaire
        • TRUE (3) → Autorisé
    ↓
checkEntityAccess(user, table, entityId) (utils/permissions.js:147-168)
    ↓
Filtre au niveau entité
```

### 3.4 Hiérarchie des Rôles

```
schema.js (roles: lines 50-90)

dev (niveau 8) - Développeurs
    ↓ hérite de
dir (niveau 7) - Directeurs
    ↓ hérite de
admin (niveau 6) - Administrateurs
    ↓ hérite de
road (niveau 5) - Route managers
    ↓ hérite de
promo (niveau 5) - Promoteurs
    ↓ hérite de
premium (niveau 4) - Membres premium
    ↓ hérite de
member (niveau 3) - Membres
    ↓ hérite de
public (niveau 2) - Anonyme
```

---

## 4. Tables et Schémas

### 4.1 Tables Définies (schema.js:100-340)

| Table | Lignes | Champs Principaux | Permissions |
|-------|--------|-------------------|-------------|
| **Page** | 120-150 | `id`, `name`, `slug`, `layout` | `granted`: read (LOGIN), create (admin), update (admin), delete (dev) |
| **Section** | 152-200 | `id`, `page_id`, `title`, `template`, `table_name`, `query` | `granted`: read (LOGIN), create (admin), update (admin), delete (admin) |
| **Person** | 202-250 | `id`, `first_name`, `last_name`, `email`, `password`, `roles` | `granted`: read (LOGIN), update (SELF/admin), delete (dir) |
| **Organization** | 252-280 | `id`, `name`, `type`, `website` | `granted`: read (TRUE), create (member), update (admin) |
| **Project** | 282-305 | `id`, `title`, `description`, `organization_id`, `status` | `granted`: read (member), create (premium), update (promo/admin) |
| **Contrat** | 307-330 | `id`, `person_id`, `organization_id`, `start_date`, `end_date` | `granted`: read (SELF/admin), create (admin), update (admin) |
| **MusicAlbum** | 332-340 | `id`, `name`, `artist`, `release_date` | `granted`: read (TRUE), create (road), update (road/admin) |

### 4.2 Actions Supportées (schema.js:40-48)

```javascript
actions: {
  read: 'read',           // Lecture données
  create: 'create',       // Création nouvelle entrée
  update: 'update',       // Modification entrée existante
  delete: 'delete',       // Suppression entrée
  publish: 'publish'      // Publication (futures fonctionnalités)
}
```

---

## 5. Dépendances entre Modules

### 5.1 Modules Fondamentaux (Pas de dépendances internes)

```
config/database.js
constants/permissions.js
schema.js
```

### 5.2 Modules Niveau 1 (Dépendent des fondamentaux)

```
utils/auth.js
    → schema.js
    → jsonwebtoken

utils/permissions.js
    → schema.js
    → constants/permissions.js
    → config/database.js

utils/buildUrl.js
    → (aucune dépendance interne)
```

### 5.3 Modules Niveau 2 (Dépendent du Niveau 1)

```
utils/services/schemaService.js
    → schema.js
    → utils/permissions.js

utils/dbSync.js
    → schema.js
    → config/database.js

utils/apiTables.js
    → schema.js
    → config/database.js
    → utils/permissions.js
```

### 5.4 Modules Niveau 3 (Dépendent du Niveau 2)

```
utils/services/entityService.js
    → config/database.js
    → utils/permissions.js
    → utils/services/schemaService.js

utils/services/templateService.js
    → schema.js
    → public/css/* (inline)

utils/dataProxy.js
    → schema.js
    → utils/permissions.js
```

### 5.5 Modules Niveau 4 (Dépendent du Niveau 3)

```
utils/services/pageService.js
    → config/database.js
    → utils/permissions.js
    → utils/services/schemaService.js
    → utils/services/entityService.js
```

### 5.6 Routes (Niveau le plus élevé)

```
routes/auth.js
    → utils/auth.js
    → utils/permissions.js
    → config/database.js

routes/api.js
    → schema.js
    → utils/apiTables.js
    → utils/permissions.js
    → utils/dataProxy.js

routes/crud.js
    → schema.js
    → utils/permissions.js
    → utils/services/schemaService.js
    → utils/services/entityService.js
    → utils/services/templateService.js

routes/pages_refactored.js (✅ Version refactorisée)
    → utils/services/pageService.js
    → utils/services/templateService.js
    → utils/permissions.js

routes/pages.js (⚠️ Legacy)
    → schema.js
    → utils/mustacheAuto.js
    → config/database.js
    → utils/permissions.js
```

---

## 6. Fonctions Critiques par Module

### 6.1 Authentication & Authorization

#### `utils/auth.js`

```javascript
// Ligne 15-28: Génération JWT
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, roles: user.roles },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
}

// Ligne 30-42: Vérification JWT
function verifyToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// Ligne 44-99: Middleware d'authentification
function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch (err) {
    res.clearCookie('token');
    req.user = null;
    next();
  }
}
```

#### `utils/permissions.js`

```javascript
// Ligne 20-35: Récupération rôles hérités
function getUserAllRoles(user) {
  const directRoles = user?.roles || ['public'];
  const roleHierarchy = schema.roles;
  const allRoles = new Set(directRoles);

  directRoles.forEach(role => {
    const parentRoles = getParentRoles(role, roleHierarchy);
    parentRoles.forEach(r => allRoles.add(r));
  });

  return Array.from(allRoles);
}

// Ligne 50-90: Vérification permission
function hasPermission(user, tableName, action) {
  const table = schema.tables[tableName];
  if (!table) return false;

  const userRoles = getUserAllRoles(user);
  const grantedValue = table.granted;

  for (const role of userRoles) {
    const rolePermission = grantedValue[role]?.[action];
    if (rolePermission === GRANTED_VALUES.TRUE) return true;
    if (rolePermission === GRANTED_VALUES.LOGIN && user) return true;
  }

  return false;
}

// Ligne 147-168: Contrôle d'accès entité
async function checkEntityAccess(user, tableName, entityId) {
  const table = schema.tables[tableName];
  const userRoles = getUserAllRoles(user);

  // Vérifie si l'utilisateur a accès SELF
  const hasSelfAccess = userRoles.some(role =>
    table.granted[role]?.read === GRANTED_VALUES.SELF
  );

  if (hasSelfAccess) {
    const [rows] = await pool.query(
      `SELECT * FROM ${tableName} WHERE id = ? AND person_id = ?`,
      [entityId, user.id]
    );
    return rows.length > 0;
  }

  return hasPermission(user, tableName, 'read');
}
```

### 6.2 Services Layer

#### `utils/services/pageService.js`

```javascript
// Ligne 10-80: Chargement données page
async function loadPageData(slug, user) {
  // 1. Récupération page
  const [pages] = await pool.query(
    'SELECT * FROM Page WHERE slug = ?',
    [slug]
  );

  if (pages.length === 0) return null;
  const page = pages[0];

  // 2. Chargement sections
  const sections = await loadSectionsByPageId(page.id, user);

  // 3. Enrichissement avec données
  const enrichedSections = await enrichSectionsWithData(sections);

  return {
    page,
    sections: enrichedSections
  };
}

// Ligne 82-140: Chargement sections avec permissions
async function loadSectionsByPageId(pageId, user) {
  const [sections] = await pool.query(
    'SELECT * FROM Section WHERE page_id = ? ORDER BY position',
    [pageId]
  );

  return filterSectionsByPermission(sections, user);
}

// Ligne 142-180: Filtrage sections par permission
function filterSectionsByPermission(sections, user) {
  return sections.filter(section => {
    const tableName = section.table_name;
    if (!tableName) return true; // Section sans table

    return hasPermission(user, tableName, 'read');
  });
}
```

#### `utils/services/schemaService.js`

```javascript
// Ligne 10-40: Récupération schéma table
function getTableSchema(tableName) {
  return schema.tables[tableName];
}

// Ligne 42-80: Récupération champs table
function getTableFields(tableName) {
  const table = getTableSchema(tableName);
  return table?.fields || [];
}

// Ligne 112-160: Récupération tables liées
function getRelatedTables(tableName) {
  const table = getTableSchema(tableName);
  const relations = [];

  table.fields.forEach(field => {
    if (field.fk_table) {
      relations.push({
        field: field.name,
        table: field.fk_table,
        type: 'many-to-one'
      });
    }
  });

  return relations;
}

// Ligne 302-350: Tables accessibles par utilisateur
function getAllTablesForUser(user) {
  const tables = Object.keys(schema.tables);
  return tables.filter(tableName =>
    hasPermission(user, tableName, 'read')
  );
}
```

#### `utils/services/templateService.js`

```javascript
// Ligne 10-80: Génération formulaire login
function generateLoginForm() {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="/css/common.css">
      <link rel="stylesheet" href="/css/login-form.css">
    </head>
    <body>
      <form action="/login" method="POST" class="login-form">
        <input type="email" name="email" required>
        <input type="password" name="password" required>
        <button type="submit">Se connecter</button>
      </form>
    </body>
    </html>
  `;
}

// Ligne 82-180: Génération page d'accueil
function generateHomePage(user, pages) {
  const navigation = generateNavigationMenu(user);
  const userMenu = user ? generateUserMenu(user) : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="/css/common.css">
      <link rel="stylesheet" href="/css/navigation.css">
      <link rel="stylesheet" href="/css/page.css">
    </head>
    <body>
      ${navigation}
      ${userMenu}
      <main>
        ${pages.map(page => `
          <a href="/${page.slug}">${page.name}</a>
        `).join('')}
      </main>
    </body>
    </html>
  `;
}

// Ligne 182-250: Génération menu navigation
function generateNavigationMenu(user) {
  const accessibleTables = getAllTablesForUser(user);

  return `
    <nav class="hamburger-menu">
      <button class="hamburger-toggle">☰</button>
      <ul class="menu-items">
        ${accessibleTables.map(table => `
          <li><a href="/crud/${table}">${table}</a></li>
        `).join('')}
      </ul>
    </nav>
  `;
}
```

---

## 7. Routes API et Endpoints

### 7.1 Authentication (`routes/auth.js`)

| Endpoint | Méthode | Lignes | Description | Permissions |
|----------|---------|--------|-------------|-------------|
| `/login` | POST | 20-50 | Authentification utilisateur | Public |
| `/logout` | POST | 52-60 | Déconnexion (clear cookie) | Public |
| `/me` | GET | 62-75 | Infos utilisateur connecté | LOGIN |

### 7.2 CRUD Interface (`routes/crud.js`)

| Endpoint | Méthode | Lignes | Description | Permissions |
|----------|---------|--------|-------------|-------------|
| `/crud/:table` | GET | 50-150 | Liste entités + formulaire | table.granted[role].read |
| `/crud/:table` | POST | 152-250 | Création nouvelle entité | table.granted[role].create |
| `/crud/:table/:id` | PUT | 252-350 | Modification entité | table.granted[role].update |
| `/crud/:table/:id` | DELETE | 352-400 | Suppression entité | table.granted[role].delete |
| `/crud/:table/:id/edit` | GET | 402-500 | Formulaire édition | table.granted[role].update |

### 7.3 REST API (`routes/api.js`)

| Endpoint | Méthode | Lignes | Description | Format Response |
|----------|---------|--------|-------------|-----------------|
| `/api/:table` | GET | 50-150 | Liste JSON avec filtres | `{ data: [...], count: N }` |
| `/api/:table/:id` | GET | 152-200 | Entité unique JSON | `{ data: {...} }` |
| `/api/:table` | POST | 202-280 | Création JSON | `{ success: true, id: N }` |
| `/api/:table/:id` | PUT | 282-360 | Modification JSON | `{ success: true }` |
| `/api/:table/:id` | DELETE | 362-400 | Suppression JSON | `{ success: true }` |
| `/api/:table/schema` | GET | 402-450 | Schéma table JSON | `{ fields: [...], actions: [...] }` |
| `/api/tables` | GET | 452-500 | Liste tables accessibles | `{ tables: [...] }` |

### 7.4 Pages Dynamiques (`routes/pages_refactored.js` ✅)

| Endpoint | Méthode | Lignes | Description | Template |
|----------|---------|--------|-------------|----------|
| `/` | GET | 20-80 | Page d'accueil | `templateService.generateHomePage()` |
| `/:slug` | GET | 82-160 | Page dynamique par slug | `templateService.generatePage()` |
| `/:slug/preview` | GET | 162-185 | Prévisualisation (admin) | HTML avec bandeau preview |

---

## 8. Renderers et Formatage

### 8.1 Renderers Définis (schema.js:320-340)

| Renderer | Ligne | Usage | Exemple |
|----------|-------|-------|---------|
| `renderAsEmail` | 322-325 | Affiche email cliquable | `<a href="mailto:user@example.com">user@example.com</a>` |
| `renderAsUrl` | 326-329 | Affiche lien externe | `<a href="https://site.com" target="_blank">site.com</a>` |
| `renderAsDate` | 330-333 | Formate date français | `15/03/2024` |
| `renderAsBoolean` | 334-337 | Affiche Oui/Non | `Oui` ou `Non` |
| `renderAsImage` | 338-340 | Affiche miniature image | `<img src="..." alt="..." class="thumbnail">` |

---

## 9. Patterns et Conventions

### 9.1 Conventions de Nommage

| Élément | Convention | Exemple |
|---------|-----------|---------|
| **Fichiers** | camelCase | `pageService.js`, `authMiddleware.js` |
| **Fonctions** | camelCase | `getUserAllRoles()`, `hasPermission()` |
| **Classes** | PascalCase | `FieldSelectorUI` |
| **Constants** | UPPER_SNAKE_CASE | `GRANTED_VALUES`, `PERMISSIONS` |
| **Routes** | kebab-case | `/api/music-albums`, `/crud/person` |
| **Tables DB** | PascalCase | `Page`, `Section`, `MusicAlbum` |
| **Champs DB** | snake_case | `first_name`, `organization_id` |

### 9.2 Patterns Architecturaux

#### Pattern Service Layer
```
Route → Service → Database
      ↓
   Permissions vérifiées dans Service
```

#### Pattern Repository
```
schemaService.js = Repository pour schema.js
entityService.js = Repository pour entités
pageService.js = Repository pour pages/sections
```

#### Pattern Middleware Chain
```
authMiddleware → Route → businessLogic → response
```

#### Pattern Dependency Injection
```
Services reçoivent (pool, schema, user) en paramètres
Pas de dépendances globales implicites
```

---

## 10. Changelog et Évolution

### Phase 1 (Complétée) ✅
- Système CRUD complet
- Authentification JWT
- RBAC avec héritage de rôles
- Pages dynamiques Mustache

### Phase 2 (En cours) 🚧
- **Refactoring `routes/pages.js`**: 917 → 185 lignes (-80%)
- Extraction services:
  - `pageService.js` (lignes 1-200)
  - `entityService.js` (lignes 1-250)
  - `schemaService.js` (lignes 1-400)
  - `templateService.js` (lignes 1-680)
- Extraction CSS inline vers fichiers modulaires (11 fichiers)

### Phase 3 (Planifiée) 📋
- `SectionRenderingService` pour logique sections
- Migration templates HTML vers fichiers `.mustache`
- Renommage services pour cohérence
- Tests unitaires services
- Documentation API OpenAPI/Swagger

---

## 11. Points d'Extension

### 11.1 Ajouter une Nouvelle Table

1. **Définir dans `schema.js`** (lignes 100-340):
```javascript
tables: {
  MyNewTable: {
    fields: [
      { name: 'id', type: 'int', primary: true, auto_increment: true },
      { name: 'name', type: 'varchar', length: 255 },
      // ...
    ],
    granted: {
      public: { read: GRANTED_VALUES.FALSE },
      member: { read: GRANTED_VALUES.LOGIN, create: GRANTED_VALUES.TRUE },
      admin: { read: GRANTED_VALUES.TRUE, update: GRANTED_VALUES.TRUE, delete: GRANTED_VALUES.TRUE }
    }
  }
}
```

2. **Redémarrer serveur** → `dbSync.js` crée automatiquement la table
3. **Accessible via**:
   - `/crud/MyNewTable` (interface)
   - `/api/MyNewTable` (JSON)

### 11.2 Ajouter un Nouveau Rôle

**Modifier `schema.js` (lignes 50-90)**:
```javascript
roles: {
  // ...existants
  newRole: {
    level: 6,
    inherits: ['admin', 'premium']
  }
}
```

### 11.3 Ajouter un Renderer Custom

**Modifier `schema.js` (lignes 320-340)**:
```javascript
renderers: {
  renderAsMyCustom: (value, field) => {
    // Logique de rendu
    return `<span class="custom">${value}</span>`;
  }
}
```

**Utiliser dans field definition**:
```javascript
{ name: 'my_field', type: 'varchar', render: 'renderAsMyCustom' }
```

---

## 12. Dépendances NPM

### 12.1 Production

| Package | Version | Usage | Référencé Par |
|---------|---------|-------|---------------|
| **express** | ^4.18.2 | Framework web | `server.js` |
| **mysql2** | ^3.6.0 | Driver MySQL avec Promises | `config/database.js` |
| **jsonwebtoken** | ^9.0.2 | Génération/vérification JWT | `utils/auth.js` |
| **bcrypt** | ^5.1.1 | Hachage mots de passe | (installé, pas encore utilisé) |
| **cookie-parser** | ^1.4.6 | Parsing cookies | `server.js` |
| **mustache** | ^4.2.0 | Templates | `utils/mustacheAuto.js`, `routes/pages.js` |
| **dotenv** | ^16.3.1 | Variables environnement | `server.js` |

### 12.2 Dev Dependencies

| Package | Version | Usage |
|---------|---------|-------|
| **nodemon** | ^3.0.1 | Auto-reload serveur |

---

## 13. Variables d'Environnement

**Fichier `.env`** (lignes 1-10):

```env
DB_HOST=localhost          # Hôte MySQL
DB_USER=root              # Utilisateur MySQL
DB_PASSWORD=password      # Mot de passe MySQL
DB_NAME=schema2           # Nom base de données
JWT_SECRET=your_secret    # Clé secrète JWT
PORT=3000                 # Port serveur Express
NODE_ENV=development      # Environnement (dev/prod)
```

**Référencé par**:
- `config/database.js:10-15`
- `utils/auth.js:18`
- `server.js:100-105`

---

## 14. Scripts NPM

**Fichier `package.json`** (lignes 10-15):

```json
{
  "scripts": {
    "start": "node server.js",           // Production
    "dev": "nodemon server.js",          // Développement avec auto-reload
    "sync": "node utils/dbSync.js"       // Synchronisation DB manuelle
  }
}
```

---

## 15. Diagrammes de Flux

### 15.1 Flux de Connexion

```
User → POST /login (routes/auth.js:20)
           ↓
       Vérification email/password (ligne 35)
           ↓
       generateToken(user) (utils/auth.js:15)
           ↓
       Cookie httpOnly (routes/auth.js:45)
           ↓
       Redirect vers / (ligne 48)
```

### 15.2 Flux CRUD Create

```
User → POST /crud/:table (routes/crud.js:152)
           ↓
       hasPermission(user, table, 'create') (ligne 160)
           ↓
       schemaService.validateFieldValue() (ligne 170)
           ↓
       INSERT query (ligne 190)
           ↓
       entityService.enrichEntity() (ligne 210)
           ↓
       Redirect vers /crud/:table (ligne 240)
```

### 15.3 Flux Page Dynamique

```
User → GET /:slug (routes/pages_refactored.js:82)
           ↓
       pageService.loadPageData(slug, user) (ligne 90)
           ├─→ Récupère Page (pageService.js:15)
           ├─→ Récupère Sections (pageService.js:85)
           ├─→ Filtre par permissions (pageService.js:145)
           └─→ Enrichit avec données (pageService.js:185)
           ↓
       templateService.generatePage(page, sections) (ligne 120)
           ↓
       HTML Response (ligne 155)
```

---

## 16. TODO et Améliorations Futures

### 16.1 Sécurité

- [ ] **Implémenter bcrypt** pour hachage mots de passe (`routes/auth.js:35`)
- [ ] **Rate limiting** sur `/login` (prévenir bruteforce)
- [ ] **CSRF tokens** pour formulaires
- [ ] **Sanitization** inputs utilisateur (XSS prevention)
- [ ] **SQL injection** protection (parameterized queries déjà en place ✅)

### 16.2 Refactoring Phase 3

- [ ] **Créer `SectionRenderingService`** (extraction logique sections)
- [ ] **Migrer templates** vers fichiers `.mustache`
- [ ] **Supprimer `routes/pages.js`** (legacy)
- [ ] **Renommer services** pour cohérence (ex: `PageManagementService`)

### 16.3 Features

- [ ] **Upload fichiers** (gestion Attachment table)
- [ ] **Recherche full-text** sur tables
- [ ] **Pagination** API (actuellement limite 100)
- [ ] **Sorting** configurable par utilisateur
- [ ] **Webhooks** sur actions CRUD
- [ ] **Audit logs** (qui a modifié quoi/quand)

### 16.4 Tests

- [ ] **Tests unitaires** services (Jest/Mocha)
- [ ] **Tests intégration** routes (Supertest)
- [ ] **Tests E2E** (Playwright/Cypress)
- [ ] **Coverage** > 80%

### 16.5 Documentation

- [ ] **Swagger/OpenAPI** spec pour API
- [ ] **JSDoc** commentaires fonctions
- [ ] **Guide utilisateur** interface CRUD
- [ ] **Guide développeur** pour extensions

---

## 17. Contacts et Ressources

### 17.1 Fichiers Clés pour Démarrage

| Besoin | Fichier à Consulter |
|--------|---------------------|
| Configuration générale | `schema.js` |
| Ajouter table | `schema.js` (lignes 100-340) |
| Modifier permissions | `schema.js` (granted), `utils/permissions.js` |
| Créer endpoint | `routes/*.js` |
| Modifier UI | `utils/services/templateService.js`, `public/css/*` |
| Debug auth | `utils/auth.js`, `routes/auth.js` |
| Comprendre RBAC | `utils/permissions.js`, `constants/permissions.js` |

### 17.2 Architecture Recommandée pour Nouvelles Features

```
1. Définir schéma → schema.js
2. Créer service → utils/services/myFeatureService.js
3. Créer route → routes/myFeature.js
4. Ajouter tests → tests/myFeature.test.js
5. Documenter → CROSS_REFERENCE.md (ce fichier)
```

---

**Document généré le:** 2025-11-13
**Version Schema2:** Phase 2 Refactoring
**Dernière mise à jour architecture:** Commit `d459cdc` (extraction CSS modulaire)
