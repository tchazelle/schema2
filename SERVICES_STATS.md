# 📊 Statistiques d'utilisation des Services

Tableau complet des fonctions/méthodes par service avec nombre de lignes et d'appels dans le code.

**Généré le :** Phase 3 (commit e9ab111)

---

| Service | Fonction/Méthode | Lignes | Appels | Type |
|---------|------------------|--------|--------|------|
| authService | clearAuthCookie | 3 | 3 | function |
| authService | generateToken | 13 | 3 | function |
| authService | requireAuth | 6 | 1 | function |
| authService | setAuthCookie | 8 | 3 | function |
| authService | verifyToken | 7 | 2 | function |
| authService | authMiddleware | 13 | 1 | function |
| **Total authService** | **6 fonctions** | **50** | **13** | |
| | | | | |
| dbSyncService | syncDatabase | ~200 | 1 | function |
| **Total dbSyncService** | **1 fonction** | **~200** | **1** | |
| | | | | |
| entityService | buildWhereClause | 42 | 3 | static |
| entityService | canAccessEntity | 35 | 12 | static |
| entityService | canPerformAction | 16 | 0 | static |
| entityService | compactRelation | 23 | 3 | static |
| entityService | filterAccessibleEntities | 5 | 0 | static |
| entityService | filterEntityFields | 38 | 9 | static |
| **Total entityService** | **6 méthodes** | **159** | **27** | |
| | | | | |
| pageService | buildPageResponse | ~20 | 0 | static |
| pageService | getAccessiblePages | ~15 | 0 | static |
| pageService | getPageBySlug | ~25 | 0 | static |
| pageService | getPageSections | ~80 | 0 | static |
| pageService | getPageWithSections | ~18 | 0 | static |
| **Total pageService** | **5 méthodes** | **~158** | **0** | |
| | | | | |
| permissionService | getAccessibleTables | 11 | 5 | function |
| permissionService | getAllPermissions | 30 | 1 | function |
| permissionService | getInheritedRoles | 21 | 3 | function |
| permissionService | getUserAllRoles | 16 | 16 | function |
| permissionService | hasPermission | 22 | 29 | function |
| permissionService | parseUserRoles | 16 | 2 | function |
| **Total permissionService** | **6 fonctions** | **116** | **56** | |
| | | | | |
| repositoryService | count | 9 | 0 | static |
| repositoryService | create | 13 | 0 | static |
| repositoryService | delete | 7 | 0 | static |
| repositoryService | deleteWhere | 7 | 0 | static |
| repositoryService | exists | 8 | 0 | static |
| repositoryService | findAll | 34 | 0 | static |
| repositoryService | findByForeignKey | 21 | 0 | static |
| repositoryService | findById | 9 | 0 | static |
| repositoryService | findByIds | 11 | 0 | static |
| repositoryService | findOne | 8 | 0 | static |
| repositoryService | raw | 4 | 0 | static |
| repositoryService | transaction | 14 | 0 | static |
| repositoryService | update | 12 | 0 | static |
| repositoryService | updateWhere | 12 | 0 | static |
| **Total repositoryService** | **14 méthodes** | **169** | **0** | |
| | | | | |
| schemaService | buildFilteredSchema | 60 | 2 | static |
| schemaService | fieldExists | 5 | 0 | static |
| schemaService | getAllTableNames | 3 | 0 | static |
| schemaService | getDisplayFields | 4 | 2 | static |
| schemaService | getFieldConfig | 5 | 0 | static |
| schemaService | getTableConfig | 3 | 7 | static |
| schemaService | getTableName | 15 | 6 | static |
| schemaService | getTableRelations | 45 | 5 | static |
| schemaService | getTableStructure | 161 | 1 | static |
| schemaService | tableExists | 3 | 0 | static |
| **Total schemaService** | **10 méthodes** | **304** | **23** | |
| | | | | |
| tableDataService | getTableData | 139 | 7 | function |
| tableDataService | loadRelationsForRow | 134 | 2 | function |
| **Total tableDataService** | **2 fonctions** | **273** | **9** | |
| | | | | |
| templateService | htmlSitePage | ~100 | 0 | static |
| templateService | scriptHumanize | ~70 | 0 | static |
| templateService | htmlLogin | ~15 | 0 | static |
| **Total templateService** | **3 méthodes** | **~185** | **0** | |

