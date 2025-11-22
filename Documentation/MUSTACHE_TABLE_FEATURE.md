# Feature: Relations 1:n en mode Table dans generateMustacheTemplate

## Vue d'ensemble

Le générateur de templates Mustache `TemplateService.generateMustacheTemplate()` supporte maintenant deux modes d'affichage pour les relations 1:n (one-to-many) :

- **Mode `cards`** (par défaut) : Affichage en cartes/divs avec tous les champs
- **Mode `table`** : Affichage en table HTML avec lignes et colonnes

## Utilisation

### Syntaxe

```javascript
const TemplateService = require('./services/templateService');

const template = TemplateService.generateMustacheTemplate(tableName, user, {
  includeWrapper: true,          // Inclure le wrapper <article>
  includeSystemFields: false,    // Exclure les champs système (ownerId, granted, etc.)
  maxDepth: 2,                   // Profondeur des relations imbriquées
  oneToManyStyle: 'table'        // 'cards' ou 'table'
});
```

### Exemple 1 : Organization avec membres en table

```javascript
const template = TemplateService.generateMustacheTemplate('Organization', user, {
  oneToManyStyle: 'table'
});
```

**Résultat généré :**

```html
<div class="relation relation-1n relation-1n-table member">
  <h3>Member</h3>
  <table class="relation-table" data-table="OrganizationPerson">
    <thead>
      <tr>
        <th data-field="position">Position</th>
        <th data-field="organizationRole">Organization Role</th>
        <th data-field="idOrganization" data-relation="n1">Id Organization</th>
        <th data-field="idPerson" data-relation="n1">Id Person</th>
      </tr>
    </thead>
    <tbody>
      {{#member}}
      <tr data-id="{{id}}">
        <td data-field="position" data-type="integer">{{position}}</td>
        <td data-field="organizationRole" data-type="varchar">{{organizationRole}}</td>
        <td data-field="idOrganization" data-relation="n1">
          {{#idOrganization}}{{name}}{{/idOrganization}}
        </td>
        <td data-field="idPerson" data-relation="n1">
          {{#idPerson}}{{givenName}} {{familyName}}{{/idPerson}}
        </td>
      </tr>
      {{/member}}
    </tbody>
  </table>
</div>
```

### Exemple 2 : MusicAlbum avec tracks en table

```javascript
const template = TemplateService.generateMustacheTemplate('MusicAlbum', user, {
  oneToManyStyle: 'table',
  maxDepth: 2
});
```

**Résultat pour la relation `track` :**

```html
<div class="relation relation-1n relation-1n-table track">
  <h3>Track</h3>
  <table class="relation-table" data-table="MusicAlbumTrack">
    <thead>
      <tr>
        <th data-field="position">Position</th>
        <th data-field="idMusicAlbum" data-relation="n1">Id Music Album</th>
        <th data-field="idMusicRecording" data-relation="n1">Id Music Recording</th>
      </tr>
    </thead>
    <tbody>
      {{#track}}
      <tr data-id="{{id}}">
        <td data-field="position" data-type="integer">{{position}}</td>
        <td data-field="idMusicAlbum" data-relation="n1">
          {{#idMusicAlbum}}{{name}}{{/idMusicAlbum}}
        </td>
        <td data-field="idMusicRecording" data-relation="n1">
          {{#idMusicRecording}}{{name}}{{/idMusicRecording}}
        </td>
      </tr>
      {{/track}}
    </tbody>
  </table>
</div>
```

## Fonctionnalités

### Support des renderers

Le mode table supporte les renderers définis dans le schéma :

- **`image`** : Affiche une image avec contraintes de taille (max 100x100px)
- **`url`** : Affiche un lien avec icône 🔗
- **`email`** : Affiche un lien mailto
- **`telephone`** : Affiche un lien tel
- **`datetime/date/time`** : Utilise la balise `<time>`
- **`text`** : Tronque le texte avec ellipsis

### Relations n:1 imbriquées

Si `maxDepth > 0`, les relations n:1 de la table liée sont aussi affichées dans des colonnes supplémentaires.

Exemple : `OrganizationPerson.idPerson` affiche les `displayFields` de `Person` (`givenName`, `familyName`)

### Exclusions automatiques

Le mode table exclut automatiquement :

- Le champ `id` (déjà dans `data-id`)
- Les champs système (`ownerId`, `granted`, `createdAt`, `updatedAt`)
- Les relations n:1 directes (affichées dans leurs propres colonnes)

## Différences entre modes

