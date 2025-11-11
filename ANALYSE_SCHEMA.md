# Analyse du fichier schema.js

## Architecture générale

### 1. Application CMS/CRUD moderne
- **Nom** : "Crudable Site" v2.0.0
- **Type** : Système de gestion de contenu avec génération automatique d'interface CRUD
- **Localisation** : France (FR), langue française (extensible multilingue)
- **SEO** : Utilisation de microdata schema.org pour le référencement

## Fonctionnalités système

### 2. Autosave intelligent
- Sauvegarde automatique avec debounce de 500ms
- Garantit la persistance des données

### 3. RBAC (Role-Based Access Control) avec héritage hiérarchique

**Hiérarchie des rôles** :
```
public
  └── member
       └── premium
            ├── promo
            └── road
                 └── admin
                      └── dir
                           └── dev
```

- **8 rôles définis** avec héritage des permissions
- L'administrateur hérite des permissions de promo ET road
- Le développeur a tous les privilèges

### 4. Système d'autorisation à 3 niveaux

**Pour chaque enregistrement (row)** :
- **draft** : Privé, accessible uniquement par le créateur (ownerId)
- **shared** : Hérite des permissions de la table
- **published @role** : Lisible par un rôle spécifique + ses descendants dans l'héritage

**Actions disponibles** : read, create, update, delete, publish

## Architecture technique

### 5. Champs communs (commonFields)

Tous les enregistrements héritent de :
- `ownerId` (integer) : ID du créateur, géré automatiquement
- `granted` (varchar) : Niveau d'autorisation (draft/shared/published @role)
- `createdAt` (datetime) : Date de création (CURRENT_TIMESTAMP)
- `updatedAt` (datetime) : Date de modification (auto-update)

### 6. Système de rendu

**Templates** :
- Moteur Mustache pour personnalisation des vues
- CSS personnalisé par page

**Renderers spécialisés** :
- `email` : Affichage avec icône 📧 et lien mailto
- `telephone` : Affichage avec icône 📞 et lien tel
- `url` : Affichage avec icône 🔗
- `image` : Balise img avec src
- `filePreview` : Appel fonction Node.js pour prévisualisation

## Gestion des utilisateurs

### 7. Authentication via table Person

**Configuration** :
- Login : email/password (en clair - phase développement uniquement)
- Champs de profil : givenName, familyName, telephone
- Cookie de session : ~400 jours (34646400 secondes)
- Interface : Menu popup positionné en haut à droite

**Champs spécifiques** :
- `fullName` : Champ calculé SQL (CONCAT)
- `roles` : Liste séparée par espaces (ex: "@admin @dev")
- `isActive` : 0/1 pour actif/inactif

## Structure de contenu

### 8. Architecture Page/Section

**Table Page** :
- `slug` : URL de la page
- `name` : Titre
- `description` : Description
- `mustache` : Template personnalisé optionnel
- `css` : Styles personnalisés
- `position` : Ordre dans le menu

**Table Section** :
- Sections dynamiques dans les pages
- Requêtes configurables : `whereClause`, `orderBy`, `limit`
- Types de présentation : **cards**, **list**, **table**, **grid**
- Relations à inclure (JSON)
- Templates Mustache personnalisables

### 9. Menu dynamique

**Configuration** :
- Style : hamburger
- Position : top left
- Animation : slidein
- Contenu : pages + tables (filtrées selon permissions granted)

## Modèle de données métier

### 10. Gestion de personnes et organisations

**Person** :
- Contacts avec informations complètes
- `fullName` : Champ calculé en SQL
- Permissions restreintes aux admins

**Organization** :
- Organisations/groupes
- `memberCount` : Champ calculé en JavaScript async (requête SQL)
- Statistique : sum sur memberCount

**OrganizationPerson** :
- Table de liaison n:n
- `organizationRole` : Rôle dans l'organisation
- Relations bidirectionnelles : `memberOf` et `member`

### 11. Gestion de projets et communications

**Project** :
- Projets de base (name, description)

**CommunicateAction** :
- Historique des communications
- Types d'instruments : Phone, Email, Meeting, Mail, Visio
- Liens vers Person et Project
- Tri par date DESC

**Contrat** :
- Contrats avec date
- Relations multiples vers Organization :
  - `organisateur` : Organisateur du contrat
  - `producteur` : Producteur du contrat
