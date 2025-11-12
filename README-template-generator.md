# Générateur automatique de templates Mustache

Ce générateur crée automatiquement des templates Mustache à partir du schéma de la base de données (`schema.js`).

## Fonctionnalités

Le générateur analyse le schéma et génère un template complet avec :

✅ **Tous les fields** de la table (sauf `ownerId`, `granted`, `createdAt`, `updatedAt`)
✅ **Relations N:1** (Many-to-One) : où la fiche remplace la valeur id grâce au proxy
✅ **Relations 1:N** (One-to-Many) : où l'arrayName est ajouté aux fields grâce au proxy
✅ **Relations N:1 des relations 1:N** : relations imbriquées
✅ **Renderers personnalisés** : image, email, telephone, url, boolean, etc.
✅ **Classes CSS détaillées** selon les spécifications :
   - Page : `<div class="page {{slug}}" data-id="{{id}}" data-table="Page">`
   - Section : `<section class="section {{slug}}" data-id="{{id}}" data-table="Section">`
   - Container : `class="cards rows" data-table="<sqlTable>"`
   - Row : `class="row" data-id="{{id}}"`
   - Field label : `class="field-label <nom du field>"`
   - Field value : `class="field-value <nom du field>"`
   - Relation N:1 : `class="sub-card relation manyToOne <nom de la relation>"`
   - Relation 1:N : `class="sub-card relation oneToMany <nom de la relation>"`
   - Relation N:1 de 1:N : `class="sub-sub-card relation manyToOne <nom de la relation>"`

## Usage

### Script CLI

```bash
node generate-template.js <tableName> [context]
```

**Paramètres :**
- `tableName` : Nom de la table dans le schéma (obligatoire)
- `context` : "section" (par défaut) ou "page" (optionnel)

**Exemples :**

```bash
# Générer un template pour MusicAlbum
node generate-template.js MusicAlbum

# Générer un template pour Person en mode section
node generate-template.js Person section

# Générer un template pour Page en mode page
node generate-template.js Page page
```

Le template sera automatiquement sauvegardé dans `templates/<tableName>.mustache`.

### Utilisation programmatique

```javascript
const TemplateGenerator = require('./utils/template-generator.js');

// Créer une instance du générateur
const generator = new TemplateGenerator();

// Générer un template
const template = generator.generateTemplate('MusicAlbum', 'section');
console.log(template);

// Trouver les relations N:1
const manyToOne = generator.findManyToOneRelations('MusicAlbum');
console.log('Relations N:1:', manyToOne);

// Trouver les relations 1:N
const oneToMany = generator.findOneToManyRelations('MusicAlbum');
console.log('Relations 1:N:', oneToMany);
```

## Structure des templates générés

### Exemple : MusicAlbum

```html
<div class="cards rows" data-table="MusicAlbum">
{{#items}}
  <div class="row" data-id="{{id}}">
    <!-- Fields normaux -->
    <div class="field-label name">name:</div>
    <div class="field-value name">{{name}}</div>

    <!-- Relation N:1 : byArtist -->
    {{#byArtist}}
    <div class="sub-card relation manyToOne byArtist">
      <h4>byArtist</h4>
      <div class="field-label name">name:</div>
      <div class="field-value name">{{name}}</div>
    </div>
    {{/byArtist}}

    <!-- Relation 1:N : track -->
    {{#track}}
    <div class="sub-card relation oneToMany track">
      <h4>track</h4>
      <div class="row" data-id="{{id}}">
        <!-- Relation N:1 de 1:N : idMusicRecording -->
        {{#idMusicRecording}}
        <div class="sub-sub-card relation manyToOne idMusicRecording">
          <h4>Enregistrement</h4>
          <div class="field-label name">name:</div>
          <div class="field-value name">{{name}}</div>
        </div>
        {{/idMusicRecording}}
      </div>
    </div>
    {{/track}}
  </div>
{{/items}}
</div>
```

## Architecture

### Fichiers

- `utils/template-generator.js` : Classe principale du générateur
- `generate-template.js` : Script CLI
- `test-template-generator.js` : Tests
- `templates/` : Dossier contenant les templates générés

### Méthodes principales

- `generateTemplate(tableName, context)` : Génère un template complet
- `findManyToOneRelations(tableName)` : Trouve les relations N:1
- `findOneToManyRelations(tableName)` : Trouve les relations 1:N
- `generateFieldHTML(fieldName, fieldDef)` : Génère le HTML d'un field
- `generateManyToOneTemplate(relation, indent, isNested)` : Génère le HTML d'une relation N:1
- `generateOneToManyTemplate(relation)` : Génère le HTML d'une relation 1:N

## Tests

Pour tester le générateur sur plusieurs tables :

```bash
node test-template-generator.js
```

Ce script génère des templates pour `MusicAlbum`, `Person` et `Organization` et affiche les relations détectées.

## Notes techniques

### Détection des relations

**Relations N:1 (Many-to-One) :**
- Détectées via la propriété `relation` dans les fields de la table
- La fiche liée remplace la valeur id grâce au proxy

**Relations 1:N (One-to-Many) :**
- Détectées en parcourant toutes les tables du schéma
- Trouve les fields qui pointent vers la table actuelle
- Utilise la propriété `arrayName` pour le nom de la collection

**Relations N:1 de 1:N (imbriquées) :**
- Détectées récursivement dans les tables liées par des relations 1:N
- Utilisent la classe `sub-sub-card` pour les distinguer

### Renderers

Les renderers définis dans `schema.js` sont automatiquement appliqués :
- `image` : Génère une balise `<img>`
- `email` : Génère un lien `mailto:`
- `telephone` : Génère un lien `tel:`
- `url` : Génère un lien externe
- `boolean` : Génère ✓ ou ✗
- etc.

### Classes CSS

Toutes les classes CSS sont générées selon les spécifications pour permettre un styling précis et une manipulation JavaScript facile.
