# Générateur de Templates Mustache Automatique

## Vue d'ensemble

Le service `PageService` fournit une méthode `generateMustacheTemplate()` qui génère automatiquement des templates Mustache pour n'importe quelle table du schéma. Cette méthode analyse le schéma et crée un template qui gère :

- ✅ Les champs de base (avec renderers appropriés)
- ✅ Les relations n:1 (many-to-one) - objets
- ✅ Les relations 1:n (one-to-many) - arrays
- ✅ Les relations n:1 imbriquées dans les relations 1:n

## Utilisation

### Syntaxe de base

```javascript
const PageService = require('./services/pageService');

const template = PageService.generateMustacheTemplate(tableName, user, options);
```

### Paramètres

| Paramètre | Type | Description |
|-----------|------|-------------|
| `tableName` | `string` | Nom de la table (ex: "MusicAlbum", "Event") |
| `user` | `Object` | Utilisateur pour vérifier les permissions |
| `options` | `Object` | Options de génération (optionnel) |

### Options disponibles

```javascript
{
  includeWrapper: true,        // Inclure le wrapper <article> (default: true)
  includeSystemFields: false,  // Inclure ownerId, granted, etc. (default: false)
  maxDepth: 2                  // Profondeur max des relations (default: 2)
}
```

## Exemples

### Exemple 1 : Template complet pour MusicAlbum

```javascript
const adminUser = { id: 1, roles: '@admin' };
const template = PageService.generateMustacheTemplate('MusicAlbum', adminUser);
```

**Résultat** (extrait) :

```html
<article class="row" data-table="MusicAlbum" data-id="{{id}}">
  <h2>{{name}}</h2>

  <div class="field field-simple name">
    <label>Name</label>
    <div class="value">{{name}}</div>
  </div>

  <div class="field field-image image">
    <label>Image</label>
    {{#image}}<img src="{{image}}" alt="{{image}}" class="image-preview" />{{/image}}
  </div>

  <!-- Relations n:1 (Many-to-One) -->
  {{#byArtist}}
  <div class="relation relation-n1 byArtist" data-table="Organization">
    <h3>By Artist</h3>
    <div class="relation-value">{{name}}</div>
    {{#description}}<div class="relation-description">{{description}}</div>{{/description}}
  </div>
  {{/byArtist}}

  <!-- Relations 1:n (One-to-Many) -->
  {{#track}}
  <div class="relation relation-1n track">
    <h3>Track</h3>
    <div class="relation-items">
      <div class="field field-simple position">
        <label>Position</label>
        <div class="value">{{position}}</div>
      </div>

      <!-- Relations n:1 imbriquées -->
      {{#idMusicRecording}}
      <div class="relation relation-n1 idMusicRecording" data-table="MusicRecording">
        <h3>Id Music Recording</h3>
        <div class="relation-value">{{name}}</div>
      </div>
      {{/idMusicRecording}}
    </div>
  </div>
  {{/track}}
</article>
```

### Exemple 2 : Template sans wrapper pour Section

Utilisable directement dans le champ `mustache` d'une Section :

```javascript
const template = PageService.generateMustacheTemplate('Event', adminUser, {
  includeWrapper: false,  // Pas de <article> wrapper
  maxDepth: 1             // Limiter la profondeur
});
```

**Résultat** :

```html
  <div class="field field-datetime startDate">
    <label>Start Date</label>
    {{#startDate}}<time datetime="{{startDate}}">{{startDate}}</time>{{/startDate}}
  </div>

  {{#organizer}}
  <div class="relation relation-n1 organizer" data-table="Organization">
    <h3>Organizer</h3>
    <div class="relation-value">{{name}}</div>
  </div>
  {{/organizer}}
```

### Exemple 3 : Utilisation dans une Section de Page

Vous pouvez copier-coller le template généré directement dans le champ `mustache` d'une Section :

```sql
-- 1. Générer le template avec le script de test
node test-mustache-template-simple.js MusicAlbum

-- 2. Copier le template généré

-- 3. Insérer dans une Section
INSERT INTO Section (idPage, name, sqlTable, mustache, granted)
VALUES (
  1,
  'Albums',
  'MusicAlbum',
  '<article class="row" data-table="MusicAlbum" data-id="{{id}}">
    ... (template généré) ...
  </article>',
  'shared'
);
```

## Compatibilité avec tableDataService

Les templates générés sont conçus pour fonctionner avec les données retournées par `tableDataService.getTableData()` avec l'option `resolvedRelations: true` :

```javascript
const data = await getTableData(user, 'MusicAlbum', {
  resolvedRelations: true  // IMPORTANT : résout les relations
});

// Structure de data.rows[0] :
// {
//   id: 1,
//   name: "Voyager Léger",
//   byArtist: { id: 1, name: "Lili Cros...", ... },      // Objet (n:1)
//   recordLabel: { id: 2, name: "Sofia Label", ... },    // Objet (n:1)
//   track: [                                              // Array (1:n)
//     {
//       position: 1,
//       idMusicRecording: { id: 1, name: "Le client...", ... }  // Objet imbriqué (n:1)
//     },
//     ...
//   ]
// }
```

## Renderers supportés

Le générateur prend en charge tous les renderers définis dans le schéma :

| Renderer | Template généré |
|----------|-----------------|
| `image` | `<img src="{{field}}" alt="{{field}}" class="image-preview" />` |
| `url` | `<a href="{{field}}" target="_blank" rel="noopener">{{field}}</a>` |
| `email` | `<a href="mailto:{{field}}">{{field}}</a>` |
| `telephone` | `<a href="tel:{{field}}">{{field}}</a>` |
| `datetime` / `date` / `time` | `<time datetime="{{field}}">{{field}}</time>` |
| `text` | `<div class="text-content">{{{field}}}</div>` (triple mustache pour HTML) |
| (défaut) | `<div class="value">{{field}}</div>` |

