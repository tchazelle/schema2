const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { hasPermission, getUserAllRoles, getAccessibleTables } = require('../services/permissionService');
const schema = require('../schema.js');
const SchemaService = require('../services/schemaService');
const EntityService = require('../services/entityService');
const CrudService = require('../services/crudService');
const TemplateService = require('../services/templateService');
const TableDataService = require('../services/tableDataService');
const UIService = require('../services/uiService');
const SearchService = require('../services/searchService');

// getTableStructure() a été déplacée dans SchemaService.getTableStructure()

/**
 * =============================================================================
 * ROUTES CRUD - Documentation et Analyse d'utilisation
 * =============================================================================
 *
 * Ce fichier définit les routes pour l'interface CRUD dynamique.
 * Toutes les routes sont préfixées par /_crud (défini dans server.js)
 *
 * ROUTES ACTIVES (utilisées par le frontend):
 * ============================================
 *
 * 1. GET /_crud/:table/data
 *    - Retourne les données JSON pour l'interface CRUD list
 *    - Utilisée par: crudList.js (ligne 3570)
 *    - Paramètres: limit, offset, orderBy, order, search, showSystemFields, selectedFields, advancedSearch, advancedSort
 *    - Service: CrudService.getListData()
 *    - Status: ✅ ACTIVE
 *
 * 2. GET /_crud/:table
 *    - Sert l'interface HTML CRUD React-based avec navigation
 *    - Utilisée par: Navigation utilisateur (liens menu, etc.)
 *    - Template: TemplateService.htmlCrudPage()
 *    - Service: CrudService.getMenuTables()
 *    - Status: ✅ ACTIVE
 *
 * 3. GET /_crud/:table/structure
 *    - Retourne la structure des champs accessibles avec les relations
 *    - Utilisée par: fieldSelectorUI.js (ligne 30), crudList.js (lignes 1719, 2162, 2202, 2526, 2566)
 *    - Service: SchemaService.getTableStructure()
 *    - Status: ✅ ACTIVE
 *
 * 4. GET /_crud/:table/:id
 *    - Récupère un enregistrement spécifique avec vérification des permissions
 *    - Utilisée par: crudList.js (ligne 1054) - lien vers la fiche détail
 *    - Actuellement: Retourne JSON uniquement
 *    - TODO: Supporter HTML pour affichage plein écran de la fiche
 *    - Status: ⚠️ EN COURS DE MODIFICATION (JSON + HTML à implémenter)
 *
 * ROUTES LEGACY (non utilisées ou obsolètes):
 * ===========================================
 *
 * 5. GET /_crud/:table/view
 *    - Interface HTML legacy pour visualiser la structure avec fieldSelectorUI
 *    - Utilisée par: Aucune référence dans le code frontend actuel
 *    - Status: ⚠️ LEGACY - À considérer pour suppression
 *    - Note: Pourrait être utile pour debug/développement
 *
 * =============================================================================
 */


/**
 * GET /_crud
 * Multi-table search interface
 */
router.get('/', async (req, res) => {
  try {
    const user = req.user; // Already enriched by userEnrichMiddleware

    // Get accessible tables for menu
    const accessibleTables = user ? CrudService.getMenuTables(user) : [];

    // Get pages for menu
    let pages = [];
    try {
      const pagesFromTablePage = await TableDataService.getTableData(user, schema.menu.page, {});
      pages = pagesFromTablePage.rows || [];
    } catch (error) {
      console.error('Error loading pages for menu:', error);
    }

    // Get search statistics
    const searchStats = SearchService.getSearchStats(user);

    // Serve the search interface
    const html = TemplateService.htmlSearchPage({
      user: user,
      pages: pages,
      accessibleTables: accessibleTables,
      searchStats: searchStats
    });

    res.send(html);

  } catch (error) {
    console.error('Error rendering search page:', error);
    res.status(500).send(UIService.error500Page(error));
  }
});

/**
 * GET /_crud/search
 * API endpoint for multi-table search
 */
router.get('/search', async (req, res) => {
  try {
    const user = req.user;
    const { q, limit = 10 } = req.query;

    if (!q || q.trim() === '') {
      return res.json({
        success: true,
        results: {},
        totalResults: 0,
        searchTerm: '',
        message: 'Veuillez saisir un terme de recherche'
      });
    }

    const result = await SearchService.searchAll(user, q, {
      limit: parseInt(limit)
    });

    res.json(result);

  } catch (error) {
    console.error('Error executing search:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recherche',
      details: error.message
    });
  }
});

/**
 * GET /_crud/:table
 * Serves the new React-based CRUD list interface with site navigation
 */
