const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { hasPermission, getUserAllRoles } = require('../utils/permissions');
const schema = require('../schema.js');

/**
 * Trouve le nom exact d'une table dans le schéma, indépendamment de la casse
 * @param {string} tableName - Nom de la table (peut être en minuscules, majuscules, etc.)
 * @returns {string|null} - Nom exact de la table ou null si non trouvée
 */
function getTableName(tableName) {
  // Vérifier si le nom exact existe
  if (schema.tables[tableName]) {
    return tableName;
  }

  // Chercher en ignorant la casse
  const tableNameLower = tableName.toLowerCase();
  for (const key in schema.tables) {
    if (key.toLowerCase() === tableNameLower) {
      return key;
    }
  }

  return null;
}

/**
 * Récupère la structure d'une table avec les champs accessibles selon les permissions de l'utilisateur
 * Inclut également les relations si l'utilisateur y a accès
 * @param {Object} user - L'utilisateur connecté
 * @param {string} tableName - Nom de la table
 * @returns {Object|null} - Structure de la table ou null si non accessible
 */
function getTableStructure(user, tableName) {
  // Vérifier si la table existe
  const tableConfig = schema.tables[tableName];
  if (!tableConfig) {
    return null;
  }

  // Vérifier si l'utilisateur a le droit de lecture sur la table
  if (!hasPermission(user, tableName, 'read')) {
    return null;
  }

  const userRoles = getUserAllRoles(user);
  const structure = {
    tableName: tableName,
    displayField: tableConfig.displayField || schema.defaultConfigTable.displayField,
    searchFields: tableConfig.searchFields || schema.defaultConfigTable.searchFields,
    pageSize: tableConfig.pageSize || schema.defaultConfigTable.pageSize,
    dateFormat: tableConfig.dateFormat || schema.defaultConfigTable.dateFormat,
    cardWidth: tableConfig.cardWidth || schema.defaultConfigTable.cardWidth,
    hasAttachmentsTab: tableConfig.hasAttachmentsTab !== undefined
      ? tableConfig.hasAttachmentsTab
      : schema.defaultConfigTable.hasAttachmentsTab,
    fields: {},
    relations: {},
    permissions: {
      read: hasPermission(user, tableName, 'read'),
      create: hasPermission(user, tableName, 'create'),
      update: hasPermission(user, tableName, 'update'),
      delete: hasPermission(user, tableName, 'delete'),
      publish: hasPermission(user, tableName, 'publish')
    }
  };

  // Parcourir les champs de la table
  for (const fieldName in tableConfig.fields) {
    const fieldConfig = tableConfig.fields[fieldName];

    // Vérifier les permissions spécifiques au champ (si définies)
    let fieldAccessible = true;
    if (fieldConfig.grant) {
      fieldAccessible = false;
      for (const role of userRoles) {
        if (fieldConfig.grant[role] && fieldConfig.grant[role].includes('read')) {
          fieldAccessible = true;
          break;
        }
      }
    }

    if (!fieldAccessible) {
      continue; // Ignorer ce champ
    }

    // Ajouter le champ à la structure
    const field = {
      type: fieldConfig.type,
      isPrimary: fieldConfig.isPrimary || false,
      autoIncrement: fieldConfig.autoIncrement || false,
      default: fieldConfig.default,
      renderer: fieldConfig.renderer,
      values: fieldConfig.values, // Pour les enums
      as: fieldConfig.as, // Pour les champs calculés SQL
      calculate: fieldConfig.calculate ? 'function' : undefined, // Indiquer qu'il y a une fonction de calcul
      stat: fieldConfig.stat
    };

    // Si c'est une relation
    if (fieldConfig.relation) {
      const relatedTable = fieldConfig.relation;

      // Vérifier si l'utilisateur a accès à la table liée
      if (hasPermission(user, relatedTable, 'read')) {
        field.relation = relatedTable;
        field.foreignKey = fieldConfig.foreignKey;
        field.arrayName = fieldConfig.arrayName;
        field.arraySchemaorgProperty = fieldConfig.arraySchemaorgProperty;
        field.relationshipStrength = fieldConfig.relationshipStrength;
        field.defaultSort = fieldConfig.defaultSort;
        field.label = fieldConfig.label;

        // Ajouter aux relations
        structure.relations[fieldName] = {
          type: 'many-to-one',
          relatedTable: relatedTable,
          foreignKey: fieldConfig.foreignKey,
          arrayName: fieldConfig.arrayName,
          relationshipStrength: fieldConfig.relationshipStrength,
          defaultSort: fieldConfig.defaultSort,
          accessible: true
        };
      } else {
        // L'utilisateur n'a pas accès à la table liée
        field.relation = relatedTable;
        field.accessible = false;
        structure.relations[fieldName] = {
          type: 'many-to-one',
          relatedTable: relatedTable,
          accessible: false
        };
      }
    }

    structure.fields[fieldName] = field;
  }

  // Ajouter les commonFields si pas déjà présents
  for (const fieldName in schema.commonFields) {
    if (!structure.fields[fieldName]) {
      const fieldConfig = schema.commonFields[fieldName];
      structure.fields[fieldName] = {
        type: fieldConfig.type,
        default: fieldConfig.default,
        common: true
      };
    }
  }

  // Ajouter les relations 1:n (relations inverses)
  // Parcourir toutes les tables du schéma pour trouver les relations qui pointent vers cette table
  for (const otherTableName in schema.tables) {
    const otherTableConfig = schema.tables[otherTableName];

    // Parcourir les champs de cette autre table
    for (const otherFieldName in otherTableConfig.fields) {
      const otherFieldConfig = otherTableConfig.fields[otherFieldName];

      // Si ce champ a une relation vers notre table
      if (otherFieldConfig.relation === tableName) {
        // Vérifier si l'utilisateur a accès à l'autre table
        if (hasPermission(user, otherTableName, 'read')) {
          // Créer le nom de la relation inverse selon la doctrine :
          // - si arrayName existe, utiliser sa valeur
          // - sinon, utiliser la valeur de "relation" (le nom de la table cible)
          const inverseRelationName = otherFieldConfig.arrayName || otherFieldConfig.relation;

          // Ajouter cette relation 1:n
          structure.relations[inverseRelationName] = {
            type: 'one-to-many',
            relatedTable: otherTableName,
            relatedField: otherFieldName,
            foreignKey: otherFieldConfig.foreignKey,
            relationshipStrength: otherFieldConfig.relationshipStrength,
            defaultSort: otherFieldConfig.defaultSort,
            accessible: true
          };
        } else {
          // L'utilisateur n'a pas accès à la table liée
          const inverseRelationName = otherFieldConfig.arrayName || otherFieldConfig.relation;
          structure.relations[inverseRelationName] = {
            type: 'one-to-many',
            relatedTable: otherTableName,
            accessible: false
          };
        }
      }
    }
  }

  return structure;
}

