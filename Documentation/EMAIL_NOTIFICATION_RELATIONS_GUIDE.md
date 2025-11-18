# Guide: Sélection des Relations 1:N dans les Notifications Email

> **Statut**: ✅ **FONCTIONNALITÉ DÉJÀ IMPLÉMENTÉE**
> **Date**: 2025-11-18
> **Branche**: claude/email-notification-dialog-01JRdX6Fgp1Kx18FZhKoQ37h

## Vue d'ensemble

La fonctionnalité de sélection des relations 1:N dans les notifications email **est déjà complètement implémentée** dans le code. Ce guide explique où la trouver et comment elle fonctionne.

## Localisation de la fonctionnalité

### Frontend: NotifyModal.js

**Fichier**: `public/js/components/dialogs/NotifyModal.js`

#### 1. État du composant (lignes 17-26)

```javascript
this.state = {
  loading: true,
  recipients: [],
  includeSender: false,
  customMessage: '',
  emailPreview: null,
  error: null,
  availableRelations: [],      // ✅ Relations disponibles
  selectedRelations: []         // ✅ Relations sélectionnées
};
```

#### 2. Chargement des relations disponibles (lignes 64-71)

```javascript
// Si c'est le premier chargement, configure les relations
if (data.availableRelations && availableRelations.length === 0) {
  newState.availableRelations = data.availableRelations;

  // Pré-sélectionne les relations Strong
  newState.selectedRelations = data.availableRelations
    .filter(rel => rel.isStrong)
    .map(rel => rel.arrayName);
}
```

**Comportement**: Les relations avec `relationshipStrength: "Strong"` sont automatiquement pré-sélectionnées.

#### 3. Handler de sélection (lignes 105-115)

```javascript
handleRelationToggle = (arrayName) => {
  const { selectedRelations } = this.state;
  const newSelected = selectedRelations.includes(arrayName)
    ? selectedRelations.filter(r => r !== arrayName)
    : [...selectedRelations, arrayName];

  this.setState({ selectedRelations: newSelected }, () => {
    // Recharge l'aperçu avec les nouvelles relations
    this.loadRecipients();
  });
}
```

**Comportement**: Chaque fois qu'une relation est cochée/décochée, l'aperçu email se met à jour automatiquement.

#### 4. Envoi au backend (lignes 46-48)

```javascript
// Ajoute les relations sélectionnées comme paramètre de requête
if (selectedRelations.length > 0) {
  params.append('includeRelations', selectedRelations.join(','));
}
```

#### 5. Interface utilisateur (lignes 355-418)

```javascript
// Sélecteur de relations
availableRelations.length > 0 && e('div', {
  key: 'relations-selector',
  style: { marginBottom: '20px' }
},
  e('label', {
    style: {
      display: 'block',
      marginBottom: '8px',
      fontSize: '14px',
      fontWeight: 'bold',
      color: '#333'
    }
  }, 'Relations à inclure dans l\'email'),
  e('div', {
    style: {
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: '4px',
      padding: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '8px'
    }
  },
    availableRelations.map(relation =>
      e('div', {
        key: relation.arrayName,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }
      },
        e('input', {
          type: 'checkbox',
          id: `relation-${relation.arrayName}`,
          checked: selectedRelations.includes(relation.arrayName),
          onChange: () => this.handleRelationToggle(relation.arrayName),
          style: { cursor: 'pointer' }
        }),
        e('label', {
          htmlFor: `relation-${relation.arrayName}`,
          style: {
            cursor: 'pointer',
            fontSize: '14px',
            color: '#333',
            flex: 1
          }
        },
          `${relation.table} (${relation.arrayName})`,
          relation.isStrong && e('span', {
            style: {
              marginLeft: '8px',
              fontSize: '11px',
              color: '#28a745',
              fontWeight: 'bold'
            }
          }, '★ Strong')
        )
      )
    )
  )
),
```

**Affichage**:
- ✅ Liste de checkboxes pour chaque relation 1:N disponible
- ✅ Affiche le nom de la table et l'arrayName
- ✅ Indicateur visuel "★ Strong" pour les relations fortes
- ✅ Les relations Strong sont pré-cochées

### Backend: NotificationService.js

**Fichier**: `services/notificationService.js`

#### 1. Détection des relations disponibles (lignes 475-500)

```javascript
// Trouve les relations 1:n disponibles (relations inverses où cette table est le "1")
// Parcourt toutes les autres tables pour trouver les champs qui pointent vers cette table
for (const [otherTableName, otherTableConfig] of Object.entries(schema.tables)) {
  if (!otherTableConfig.fields) continue;

  for (const [otherFieldName, otherFieldConfig] of Object.entries(otherTableConfig.fields)) {
    // Vérifie si ce champ est une relation pointant vers notre table
    if (otherFieldConfig.relation === tableName && otherFieldConfig.arrayName) {
      const arrayName = otherFieldConfig.arrayName;

      // Vérifie si cette relation est présente dans l'enregistrement et a des données
      if (record[arrayName] && Array.isArray(record[arrayName]) && record[arrayName].length > 0) {
        // Évite les doublons
        const exists = availableRelations.some(rel => rel.arrayName === arrayName);
        if (!exists) {
          availableRelations.push({
            arrayName: arrayName,
            table: otherTableName,
            isStrong: otherFieldConfig.relationshipStrength === 'Strong',
            count: record[arrayName].length
          });
        }
      }
    }
  }
}
```