router.get('/:table', async (req, res) => {
  try {
    const { table: tableParam } = req.params;
    const user = req.user; // Already enriched by userEnrichMiddleware

    // Normalize table name
    const table = SchemaService.getTableName(tableParam);

    // Check if table exists
    if (!table) {
      return res.status(404).send(UIService.error404Page('Table', tableParam));
    }

    // Check if user has read permission
    if (!hasPermission(user, table, 'read')) {
      return res.status(403).send(UIService.error403Page());
    }

    // user is already enriched by userEnrichMiddleware with all necessary info
    // (fullName, abbreviation, allRoles, etc.)

    // Get accessible tables for menu (tables user can create or update)
    const accessibleTables = user ? CrudService.getMenuTables(user) : [];

    // Get pages for menu
    let pages = [];
    try {
      const pagesFromTablePage = await TableDataService.getTableData(user, schema.menu.page, {});
      pages = pagesFromTablePage.rows || [];
    } catch (error) {
      console.error('Error loading pages for menu:', error);
      // Continue without pages in menu
    }

    // Serve the React-based CRUD interface with navigation
    const html = TemplateService.htmlCrudPage({
      user: user,
      pages: pages,
      table: table,
      accessibleTables: accessibleTables
    });

    res.send(html);

  } catch (error) {
    console.error('Error rendering CRUD page:', error);
    res.status(500).send(UIService.error500Page(error));
  }
});

/**
 * GET /_crud/:table/structure
 * Retourne la structure des champs accessibles de la table
 * ainsi que les champs des relations si autorisés
 * (Used by fieldSelectorUI)
 */
router.get('/:table/structure', async (req, res) => {
  try {
    const { table: tableParam } = req.params;
    const user = req.user; // Déjà enrichi par userEnrichMiddleware

    // Normaliser le nom de la table (case-insensitive)
    const table = SchemaService.getTableName(tableParam);

    if (!table) {
      return res.status(404).json(UIService.jsonError(
        UIService.messages.TABLE_NOT_FOUND,
        { table: tableParam }
      ));
    }

    // Récupérer la structure de la table
    const structure = SchemaService.getTableStructure(user, table);

    if (!structure) {
      return res.status(403).json(UIService.jsonError(
        UIService.messages.ACCESS_DENIED,
        { table: table }
      ));
    }

    res.json(UIService.jsonSuccess({ structure }));

  } catch (error) {
    console.error('Erreur lors de la récupération de la structure:', error);
    res.status(500).json(UIService.jsonError(UIService.messages.ERROR_SERVER));
  }
});

/**
 * GET /_crud/:table/view
 * Affiche une interface HTML pour visualiser la structure de la table avec fieldSelectorUI
 *
 * ⚠️ LEGACY ROUTE - Non utilisée dans le frontend actuel
 * Cette route pourrait être supprimée ou conservée uniquement pour debug/développement
 * Aucune référence trouvée dans crudList.js ou autres composants frontend
 */
