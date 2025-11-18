# Image Editor Feature

> **Date de création**: 2025-11-18
> **Version**: 1.0.0

## Vue d'ensemble

La fonctionnalité d'édition d'images permet de modifier les pièces jointes de type image directement dans l'interface, en utilisant la bibliothèque **Sharp** pour les transformations côté serveur.

## Fonctionnalités

### Transformations disponibles

#### 📐 Redimensionnement
- Largeur personnalisée
- Hauteur personnalisée
- Modes d'ajustement :
  - **inside**: Contenir dans les dimensions (défaut)
  - **cover**: Couvrir les dimensions
  - **fill**: Remplir exactement (peut déformer)
  - **contain**: Contenir sans agrandir
  - **outside**: À l'extérieur des dimensions

#### 🔄 Rotation
- Rotation par pas de 90° (0°, 90°, 180°, 270°)
- Curseur pour rotation personnalisée

#### 🔃 Retournement
- Horizontal (miroir)
- Vertical (flip)
- Les deux

#### 🎨 Filtres
- **Noir et blanc** (grayscale)
- **Flou** (blur) : 0-20
- **Netteté** (sharpen) : 0-10
- **Luminosité** (brightness) : 0.5-2.0
- **Contraste** (contrast) : 0.5-2.0
- **Saturation** (saturation) : 0-2.0

#### 📄 Format et qualité
- Formats de sortie :
  - JPEG
  - PNG
  - WebP
  - AVIF
  - GIF
  - TIFF
- Qualité réglable : 1-100%

### Options de sauvegarde

- **Créer une nouvelle image** : Garde l'originale et crée une nouvelle version éditée
- **Remplacer l'image originale** : Met à jour le fichier existant (⚠️ irréversible)

## Architecture

### Backend

#### 1. ImageEditorService (`services/imageEditorService.js`)

Service principal utilisant Sharp pour les transformations :

**Méthodes principales :**

```javascript
// Appliquer des transformations à une image
static async applyTransformations(inputPath, outputPath, operations)

// Éditer une pièce jointe image
static async editAttachmentImage(attachmentId, operations, user, replaceOriginal)

// Obtenir les métadonnées d'une image
static async getImageMetadata(attachmentId, user)

// Générer une miniature pour aperçu
static async generateThumbnail(imagePath, maxWidth, maxHeight)
```

**Opérations supportées :**

```javascript
{
  resize: { width: 800, height: 600, fit: 'inside' },
  crop: { left: 0, top: 0, width: 100, height: 100 },
  rotate: 90,
  flip: 'horizontal' | 'vertical' | 'both',
  grayscale: true,
  blur: 5,
  sharpen: 2,
  negate: true,
  normalize: true,
  brightness: 1.2,
  contrast: 1.1,
  saturation: 1.5,
  hue: 180,
  format: 'jpeg' | 'png' | 'webp' | 'avif',
  quality: 90
}
```

#### 2. Routes API (`routes/imageEditor.js`)

**GET `/_api/attachments/:id/image-metadata`**
- Récupère les métadonnées de l'image (dimensions, format, taille, etc.)
- Nécessite : Permission de lecture sur la table parente

**POST `/_api/attachments/:id/edit-image`**
- Applique les transformations et sauvegarde l'image
- Body : `{ operations: {...}, replaceOriginal: boolean }`
- Retourne : `{ success: true, attachmentId, replaced, metadata }`

**GET `/_api/attachments/:id/preview`**
- Génère un aperçu en temps réel avec les transformations
- Query params : width, height, rotate, flip, grayscale, blur, sharpen, format, quality
- Retourne : Buffer image (pour affichage direct)

### Frontend

#### 1. ImageEditorModal (`public/js/components/dialogs/ImageEditorModal.js`)

Composant modal React pour l'édition d'images :

**Props :**
- `attachmentId` : ID de la pièce jointe à éditer
- `attachment` : Objet attachment complet
- `onSave` : Callback appelé après sauvegarde réussie
- `onCancel` : Callback pour fermer le modal