**Comportement**:
- Détecte automatiquement toutes les relations 1:N qui ont des données
- Retourne le nom de la table, l'arrayName, si c'est Strong, et le nombre d'éléments

#### 2. Formatage des relations dans l'email (lignes 236-270)

```javascript
// Construit le HTML des relations
let relationsHtml = '';
if (includeRelations && includeRelations.length > 0) {
  for (const relationArrayName of includeRelations) {
    if (record[relationArrayName] && Array.isArray(record[relationArrayName]) && record[relationArrayName].length > 0) {
      const relationItems = record[relationArrayName];

      // Essaie de trouver le nom de la table pour cette relation
      let relationTableName = relationArrayName;
      for (const [otherTableName, otherTableConfig] of Object.entries(schema.tables)) {
        for (const [otherFieldName, otherFieldConfig] of Object.entries(otherTableConfig.fields)) {
          if (otherFieldConfig.relation === tableName &&
              (otherFieldConfig.arrayName === relationArrayName || otherFieldName + 's' === relationArrayName)) {
            relationTableName = otherTableName;
            break;
          }
        }
      }

      relationsHtml += `
<div style="background-color: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 15px; margin-bottom: 15px;">
  <h4 style="margin: 0 0 12px 0; color: #555; font-size: 16px;">
    📎 ${relationTableName} (${relationItems.length})
  </h4>
  <ul style="margin: 0; padding-left: 20px;">
    ${relationItems.map(item => {
      const label = item._label || item.name || item.title || `#${item.id}`;
      return `<li style="margin-bottom: 6px;">${label}</li>`;
    }).join('')}
  </ul>
</div>
      `;
    }
  }
}
```

**Affichage dans l'email**:
- Section avec fond gris pour chaque relation
- Titre avec le nom de la table et le nombre d'éléments
- Liste à puces avec le label de chaque élément lié

### API Endpoints

**Fichier**: `routes/api.js`

#### 1. Preview endpoint (ligne 699)

```javascript
GET /_api/:table/:id/notify/preview
  ?includeSender=true|false
  &customMessage=Message personnalisé
  &includeRelations=arrayName1,arrayName2,arrayName3
```

**Réponse**:
```json
{
  "success": true,
  "recipients": [...],
  "count": 5,
  "emailPreview": "<html>...</html>",
  "availableRelations": [
    {
      "arrayName": "projects",
      "table": "Project",
      "isStrong": true,
      "count": 3
    }
  ]
}
```

#### 2. Send endpoint (ligne 772)

```javascript
POST /_api/:table/:id/notify
Body: {
  "includeSender": false,
  "customMessage": "Message optionnel",
  "includeRelations": ["projects", "tasks"]
}
```

## Comment utiliser la fonctionnalité

### 1. Ouvrir la modale de notification

1. Accéder à une fiche via `/_crud/TableName/ID`
2. Cliquer sur le bouton **"📧 Notifier"** en haut à droite
3. La modale de notification s'ouvre

### 2. Sélectionner les relations à inclure

**Si la fiche a des relations 1:N**:
- Une section "Relations à inclure dans l'email" apparaît
- Les relations **Strong** sont **automatiquement pré-cochées**
- Chaque relation affiche: `NomTable (arrayName)` avec badge "★ Strong" si applicable
- Cochez/décochez les relations souhaitées
- **L'aperçu email se met à jour en temps réel**

**Exemple visuel**:
```
┌─────────────────────────────────────────────────┐
│ Relations à inclure dans l'email                │
├─────────────────────────────────────────────────┤
│ ☑ Project (projects) ★ Strong                   │
│ ☐ Task (tasks)                                  │
│ ☑ Comment (comments) ★ Strong                   │
└─────────────────────────────────────────────────┘
```

### 3. Aperçu email

L'aperçu email (entre les deux lignes bleues) montre:
- Le contenu de la fiche
- **Les relations sélectionnées** avec leur liste d'éléments
- Le message personnalisé

### 4. Envoyer

Cliquer sur **"📧 Envoyer (N)"** pour envoyer les emails avec les relations incluses.

## Exemples de relations détectées

### Exemple 1: Organization avec Projects

**Schema**:
```javascript
tables: {
  Organization: {
    fields: {
      id: { type: "integer", isPrimary: true },
      name: { type: "varchar" }
    }
  },
  Project: {
    fields: {
      id: { type: "integer", isPrimary: true },
      name: { type: "varchar" },
      organizationId: {
        type: "integer",
        relation: "Organization",
        foreignKey: "id",
        relationshipStrength: "Strong",
        arrayName: "projects"  // ← Relation 1:N inverse
      }
    }
  }
}
```