router.get('/:table/view', async (req, res) => {
  try {
    const { table: tableParam } = req.params;
    const user = req.user; // Déjà enrichi par userEnrichMiddleware

    // Normaliser le nom de la table (case-insensitive)
    const table = SchemaService.getTableName(tableParam);

    // Vérifier si la table existe
    if (!table) {
      return res.status(404).send(UIService.error404Page('Table', tableParam));
    }

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRUD - ${table}</title>
  <link rel="stylesheet" href="/css/variables.css">
  
  <link rel="stylesheet" href="/css/common.css">
  <link rel="stylesheet" href="/css/navigation.css">
  <link rel="stylesheet" href="/css/json-viewer.css">
  <link rel="stylesheet" href="/css/crud.css">
  <link rel="stylesheet" href="/css/generic.css">
</head>
<body>
  <div class="container">
    <h1>📋 CRUD - ${table}</h1>
    <div class="subtitle">Interface de gestion de la table ${table}</div>

    <div class="nav">
      <a href="/">← Accueil</a>
      <a href="/_debug/json">Debug JSON</a>
      <a href="/_debug/fieldSelector/${table}">Test Field Selector</a>
      <a href="/_crud/${table}" target="_blank">API JSON</a>
    </div>

    <div class="section">
      <h2>🎯 Sélecteur de champs</h2>
      <div id="field-selector-container"></div>
    </div>

    <div class="section">
      <h2>📊 Structure de la table (JSON)</h2>
      <div class="json-display" id="json-structure">
        <div style="text-align: center; color: #858585;">⏳ Chargement...</div>
      </div>
    </div>
  </div>

  <script src="/js/fieldSelectorUI.js"></script>
  <script>
    function syntaxHighlight(json) {
      if (typeof json !== 'string') {
        json = JSON.stringify(json, null, 2);
      }
      json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return json.replace(/("(\\\\u[a-zA-Z0-9]{4}|\\\\[^u]|[^\\\\"])*"(\\\\s*:)?|\\\\b(true|false|null)\\\\b|-?\\\\d+(?:\\\\.\\\\d*)?(?:[eE][+\\\\-]?\\\\d+)?)/g, function (match) {
        var cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      });
    }

    let fieldSelectorInstance;

    document.addEventListener('DOMContentLoaded', async () => {
      // Initialiser le field selector
      const container = document.getElementById('field-selector-container');

      fieldSelectorInstance = new FieldSelectorUI({
        table: '${table}',
        container: container,
        showSystemFields: false,
        onFieldSelect: (path, field) => {
        }
      });

      try {
        await fieldSelectorInstance.init();
      } catch (error) {
        container.innerHTML = '<div style="color: red; padding: 20px;">Erreur lors du chargement: ' + error.message + '</div>';
      }

      // Charger la structure JSON
      try {
        const response = await fetch('/_crud/${table}');
        const data = await response.json();
        document.getElementById('json-structure').innerHTML = '<pre>' + syntaxHighlight(data) + '</pre>';
      } catch (error) {
        document.getElementById('json-structure').innerHTML = '<div style="color: #f48771; text-align: center;">❌ Erreur: ' + error.message + '</div>';
      }
    });
  </script>
</body>
</html>
    `;

    res.send(html);

  } catch (error) {
    console.error('Erreur lors de la génération de la page CRUD view:', error);
    res.status(500).send(UIService.error500Page(error));
  }
});

/**
 * GET /_crud/:table/data
 * Returns JSON data for the CRUD list interface
 */
router.get('/:table/data', async (req, res) => {
  try {
    const { table: tableParam } = req.params;
    const user = req.user; // Already enriched by userEnrichMiddleware

    // Get query parameters
    const {
      limit = 100,
      offset = 0,
      orderBy = 'updatedAt',
      order = 'DESC',
      search = '',
      showSystemFields = '0',
      selectedFields = null,
      advancedSearch = null,
      advancedSort = null
    } = req.query;

    // Parse selectedFields if provided (comma-separated)
    const parsedFields = selectedFields ? selectedFields.split(',').map(f => f.trim()) : null;

    // Parse advanced search and sort JSON
    let parsedAdvancedSearch = null;
    let parsedAdvancedSort = null;

    if (advancedSearch) {
      try {
        parsedAdvancedSearch = JSON.parse(advancedSearch);
      } catch (e) {
      }
    }

    if (advancedSort) {
      try {
        parsedAdvancedSort = JSON.parse(advancedSort);
      } catch (e) {
      }
    }

    // Get list data using CrudService
    const result = await CrudService.getListData(user, tableParam, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy,
      order,
      search,
      showSystemFields: showSystemFields === '1',
      selectedFields: parsedFields,
      advancedSearch: parsedAdvancedSearch,
      advancedSort: parsedAdvancedSort
    });

    if (!result.success) {
      return res.status(result.error.includes('non trouvée') ? 404 : 403).json(result);
    }

    res.json(result);

  } catch (error) {
    console.error('Error fetching CRUD data:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la récupération des données'
    });
  }
});


/**
 * GET /_crud/:table/:id
 * Récupère un enregistrement spécifique avec vérification des permissions
 * Retourne JSON si Accept: application/json, sinon redirige vers /_crud/:table?open=:id
 */
router.get('/:table/:id', async (req, res) => {
  try {
    const { table: tableParam, id } = req.params;
    const user = req.user; // Déjà enrichi par userEnrichMiddleware

    // Normaliser le nom de la table (case-insensitive)
    const table = SchemaService.getTableName(tableParam);

    // Check if JSON or HTML response is expected
    const acceptsJson = req.accepts(['html', 'json']) === 'json';

    // Vérifier si la table existe dans le schéma
    if (!table) {
      if (acceptsJson) {
        return res.status(404).json(UIService.jsonError(UIService.messages.TABLE_NOT_FOUND));
      } else {
        return res.status(404).send(UIService.error404Page('Table', tableParam));
      }
    }

    // Vérifier si l'utilisateur a accès à la table
    if (!hasPermission(user, table, 'read')) {
      if (acceptsJson) {
        return res.status(403).json(UIService.jsonError(UIService.messages.ACCESS_DENIED));
      } else {
        return res.status(403).send(UIService.error403Page());
      }
    }

    if (acceptsJson) {
      // Récupérer l'enregistrement pour les requêtes JSON
      const result = await TableDataService.getTableData(user, table, {
        id: parseInt(id),
        relation: 'all',
        compact: true,
        includeSchema: '1'
      });

      // Handle service errors
      if (!result.success) {
        const statusCode = result.statusCode || 500;
        const errorMessage = result.error || 'Erreur serveur';
        return res.status(statusCode).json({ success: false, error: errorMessage });
      }

      // Handle record not found
      if (!result.rows || result.rows.length === 0) {
        return res.status(404).json(UIService.jsonError(UIService.messages.RECORD_NOT_FOUND));
      }

      const row = result.rows[0];
      res.json({
        success: true,
        table: table,
        id: id,
        rows: row
      });
    } else {
      // Pour les requêtes HTML, rediriger vers /_crud/:table?open=:id
      // Cela permet d'utiliser l'interface de liste avec la fiche ouverte automatiquement
      const queryParams = new URLSearchParams(req.query);
      queryParams.set('open', id);
      return res.redirect(`/_crud/${table}?${queryParams.toString()}`);
    }

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'enregistrement:', error);
    const acceptsJson = req.accepts(['html', 'json']) === 'json';
    if (acceptsJson) {
      res.status(500).json(UIService.jsonError(UIService.messages.ERROR_SERVER));
    } else {
      res.status(500).send(UIService.error500Page(error));
    }
  }
});


/* A SUPPRIMER EN DESSOUS DE CETTE LIGNE ================== */









module.exports = router;