- Démontre la capacité de relations multiples vers la même table

**Notes** :
- Notes partagées
- Permissions spécifiques : promo + road peuvent CRUD, admin peut publish

### 12. Catalogue musical (conforme schema.org)

**MusicAlbum** :
- Propriétés schema.org : name, description, byArtist, datePublished, genre, recordLabel, url, image, duration
- Durée au format ISO 8601 (ex: PT37M53S)
- Relations : artiste (Organization), label (Organization)
- Publié pour : public, member, premium

**MusicRecording** :
- Enregistrements musicaux individuels
- Propriétés schema.org : name, description, duration, byArtist
- Public en lecture

**MusicAlbumTrack** :
- Table de liaison album ↔ enregistrement
- `position` : Ordre des pistes
- Relations bidirectionnelles : `track` et `inAlbum`
- Propriétés schema.org : track, inAlbum

## Fonctionnalités avancées

### 13. Relations sophistiquées

**relationshipStrength** :
- **Strong** : Cascade delete + duplication en chaîne
- **Weak** : Relation simple sans cascade

**Propriétés des relations** :
- `relation` : Table cible
- `foreignKey` : Clé étrangère
- `arrayName` : Nom de la propriété pour la relation inverse
- `arraySchemaorgProperty` : Nom selon doctrine schema.org
- `defaultSort` : Tri par défaut (field + order)
- `label` : Libellé optionnel

### 14. Champs calculés

**SQL** :
```javascript
fullName: {
  type: "varchar",
  as: "CONCAT(COALESCE(givenName, ''), ' ', COALESCE(familyName, ''))"
}
```

**JavaScript async** :
```javascript
memberCount: {
  type: "integer",
  calculate: async function(row, context) {
    const [result] = await context.pool.query(
      'SELECT COUNT(*) as count FROM OrganizationPerson WHERE idOrganization = ?',
      [row.id]
    );
    return result[0].count;
  },
  stat: "sum"
}
```

**Statistiques disponibles** : sum, count

### 15. Système d'attachements

**Table Attachment** :
- Système de fichiers joints
- `rowLink` : Lien polymorphe vers n'importe quelle table (format: "TableName/id")
- Métadonnées :
  - `fileName` : Nom original
  - `fileType` : Type MIME
  - `fileSize` : Taille en octets
  - `filePath` : Chemin système
- **Autorisation héritée** : `granted: {inherit: "rowLink"}`
- Désactivable par table via `hasAttachmentsTab: false`

## Configuration par défaut

### 16. defaultConfigPage

**Paramètres standards pour toutes les tables** :
- `displayField` : "name" (peut être un array)
- `searchFields` : null (auto: tous les varchar/text)
- `pageSize` : 100 lignes
- `dateFormat` : "fr"
- `cardWidth` : "600px"
- `publishableTo` : ["public", "member", "premium"]
- `granted` : dev uniquement par défaut (niveau maximum de protection)
- `hasAttachmentsTab` : false (activable par table)

## Points techniques notables

### 17. Permissions granulaires

**Par table** :
```javascript
granted: {
  "admin": ["read", "create", "update", "delete", "publish"]
}
```

**Par champ** :
```javascript
password: {
  type: "varchar",
  grant: {
    "dev": ["read", "create", "update"],
    "admin": ["read", "create", "update"]
  }
}
```

### 18. Autres caractéristiques

- **Enum natifs** : ex. `presentationType` avec valeurs prédéfinies
- **Relations multiples** : Plusieurs relations vers la même table (ex: Contrat)
- **Calculs avec contexte** : Fonctions `calculate()` reçoivent `context.pool` pour requêtes SQL
- **Statistiques** : Agrégation automatique sur champs calculés

## Cas d'usage identifié

Ce schéma révèle une **plateforme de gestion complète** adaptée pour une structure culturelle/musicale :

✅ Gestion de personnes et organisations
✅ Catalogue musical conforme schema.org (SEO optimisé)
✅ Système de projets et contrats
✅ CMS dynamique avec pages personnalisables
✅ Sécurité multi-niveaux (RBAC + row-level permissions)
✅ Historique de communications
✅ Notes collaboratives
✅ Système d'attachements universel

**Public cible** : Labels musicaux, salles de concert, tourneurs, maisons de production.