| Caractéristique | Mode `cards` | Mode `table` |
|-----------------|--------------|--------------|
| **Structure HTML** | `<div class="relation-items">` avec divs | `<table>` avec `<thead>` et `<tbody>` |
| **Champs affichés** | Tous les champs non-système | Tous les champs non-système + relations n:1 |
| **Relations n:1** | Blocs séparés sous les champs | Colonnes dans la table |
| **Renderers** | HTML complet avec labels | HTML compact dans cellules |
| **Lisibilité** | Meilleure pour peu d'éléments | Meilleure pour beaucoup d'éléments |
| **Comparaison** | Difficile | Facile (lignes alignées) |

## Quand utiliser chaque mode ?

### Mode `cards` (par défaut)
- Peu d'éléments liés (1-5)
- Beaucoup de champs par élément
- Besoin de voir tous les détails
- Relations n:1 complexes à afficher

### Mode `table`
- Beaucoup d'éléments liés (6+)
- Peu de champs par élément
- Besoin de comparer les valeurs
- Données tabulaires (tracks, membres, contrats, etc.)

## CSS recommandé

Pour styler les tables générées, ajoutez ce CSS :

```css
.relation-1n-table {
  margin: 2rem 0;
}

.relation-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.relation-table thead {
  background-color: #f5f5f5;
}

.relation-table th,
.relation-table td {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  text-align: left;
}

.relation-table th {
  font-weight: 600;
  color: #333;
}

.relation-table tbody tr:hover {
  background-color: #f9f9f9;
}

.relation-table .table-image {
  max-width: 100px;
  max-height: 100px;
  object-fit: cover;
}

.relation-table .text-preview {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

## Exemples d'utilisation dans l'application

### Dans une Section de Page

Vous pouvez utiliser ce template dans le champ `mustache` d'une Section :

1. Créer une Section pour afficher un album
2. Configurer `sqlTable = 'MusicAlbum'`
3. Générer le template avec `oneToManyStyle: 'table'`
4. Coller le résultat dans le champ `mustache` de la Section

### Via l'API

```javascript
// Dans routes/api.js ou un endpoint personnalisé
const TemplateService = require('./services/templateService');

router.get('/template/:table', (req, res) => {
  const { table } = req.params;
  const { style = 'cards' } = req.query;

  const template = TemplateService.generateMustacheTemplate(table, req.user, {
    oneToManyStyle: style
  });

  res.json({ template });
});
```

Utilisation :
```
GET /_api/template/MusicAlbum?style=table
```

## Tests

Pour tester cette fonctionnalité :

```bash
node test-mustache-simple.js
```

Ce script génère des exemples de templates pour :
- `Organization.member` (OrganizationPerson)
- `MusicAlbum.track` (MusicAlbumTrack)

## Implémentation technique

### Fichiers modifiés

- **services/templateService.js** (lignes ~1426-1766)
  - Ajout de l'import `SchemaService`
  - Ajout de la méthode publique `generateMustacheTemplate()` avec le paramètre `oneToManyStyle`
  - Nouvelles méthodes privées :
    - `_generateBaseFieldsTemplate()` - Génère les champs de base
    - `_generateN1RelationTemplate()` - Génère les relations n:1
    - `_generate1NRelationTemplate()` - Route entre mode cards et table
    - `_generate1NRelationTableTemplate()` - Génère les tables HTML pour relations 1:n
    - `_humanizeFieldName()` - Formatte les noms de champs

- **services/pageService.js**
  - Suppression des méthodes de génération de templates (déplacées vers TemplateService)

### Architecture

```
TemplateService.generateMustacheTemplate()
  ↓
  options.oneToManyStyle = 'table'
  ↓
_generate1NRelationTemplate()
  ↓ (si style === 'table')
_generate1NRelationTableTemplate()
  ↓
  Génère <table> avec <thead> et <tbody>
  ↓
  Inclut relations n:1 imbriquées si maxDepth > 0
```

## Limitations actuelles

- Pas de tri/filtrage dans la table générée (à faire en JavaScript côté client)
- Pas de pagination (affiche tous les éléments)
- Relations 1:n imbriquées non supportées en mode table (seulement maxDepth pour n:1)
- Pas d'édition inline (readonly)

## Évolutions futures possibles

1. **Colonnes personnalisables** : Option pour choisir quelles colonnes afficher
2. **Tri client** : JavaScript pour trier les colonnes
3. **Édition inline** : Rendre les cellules éditables
4. **Export CSV** : Bouton pour exporter la table
5. **Pagination** : Diviser en pages si beaucoup de lignes
6. **Recherche/filtrage** : Input pour filtrer les lignes

---

**Auteur**: Assistant AI
**Date**: 2025-11-22
**Version**: 1.0.0