/**
 * GET /_crud/:table/view
 * Affiche une interface HTML pour visualiser la structure de la table avec fieldSelectorUI
 */
router.get('/:table/view', async (req, res) => {
  try {
    const { table: tableParam } = req.params;
    const user = req.user;

    // Si l'utilisateur n'est pas connecté, utiliser un user par défaut avec rôle public
    const effectiveUser = user || { roles: 'public' };

    // Normaliser le nom de la table (case-insensitive)
    const table = getTableName(tableParam);

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
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 { color: #333; margin-bottom: 10px; font-size: 28px; }
    .subtitle { color: #666; margin-bottom: 20px; font-size: 14px; }
    .nav {
      margin-bottom: 20px;
      padding: 15px;
      background: white;
      border-radius: 8px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .nav a {
      padding: 8px 16px;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 14px;
      transition: background 0.2s;
    }
    .nav a:hover { background: #0056b3; }
    .section {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .section h2 {
      color: #333;
      font-size: 20px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #007bff;
    }
    .json-display {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
      border-radius: 4px;
      overflow-x: auto;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      line-height: 1.6;
    }
    .json-key { color: #9cdcfe; }
    .json-string { color: #ce9178; }
    .json-number { color: #b5cea8; }
    .json-boolean { color: #569cd6; }
    .json-null { color: #569cd6; }
    @media (max-width: 768px) {
      body { padding: 10px; }
      h1 { font-size: 22px; }
    }
  </style>
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
 * GET /_crud/:table
 * Retourne la structure des champs accessibles de la table
 * ainsi que les champs des relations si autorisés
 */
router.get('/:table', async (req, res) => {
  try {
    const { table: tableParam } = req.params;
    const user = req.user;

    // Si l'utilisateur n'est pas connecté, utiliser un user par défaut avec rôle public
    const effectiveUser = user || { roles: 'public' };

    // Normaliser le nom de la table (case-insensitive)
    const table = getTableName(tableParam);

    if (!table) {
      return res.status(404).json({
        error: 'Table non trouvée',
        table: tableParam
      });
    }

    // Récupérer la structure de la table
    const structure = getTableStructure(effectiveUser, table);

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
    const user = req.user;

    // Si l'utilisateur n'est pas connecté, utiliser un user par défaut avec rôle public
    const effectiveUser = user || { roles: 'public' };

    // Normaliser le nom de la table (case-insensitive)
    const table = getTableName(tableParam);

    // Vérifier si la table existe dans le schéma
    if (!table) {
      return res.status(404).json({
        error: 'Table non trouvée'
      });
    }

    // Vérifier si l'utilisateur a accès à la table
    if (!hasPermission(effectiveUser, table, 'read')) {
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
        const userRoles = getUserAllRoles(effectiveUser);
        if (!userRoles.includes(requiredRole)) {
          return res.status(403).json({
            error: `Accès refusé : nécessite le rôle ${requiredRole}`
          });
        }
      }
      // Si granted = shared, adopter le granted de la table (déjà vérifié)
    }

    // Filtrer les champs selon les permissions
    const structure = getTableStructure(effectiveUser, table);
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
      data: filteredRow
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'enregistrement:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération de l\'enregistrement'
    });
  }
});

module.exports = router;