**Comportement**:
- Quand on notifie une Organization
- La relation "projects" apparaît dans le sélecteur
- Elle est pré-cochée car Strong
- L'email inclut la liste des projets de cette organisation

### Exemple 2: Person avec OrganizationPerson

**Schema**:
```javascript
tables: {
  Person: {
    fields: {
      id: { type: "integer", isPrimary: true },
      givenName: { type: "varchar" },
      familyName: { type: "varchar" }
    }
  },
  OrganizationPerson: {
    fields: {
      id: { type: "integer", isPrimary: true },
      personId: {
        type: "integer",
        relation: "Person",
        arrayName: "organizationPersons",
        relationshipStrength: "Weak"
      },
      organizationId: {
        type: "integer",
        relation: "Organization"
      }
    }
  }
}
```

**Comportement**:
- Quand on notifie une Person
- La relation "organizationPersons" apparaît
- Elle n'est PAS pré-cochée car Weak
- Si on la coche, l'email inclut la liste des organisations de cette personne

## Cas particuliers

### Aucune relation disponible

Si la fiche n'a aucune relation 1:N avec des données:
- Le sélecteur de relations **n'apparaît pas**
- Seuls les champs de la fiche sont inclus dans l'email

### Relations vides

Si une relation existe dans le schéma mais n'a aucun élément lié:
- Elle **n'apparaît pas** dans le sélecteur (count = 0)
- Seules les relations avec au moins 1 élément sont proposées

### Mise à jour en temps réel

Chaque fois qu'on coche/décoche une relation:
1. L'état `selectedRelations` est mis à jour
2. `loadRecipients()` est appelé
3. L'API retourne un nouvel aperçu email
4. L'iframe d'aperçu se met à jour instantanément

## Tests

### Test 1: Vérifier la détection des relations

```bash
# Créer une Organization avec des Projects
curl -X POST http://localhost:3000/_api/Organization \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp"}'

curl -X POST http://localhost:3000/_api/Project \
  -H "Content-Type: application/json" \
  -d '{"name": "Project A", "organizationId": 1}'

curl -X POST http://localhost:3000/_api/Project \
  -H "Content-Type: application/json" \
  -d '{"name": "Project B", "organizationId": 1}'

# Vérifier l'aperçu de notification
curl http://localhost:3000/_api/Organization/1/notify/preview
```

**Résultat attendu**:
```json
{
  "success": true,
  "recipients": [...],
  "availableRelations": [
    {
      "arrayName": "projects",
      "table": "Project",
      "isStrong": true,
      "count": 2
    }
  ],
  "emailPreview": "<html>...</html>"
}
```

### Test 2: Envoyer avec relations

```bash
curl -X POST http://localhost:3000/_api/Organization/1/notify \
  -H "Content-Type: application/json" \
  -d '{
    "includeSender": false,
    "customMessage": "Voici notre organisation et ses projets",
    "includeRelations": ["projects"]
  }'
```

**Email attendu**:
```
┌─────────────────────────────────────┐
│ 📧 Notification                     │
│ Jean Dupont vous partage cette fiche│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Message :                           │
│ Voici notre organisation et ses     │
│ projets                             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Acme Corp                           │
│ Organization #1                     │
│                                     │
│ name │ Acme Corp                    │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ 📎 Project (2)                      │
│ • Project A                         │
│ • Project B                         │
└─────────────────────────────────────┘

        [🔗 Voir la fiche]
```

## Conclusion

✅ La fonctionnalité de sélection des relations 1:N est **complètement implémentée**

✅ Elle est **déjà active** dans le code actuel

✅ L'interface est **intuitive** avec pré-sélection des relations Strong

✅ L'aperçu email se met à jour **en temps réel**

✅ Le backend **détecte automatiquement** les relations disponibles

✅ Les emails incluent les **listes d'éléments liés**

## Pour aller plus loin

Si vous souhaitez améliorer la fonctionnalité:

1. **Filtrage des relations**: Permettre de filtrer les éléments à inclure dans chaque relation
2. **Tri personnalisé**: Choisir l'ordre d'affichage des éléments liés
3. **Limite de relations**: Afficher seulement les N premiers éléments si la liste est longue
4. **Relations N:N**: Supporter les relations many-to-many via tables de jonction
5. **Template personnalisable**: Permettre de personnaliser le format d'affichage des relations
6. **Préférences par défaut**: Mémoriser les préférences de relations pour chaque utilisateur

---

**Fichiers concernés**:
- ✅ `public/js/components/dialogs/NotifyModal.js` (473 lignes)
- ✅ `services/notificationService.js` (517 lignes)
- ✅ `routes/api.js` (endpoints notify/preview et notify)
- ✅ `services/tableDataService.js` (pour charger les relations)

**Commit d'implémentation**: 1131a783 (PR #175)
**Branche actuelle**: claude/email-notification-dialog-01JRdX6Fgp1Kx18FZhKoQ37h
