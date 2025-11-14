const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { hasPermission, getUserAllRoles } = require('../services/permissionService');
const schema = require('../schema.js');
const SchemaService = require('../services/schemaService');
const EntityService = require('../services/entityService');
const CrudService = require('../services/crudService');

// getTableStructure() a été déplacée dans SchemaService.getTableStructure()

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
      selectedFields = null
    } = req.query;

    // Parse selectedFields if provided (comma-separated)
    const parsedFields = selectedFields ? selectedFields.split(',').map(f => f.trim()) : null;

    // Get list data using CrudService
    const result = await CrudService.getListData(user, tableParam, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      orderBy,
      order,
      search,
      showSystemFields: showSystemFields === '1',
      selectedFields: parsedFields
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
 * GET /_crud/:table
 * Serves the new React-based CRUD list interface
 */
router.get('/:table', async (req, res) => {
  try {
    const { table: tableParam } = req.params;
    const user = req.user; // Already enriched by userEnrichMiddleware

    // Normalize table name
    const table = SchemaService.getTableName(tableParam);

    // Check if table exists
    if (!table) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html><body><h1>Table non trouvée</h1><p>La table "${tableParam}" n'existe pas.</p></body></html>
      `);
    }

    // Check if user has read permission
    if (!hasPermission(user, table, 'read')) {
      return res.status(403).send(`
        <!DOCTYPE html>
        <html><body><h1>Accès refusé</h1><p>Vous n'avez pas la permission d'accéder à cette table.</p></body></html>
      `);
    }

    // Serve the React-based CRUD interface
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRUD - ${table}</title>
  <link rel="stylesheet" href="/css/common.css">
  <link rel="stylesheet" href="/css/crud.css">

  <!-- React from CDN (production) -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
</head>
<body>
  <div id="root"></div>

  <!-- CRUD List Component -->
  <script src="/js/crudList.js"></script>

  <script>
    // Mount the React component
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(CrudList, { table: '${table}' }));
  </script>
</body>
</html>
    `;

    res.send(html);

  } catch (error) {
    console.error('Error rendering CRUD page:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html><body><h1>Erreur serveur</h1><p>${error.message}</p></body></html>
    `);
  }
});

/**
 * GET /_crud/:table/view
 * Affiche une interface HTML pour visualiser la structure de la table avec fieldSelectorUI
 * (Legacy route)
 */
router.get('/:table/view', async (req, res) => {
  try {
    const { table: tableParam } = req.params;
    const user = req.user; // Déjà enrichi par userEnrichMiddleware

    // Normaliser le nom de la table (case-insensitive)
    const table = SchemaService.getTableName(tableParam);

    // Vérifier si la table existe
    if (!table) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html><body><h1>Table non trouvée</h1><p>La table "${tableParam}" n'existe pas.</p></body></html>
      `);
    }

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRUD - ${table}</title>
  <link rel="stylesheet" href="/css/common.css">
  <link rel="stylesheet" href="/css/navigation.css">
  <link rel="stylesheet" href="/css/json-viewer.css">
  <link rel="stylesheet" href="/css/crud.css">
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
          console.log('Champ sélectionné:', path, field);
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
    res.status(500).send(`
      <!DOCTYPE html>
      <html><body><h1>Erreur serveur</h1><p>${error.message}</p></body></html>
    `);
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
      return res.status(404).json({
        error: 'Table non trouvée',
        table: tableParam
      });
    }

    // Récupérer la structure de la table
    const structure = SchemaService.getTableStructure(user, table);

    if (!structure) {
      return res.status(403).json({
        error: 'Accès refusé à cette table',
        table: table
      });
    }

    res.json({
      success: true,
      structure: structure
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la structure:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération de la structure'
    });
  }
});

/**
 * GET /_crud/:table/:id
 * Récupère un enregistrement spécifique avec vérification des permissions
 */
router.get('/:table/:id', async (req, res) => {
  try {
    const { table: tableParam, id } = req.params;
    const user = req.user; // Déjà enrichi par userEnrichMiddleware

    // Normaliser le nom de la table (case-insensitive)
    const table = SchemaService.getTableName(tableParam);

    // Vérifier si la table existe dans le schéma
    if (!table) {
      return res.status(404).json({
        error: 'Table non trouvée'
      });
    }

    // Vérifier si l'utilisateur a accès à la table
    if (!hasPermission(user, table, 'read')) {
      return res.status(403).json({
        error: 'Accès refusé à cette table'
      });
    }

    // Récupérer l'enregistrement
    const [rows] = await pool.query(
      `SELECT * FROM ${table} WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Enregistrement non trouvé'
      });
    }

    const row = rows[0];

    // Vérifier les permissions sur la row selon le champ granted
    if (row.granted) {
      // Si granted = draft, seul le propriétaire peut lire
      if (row.granted === 'draft') {
        if (!user || row.ownerId !== user.id) {
          return res.status(403).json({
            error: 'Accès refusé : cet enregistrement est en brouillon'
          });
        }
      }
      // Si granted = published @role, vérifier le rôle
      else if (row.granted.startsWith('published @')) {
        const requiredRole = row.granted.replace('published @', '');
        const userRoles = getUserAllRoles(user);
        if (!userRoles.includes(requiredRole)) {
          return res.status(403).json({
            error: `Accès refusé : nécessite le rôle ${requiredRole}`
          });
        }
      }
      // Si granted = shared, adopter le granted de la table (déjà vérifié)
    }

    // Filtrer les champs selon les permissions
    const structure = SchemaService.getTableStructure(user, table);
    const filteredRow = {};

    for (const fieldName in structure.fields) {
      if (row[fieldName] !== undefined) {
        filteredRow[fieldName] = row[fieldName];
      }
    }

    res.json({
      success: true,
      table: table,
      id: id,
      rows: filteredRow
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'enregistrement:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération de l\'enregistrement'
    });
  }
});

module.exports = router;