## Classes CSS générées

Le template génère des classes CSS structurées pour faciliter le styling :

```css
/* Champs */
.field                  /* Tous les champs */
.field-simple          /* Champs simples (varchar, integer, etc.) */
.field-image           /* Champs image */
.field-url             /* Champs URL */
.field-datetime        /* Champs datetime/date/time */
.field-text            /* Champs text */

/* Relations */
.relation              /* Toutes les relations */
.relation-n1           /* Relations many-to-one (objets) */
.relation-1n           /* Relations one-to-many (arrays) */
.relation-items        /* Container des items dans une relation 1:n */
.relation-value        /* Valeur d'affichage d'une relation */
.relation-description  /* Description d'une relation */
.relation-image        /* Image dans une relation */

/* Wrapper principal */
.row                   /* Article wrapper */
```

### Exemple de CSS personnalisé

```css
/* Styliser les relations n:1 */
.relation-n1 {
  border-left: 3px solid var(--primary-color);
  padding-left: 1rem;
  margin: 1rem 0;
}

/* Styliser les tracks (relation 1:n) */
.relation-1n.track {
  background: var(--bg-secondary);
  border-radius: 8px;
  padding: 1rem;
}

/* Styliser les champs image */
.field-image img {
  max-width: 400px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}
```

## Fonctions utilitaires

### _humanizeFieldName(fieldName)

Convertit les noms de champs camelCase en format lisible :

```javascript
"byArtist" → "By Artist"
"recordLabel" → "Record Label"
"idMusicRecording" → "Id Music Recording"
```

## Profondeur des relations (maxDepth)

Le paramètre `maxDepth` contrôle la profondeur des relations imbriquées :

- **maxDepth: 0** - Seulement les champs de base, pas de relations
- **maxDepth: 1** - Champs de base + relations n:1 et 1:n (sans imbrication)
- **maxDepth: 2** - (défaut) Champs de base + relations n:1 et 1:n + relations n:1 imbriquées dans les 1:n
- **maxDepth: 3+** - Relations imbriquées plus profondes (attention aux performances)

## Script de test

Un script de test est disponible pour générer rapidement des templates :

```bash
# Générer le template pour MusicAlbum
node test-mustache-template-simple.js MusicAlbum

# Générer le template pour Event
node test-mustache-template-simple.js Event

# Générer le template pour n'importe quelle table
node test-mustache-template-simple.js <TableName>
```

## Limitations et considérations

1. **Permissions** : Le template généré respecte les permissions de l'utilisateur fourni. Un utilisateur sans accès à une relation ne la verra pas dans le template.

2. **Champs système** : Par défaut, les champs système (`ownerId`, `granted`, `createdAt`, `updatedAt`) sont exclus. Utilisez `includeSystemFields: true` pour les inclure.

3. **Performance** : Avec `maxDepth` élevé et beaucoup de relations, le template peut devenir très long. Limitez `maxDepth` si nécessaire.

4. **Champs calculés** : Les champs avec `calculate` (JavaScript) ou `as` (SQL) sont inclus normalement dans le template.

## Cas d'usage

### 1. Prototypage rapide

Générer rapidement un template pour visualiser les données d'une nouvelle table :

```javascript
const template = PageService.generateMustacheTemplate('MyNewTable', adminUser);
// Copier-coller dans une Section pour tester immédiatement
```

### 2. Base pour personnalisation

Utiliser le template généré comme point de départ, puis le personnaliser :

```javascript
let template = PageService.generateMustacheTemplate('Event', adminUser);

// Ajouter du contenu personnalisé
template = template.replace('{{eventStatus}}',
  '{{#eventStatus}}<span class="status status-{{eventStatus}}">{{eventStatus}}</span>{{/eventStatus}}'
);
```

### 3. Documentation automatique

Générer la documentation HTML d'une table :

```javascript
const tables = ['MusicAlbum', 'Event', 'Organization'];
const documentation = tables.map(table => ({
  table,
  template: PageService.generateMustacheTemplate(table, adminUser)
}));
```

### 4. Tests

Vérifier que toutes les tables ont des templates valides :

```javascript
const schema = require('./schema.js');

for (const tableName of Object.keys(schema.tables)) {
  const template = PageService.generateMustacheTemplate(tableName, adminUser);
  console.assert(template !== null, `Template generation failed for ${tableName}`);
}
```

## Intégration avec le système existant

Le générateur de templates s'intègre parfaitement avec l'architecture Schema2 existante :

```
Schema.js (définition)
    ↓
SchemaService (analyse)
    ↓
PageService.generateMustacheTemplate() (génération)
    ↓
Section.mustache (stockage)
    ↓
tableDataService.getTableData() (données)
    ↓
Mustache.render() (rendu)
    ↓
Page HTML (affichage)
```

## Évolutions futures

Fonctionnalités envisageables :

- [ ] Support des templates pour cards/list/table/grid
- [ ] Génération de CSS associé
- [ ] Templates responsive (mobile/desktop)
- [ ] Support des microdata schema.org
- [ ] Prévisualisation en temps réel
- [ ] Templates par type de contenu (blog, portfolio, etc.)

## Voir aussi

- **CLAUDE.md** : Architecture générale de Schema2
- **SERVICES_API.md** : Documentation des services
- **schema.js** : Définition du schéma
- **services/pageService.js** : Code source de la méthode
- **services/templateService.js** : Service de rendu HTML

---

**Auteur**: Schema2 Team
**Date**: 2025-11-22
**Version**: 1.0.0