**État :**
```javascript
{
  metadata: null,           // Métadonnées de l'image
  resize: { ... },          // Paramètres de redimensionnement
  rotate: 0,                // Angle de rotation
  flip: 'none',             // Mode de retournement
  grayscale: false,         // Filtre noir et blanc
  blur: 0,                  // Intensité du flou
  sharpen: 0,               // Intensité de la netteté
  brightness: 1,            // Luminosité
  contrast: 1,              // Contraste
  saturation: 1,            // Saturation
  format: 'jpeg',           // Format de sortie
  quality: 90,              // Qualité de sortie
  replaceOriginal: false,   // Remplacer ou créer nouveau
  activeTab: 'transform',   // Onglet actif
  previewUrl: ''            // URL de l'aperçu
}
```

**Fonctionnalités UI :**
- Interface à onglets (Transformer, Filtres, Format)
- Aperçu en temps réel avec debounce (300ms)
- Curseurs interactifs pour les valeurs numériques
- Boutons pour les valeurs prédéfinies
- Checkbox pour remplacer l'original

#### 2. Intégration dans AttachmentsTab

**Nouveau bouton :**
- Bouton "🖼️ Éditer l'image" affiché uniquement pour les images
- Visible seulement si l'utilisateur a la permission `canUpdate`
- Couleur distinctive (#17a2b8 - cyan)

**Flow utilisateur :**
1. Cliquer sur "🖼️ Éditer l'image"
2. Le modal s'ouvre avec l'image chargée
3. Ajuster les transformations en temps réel
4. Choisir "Créer nouvelle" ou "Remplacer originale"
5. Cliquer sur "💾 Enregistrer"
6. L'image est traitée côté serveur
7. La liste des pièces jointes se recharge
8. Message de confirmation affiché

## Utilisation

### Depuis l'interface utilisateur

1. **Ouvrir une fiche** avec des pièces jointes
2. **Aller dans l'onglet Pièces jointes**
3. **Cliquer sur "🖼️ Éditer l'image"** sur une image
4. **Ajuster les transformations** :
   - Onglet **Transformer** : redimensionner, rotation, retournement
   - Onglet **Filtres** : noir et blanc, flou, netteté, luminosité, contraste, saturation
   - Onglet **Format** : changer le format et la qualité
5. **Voir l'aperçu** en temps réel dans la zone de gauche
6. **Choisir** "Créer nouvelle" ou "Remplacer originale"
7. **Cliquer sur "💾 Enregistrer"**

### Depuis l'API

**Obtenir les métadonnées :**
```bash
GET /_api/attachments/123/image-metadata
```

**Aperçu avec transformations :**
```bash
GET /_api/attachments/123/preview?width=800&height=600&rotate=90&grayscale=true
```

**Appliquer les transformations :**
```bash
POST /_api/attachments/123/edit-image
Content-Type: application/json

{
  "operations": {
    "resize": { "width": 800, "height": 600, "fit": "inside" },
    "rotate": 90,
    "grayscale": true,
    "format": "webp",
    "quality": 85
  },
  "replaceOriginal": false
}
```

## Exemples de cas d'usage

### Cas 1 : Redimensionner pour le web

```javascript
{
  resize: { width: 1200, height: 800, fit: 'inside' },
  format: 'webp',
  quality: 85
}
```

### Cas 2 : Créer une vignette

```javascript
{
  resize: { width: 300, height: 300, fit: 'cover' },
  sharpen: 1,
  format: 'jpeg',
  quality: 80
}
```

### Cas 3 : Convertir en noir et blanc

```javascript
{
  grayscale: true,
  contrast: 1.2,
  sharpen: 1,
  format: 'jpeg',
  quality: 90
}
```

### Cas 4 : Rotation et correction

```javascript
{
  rotate: 90,
  brightness: 1.1,
  contrast: 1.05,
  sharpen: 0.5,
  format: 'png'
}
```

## Performance

### Optimisations

1. **Debounce sur l'aperçu** : 300ms pour éviter trop de requêtes
2. **Compression automatique** : Sharp utilise mozjpeg pour JPEG
3. **Formats modernes** : Support de WebP et AVIF pour réduction de poids
4. **Cache navigateur** : Utilise timestamp dans URL pour éviter le cache

### Recommandations

- Pour les images lourdes (> 5MB), privilégier "Remplacer originale" pour économiser l'espace
- Utiliser WebP pour les photos web (meilleur ratio qualité/poids)
- Utiliser PNG pour les images avec transparence
- Ajuster la qualité selon l'usage (80-85 pour web, 90-95 pour impression)

## Sécurité

### Validations

1. **Authentification** : Utilisateur connecté requis
2. **Permissions** : Vérification `canUpdate` sur la table parente
3. **Type de fichier** : Vérifie que c'est bien une image
4. **Chemins sécurisés** : Utilise `path.join()` pour éviter les path traversal

### Limitations

- Taille max de fichier : Limitée par Sharp et Node.js (généralement 4GB)
- Formats supportés : Ceux supportés par Sharp (JPEG, PNG, WebP, AVIF, GIF, TIFF, SVG)
- Permissions : Héritées de la table parente

## Dépendances

### NPM Packages

```json
{
  "sharp": "^0.34.5"
}
```

### Sharp - Bibliothèque d'édition d'images

**Avantages :**
- ⚡ Très rapide (utilise libvips)
- 🎨 Nombreuses transformations supportées
- 🔧 API simple et intuitive
- 📦 Formats modernes (WebP, AVIF)
- 🔒 Sécurisé et maintenu activement

**Limitations :**
- Nécessite compilation native (peut être long à installer)
- Pas de support pour les fichiers PSD, AI, etc.
- Mémoire intensive pour très grandes images

## Installation

Sharp est déjà installé via npm :

```bash
npm install sharp
```

Note : L'installation peut prendre quelques minutes car Sharp compile des binaires natifs.

## Fichiers créés/modifiés

```
services/imageEditorService.js              [NOUVEAU] Service Sharp
routes/imageEditor.js                       [NOUVEAU] Routes API
public/js/components/dialogs/ImageEditorModal.js  [NOUVEAU] UI Modal
server.js                                   [MODIFIÉ] Import des routes
services/templateService.js                 [MODIFIÉ] Script ImageEditorModal
public/js/components/details/AttachmentsTab.js    [MODIFIÉ] Bouton et intégration
package.json                                [MODIFIÉ] Dépendance Sharp
```

## Améliorations futures

- [ ] Historique des modifications avec undo/redo
- [ ] Crop interactif avec sélection visuelle
- [ ] Présets de transformations (profils)
- [ ] Traitement par lots (batch editing)
- [ ] Filtres avancés (sépia, vintage, etc.)
- [ ] Texte et watermarks
- [ ] Comparaison avant/après côte à côte
- [ ] Export en multiple formats simultanément
- [ ] Optimisation automatique pour différents usages (web, mobile, impression)
- [ ] Support des métadonnées EXIF

## Troubleshooting

### Erreur d'installation de Sharp

Si Sharp ne s'installe pas correctement :

```bash
# Supprimer node_modules et package-lock.json
rm -rf node_modules package-lock.json

# Réinstaller
npm install
```

### L'aperçu ne se charge pas

1. Vérifier que le serveur est démarré
2. Vérifier la console navigateur pour les erreurs
3. Vérifier que l'image existe bien sur le disque
4. Vérifier les permissions de lecture sur le fichier

### L'image sauvegardée est corrompue

1. Vérifier l'espace disque disponible
2. Vérifier les permissions d'écriture dans `storage/uploads/`
3. Vérifier les logs serveur pour les erreurs Sharp

### Les transformations ne s'appliquent pas

1. Vérifier que les opérations sont valides
2. Vérifier que Sharp supporte le format source
3. Essayer de réduire le nombre de transformations simultanées

## Support

Pour toute question ou problème :

1. Vérifier les logs serveur (console)
2. Vérifier les logs navigateur (console)
3. Consulter la documentation Sharp : https://sharp.pixelplumbing.com/
4. Tester avec une image simple (petit JPEG)

## Références

- [Sharp Documentation](https://sharp.pixelplumbing.com/)
- [Schema2 CLAUDE.md](../CLAUDE.md)
- [Attachment Feature](./ATTACHMENT_FEATURE.md)
- [Services API](./SERVICES_API.md)