---

## 📈 Statistiques globales

### Par service (nombre de fonctions)
```
permissionService    : 6 fonctions
authService          : 6 fonctions
entityService        : 6 méthodes
repositoryService    : 14 méthodes  ⭐ (nouveau)
schemaService        : 10 méthodes
tableDataService     : 2 fonctions
templateService      : 3 méthodes
pageService          : 5 méthodes
dbSyncService        : 1 fonction

Total : 53 fonctions/méthodes
```

### Par service (lignes de code)
```
schemaService        : 304 lignes  (le plus grand)
tableDataService     : 273 lignes
dbSyncService        : ~200 lignes
templateService      : ~185 lignes
repositoryService    : 169 lignes  ⭐ (nouveau)
entityService        : 159 lignes
pageService          : ~158 lignes
permissionService    : 116 lignes
authService          : 50 lignes

Total : ~1614 lignes
```

### Par service (nombre d'appels)
```
permissionService    : 56 appels   (le plus utilisé)
entityService        : 27 appels
schemaService        : 23 appels
authService          : 13 appels
tableDataService     : 9 appels
dbSyncService        : 1 appel
repositoryService    : 0 appel     ⭐ (nouveau, pas encore utilisé)
templateService      : 0 appel     (génération HTML directe)
pageService          : 0 appel     (utilisé via routes)

Total : 129 appels identifiés
```

### Top 10 fonctions les plus appelées
```
1. hasPermission               : 29 appels  (permissionService)
2. getUserAllRoles             : 16 appels  (permissionService)
3. canAccessEntity             : 12 appels  (entityService)
4. filterEntityFields          : 9 appels   (entityService)
5. getTableConfig              : 7 appels   (schemaService)
6. getTableData                : 7 appels   (tableDataService)
7. getTableName                : 6 appels   (schemaService)
8. getAccessibleTables         : 5 appels   (permissionService)
9. getTableRelations           : 5 appels   (schemaService)
10. buildWhereClause           : 3 appels   (entityService)
```

---

## 🎯 Insights

### Services centraux (les plus appelés)
- **permissionService** : 56 appels - Vérification permissions partout
- **entityService** : 27 appels - Filtrage et accès aux données
- **schemaService** : 23 appels - Métadonnées de schéma

### Services nouveaux (Phase 3)
- **repositoryService** : 0 appel - Créé pour usage futur ⭐
  - Prêt pour remplacer les requêtes SQL directes
  - 14 méthodes disponibles pour CRUD
  - Pattern Repository implémenté

### Services utilitaires
- **templateService** : 0 appel via import - Utilisé directement dans routes
- **pageService** : 0 appel via import - Utilisé directement dans routes

### Fonction la plus critique
- **hasPermission** : 29 appels
  - Sécurité de l'application
  - Appelée à chaque accès table/action
  - Performance critique

---

## 💡 Recommandations

### Court terme
1. ✅ **Ajouter tests unitaires** pour les top 10 fonctions
2. ✅ **Monitoring** : Logger les appels à hasPermission (perf)
3. ⏳ **Utiliser repositoryService** dans tableDataService

### Moyen terme
1. **Caching** : Mettre en cache getUserAllRoles (16 appels)
2. **Optimisation** : Index DB sur champs utilisés par hasPermission
3. **Refactoring** : Migrer toutes les requêtes SQL vers repositoryService

### Long terme
1. **Tests de charge** : Tester hasPermission avec 1000+ users
2. **Documentation** : Documenter les appels critiques
3. **Metrics** : Ajouter APM pour tracer les appels

---

**Note :** Les comptages sont basés sur l'analyse statique du code (grep).
Les appels dynamiques ou via variables ne sont pas comptabilisés.

**Dernière mise à jour :** Phase 3 (commit e9ab111)
