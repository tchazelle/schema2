# Phase 2 : Extraction de la logique métier et des templates

## 📊 Résumé

La Phase 2 extrait **toute la logique métier** des routes vers des services dédiés, nettoyant massivement le code de `routes/pages.js`.

## 🆕 Nouveaux services créés

### 1. **services/pageService.js** (200 lignes)

Service pour la gestion des pages et sections :

**Fonctions principales :**
- `getPageBySlug(slug, user)` - Charge une page par slug avec vérification des permissions
- `getPageSections(pageId, user)` - Charge les sections d'une page avec filtrage par permissions
- `getPageWithSections(slug, user)` - Charge page + sections en une seule requête
- `getAccessiblePages(user)` - Liste toutes les pages accessibles
- `buildPageResponse(page, sections, user)` - Construit la réponse formatée

**Bénéfices :**
- ✅ Logique de chargement des pages centralisée
- ✅ Gestion des permissions intégrée
- ✅ Parsing automatique des relations JSON
- ✅ Réutilisable dans toute l'application

### 2. **services/templateService.js** (680 lignes)

Service pour la génération de templates HTML :

**Fonctions principales :**
- `htmlLogin()` - Formulaire de connexion
- `htmlSitePage(options)` - Page complète avec header, menu, sidebar
- `scriptHumanize()` - Script client pour humaniser les dates/durées

**Extraction depuis routes/pages.js :**
- Ligne 12-27 : `htmlLogin()` → TemplateService
- Ligne 30-524 : `htmlSitePage()` → TemplateService (500+ lignes !)
- Ligne 714-768 : `humanize()` → TemplateService.scriptHumanize()

**Bénéfices :**
- ✅ 500+ lignes de HTML extraites des routes
- ✅ Templates centralisés et réutilisables
- ✅ Facilite la création de templates alternatifs
- ✅ Prépare la migration vers un système de templates fichiers

## 📝 Fichiers créés

### routes/pages_refactored.js (185 lignes vs 917 lignes avant)

Version nettoyée de `routes/pages.js` :

**Améliorations :**
- 📉 **80% de réduction** du code (917 → 185 lignes)
- 🧹 Suppression du code mort et des duplications
- 🔧 Utilisation des services PageService et TemplateService
- 📦 Routes simplifiées et lisibles

**Routes :**
1. `GET /:slug?` - Page HTML avec rendu complet (utilise TemplateService)
2. `GET /:page` - API JSON pour récupérer une page (utilise PageService)

**Note :** La seconde route peut entrer en conflit avec la première. Suggestion : préfixer avec `/_pages/:page` pour l'API JSON.

## 🐛 Bugs identifiés et corrigés

### Bug critique dans routes/pages.js (ligne 783)

```javascript
// AVANT (routes/pages.js:783)
router.get('/:page', async (req, res) => {
  const { page: pageSlug } = req.params;
  res.send(pageSlug); // ❌ BUG: Envoie la réponse immédiatement !

  // ... 130 lignes de code qui ne seront jamais exécutées
  // ... et tentative de res.json() qui va échouer
});
```

Ce bug cause l'erreur `Error: Cannot set headers after they are sent to the client`.

**Solution dans pages_refactored.js :** La ligne `res.send(pageSlug)` a été supprimée.

## 📋 Comparaison avant/après

| Fichier | Avant | Après | Réduction |
|---------|-------|-------|-----------|
| `routes/pages.js` | 917 lignes | 185 lignes (refactored) | -80% |
| **Logique métier** | Dans les routes ❌ | Dans services ✅ | |
| **Templates HTML** | Inline dans routes ❌ | TemplateService ✅ | |
| **Code dupliqué** | Oui ❌ | Non ✅ | |
| **Code mort** | Oui (lignes 639-710) ❌ | Non ✅ | |

## 🔄 Migration suggérée

### Étape 1 : Tester la version refactorisée

```bash
# Backup de l'ancien fichier
mv routes/pages.js routes/pages_old.js

# Activer la nouvelle version
mv routes/pages_refactored.js routes/pages.js

# Redémarrer le serveur et tester
npm start
```

### Étape 2 : Si tout fonctionne

```bash
# Supprimer l'ancien fichier
rm routes/pages_old.js

# Commit
git add .
git commit -m "Refactor: Extraction logique métier vers services (Phase 2)"
```

### Étape 3 : Si des problèmes surviennent

```bash
# Revenir en arrière
mv routes/pages.js routes/pages_refactored.js
mv routes/pages_old.js routes/pages.js

# Signaler les problèmes rencontrés
```

## ⚠️ Points d'attention

### 1. Conflit de routes

Les deux routes `GET /:slug?` et `GET /:page` peuvent entrer en conflit. Suggestions :

**Option A** - Préfixer l'API JSON :
```javascript
router.get('/_pages/:page', async (req, res) => {
  // API JSON pour récupérer une page
});
```

**Option B** - Différencier par Accept header :
```javascript
router.get('/:slug', async (req, res) => {
  if (req.accepts('json')) {
    // Retourner JSON
  } else {
    // Retourner HTML
  }
});
```

### 2. Code spécifique non migré

Certaines logiques spécifiques de `routes/pages.js` (lignes 563-633) n'ont PAS été migrées vers les services car elles semblent être du code métier très spécifique :

- Conversion des options `translateTableDataOptions`
- Construction des sections avec `getTableData`
- Génération de templates Mustache dynamiques

**Recommandation :** Créer un service dédié `SectionRenderingService.js` si ce code doit être réutilisé ailleurs.

### 3. TODO techniques à adresser

- **[#TC] Sécurité cookies** (ligne 543-544) : Vérifier que les cookies JWT ne peuvent pas être forgés
- **[#TC] Schema.user** (ligne 549) : Utiliser `schema.user` au lieu de hardcoder `Person`
- **[#TC] CSS externe** (ligne 32) : Extraire le CSS inline vers un fichier externe
- **[#TC] Templates BDD** (ligne 611) : Intégrer les templates de la base de données

## 🎯 Bénéfices immédiats

1. **Maintenance facilitée** - La logique métier est centralisée
2. **Réutilisabilité** - Les services peuvent être utilisés ailleurs
3. **Testabilité** - Plus facile de tester les services isolément
4. **Lisibilité** - Les routes sont beaucoup plus claires
5. **Performance** - Code mort supprimé, optimisations possibles

## 🚀 Prochaines étapes (Phase 3)

1. **Créer SectionRenderingService.js** - Pour la logique de rendu des sections
2. **Extraire le CSS** - Créer `public/css/main.css`
3. **Migrer vers des fichiers templates** - Remplacer les strings par des fichiers `.mustache`
4. **Renommer les services existants** :
   - `permissions.js` → `services/permissionService.js`
   - `auth.js` → `services/authService.js`
   - `dbSync.js` → `services/dbService.js`

## 📚 Documentation

- Phase 1 : voir commit "Refactor: Élimination de la redondance de code via services centralisés"
- Phase 2 : ce document
- Services : voir JSDoc dans chaque fichier de service
