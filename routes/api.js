const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const schema = require('../schema.js');

const { getTableData } = require('../services/tableDataService');
const SchemaService = require('../services/schemaService');
const PermissionService = require('../services/permissionService');

/**
 * GET /_api/search/:table
 * Search for records in a table (for autocomplete in relations)
 */
router.get('/search/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { q: searchQuery, limit = 10 } = req.query;
    const user = req.user;

    // Normalize table name
    const table = SchemaService.getTableName(tableName);
    if (!table) {
      return res.status(404).json({ success: false, error: 'Table non trouvée' });
    }

    // Check read permission
    if (!PermissionService.hasPermission(user, table, 'read')) {
      return res.status(403).json({ success: false, error: 'Permission refusée' });
    }

    // Get table config to find displayFields
    const tableConfig = SchemaService.getTableConfig(table);
    const defaultConfig = schema.defaultConfigTable || {};

    // Use table-specific displayFields, fallback to default config, then to ['name']
    let displayFields = tableConfig.displayFields || defaultConfig.displayFields || ['name'];

    // Ensure displayFields is always an array
    if (!Array.isArray(displayFields)) {
      displayFields = [displayFields];
    }

    // Build search condition
    let whereClause = '1=1';
    const params = [];

    if (searchQuery && searchQuery.length >= 1) {
      const searchConditions = displayFields.map(field => `${field} LIKE ?`);
      whereClause += ` AND (${searchConditions.join(' OR ')})`;
      const searchPattern = `%${searchQuery}%`;
      displayFields.forEach(() => params.push(searchPattern));
    }

    // Build SELECT clause with displayFields + id
    const selectFields = ['id', ...displayFields].join(', ');

    // Query records
    const [rows] = await pool.query(
      `SELECT ${selectFields} FROM ${table} WHERE ${whereClause} ORDER BY ${displayFields[0]} ASC LIMIT ?`,
      [...params, parseInt(limit)]
    );

    // Format results for autocomplete
    const results = rows.map(row => ({
      id: row.id,
      label: displayFields.map(f => row[f]).filter(Boolean).join(' '),
      ...row
    }));

    res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Erreur lors de la recherche:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la recherche',
      details: error.message
    });
  }
});

/**
 * GET /_api/:table
 * Récupère tous les enregistrements d'une table accessibles par l'utilisateur
 * Query params:
 * - limit: nombre maximum de résultats
 * - offset: décalage pour la pagination
 * - orderBy: champ de tri
 * - order: ASC ou DESC
 * - where: clause WHERE personnalisée
 * - relation: liste de relations à inclure (ex: rel1,rel2,rel3) ou "all" pour toutes
 *   Par défaut : inclut toutes les relations n:1 et les relations 1:n "Strong"
 * - schema: si "1", retourne également le schéma filtré de la table
 * - compact: si "1", réduit les relations n:1 à leur version compacte (displayFields uniquement)
 */
router.get('/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const user = req.user;
    const { limit, offset, orderBy, order, where: customWhere, relation, includeSchema, compact, useProxy, noSystemFields, noId} = req.query;
    const response = await getTableData(user, tableName, {id:null, limit, offset, orderBy, order, customWhere, relation, includeSchema, compact, useProxy, noSystemFields, noId})
    res.json(response);

  } catch (error) {
    console.error('Erreur lors de la récupération des données:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération des données',
      details: error.message 
    });
  }
});

router.get('/:tableName/:id', async (req, res) => {
  try {
    const { tableName, id } = req.params;
    const user = req.user;
    const { relation, includeSchema, compact } = req.query;
    const response = await getTableData(user, tableName, {id, relation, includeSchema, compact})
    res.json(response);

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'enregistrement:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération de l\'enregistrement',
      details: error.message
    });
  }
});

/**
 * POST /_api/:table
 * Create a new record
 */
router.post('/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const user = req.user;
    const PermissionService = require('../services/permissionService');
    const SchemaService = require('../services/schemaService');

    // Normalize table name
    const table = SchemaService.getTableName(tableName);
    if (!table) {
      return res.status(404).json({ success: false, error: 'Table non trouvée' });
    }

    // Check create permission
    if (!PermissionService.hasPermission(user, table, 'create')) {
      return res.status(403).json({ success: false, error: 'Permission refusée' });
    }

    // Prepare data with automatic fields
    const data = { ...req.body };
    if (user && user.id) {
      data.ownerId = user.id;
    }
    if (!data.granted) {
      data.granted = 'draft';
    }

    // Insert record
    const [result] = await pool.query(`INSERT INTO ${table} SET ?`, [data]);

    res.json({
      success: true,
      id: result.insertId,
      message: 'Enregistrement créé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la création:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la création',
      details: error.message
    });
  }
});

/**
 * PUT /_api/:table/:id
 * Update an existing record
 */
router.put('/:tableName/:id', async (req, res) => {
  try {
    const { tableName, id } = req.params;
    const user = req.user;
    const PermissionService = require('../services/permissionService');
    const EntityService = require('../services/entityService');
    const SchemaService = require('../services/schemaService');

    // Normalize table name
    const table = SchemaService.getTableName(tableName);
    if (!table) {
      return res.status(404).json({ success: false, error: 'Table non trouvée' });
    }

    // Check update permission
    if (!PermissionService.hasPermission(user, table, 'update')) {
      return res.status(403).json({ success: false, error: 'Permission refusée' });
    }

    // Get existing record
    const [existingRows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Enregistrement non trouvé' });
    }

    const existingRecord = existingRows[0];

    // Check row-level access
    const canAccess = await EntityService.canAccessEntity(user, table, existingRecord);
    if (!canAccess) {
      return res.status(403).json({ success: false, error: 'Accès refusé à cet enregistrement' });
    }

    // Prepare update data (remove protected fields and non-schema fields)
    const data = { ...req.body };
    delete data.id;
    delete data.ownerId;
    delete data.createdAt;
    delete data.updatedAt;
    delete data._relations; // Remove computed relations field

    // Get table schema to filter only valid fields and convert dates
    const tableSchema = schema.tables[table];
    if (tableSchema && tableSchema.fields) {
      // Filter to only include fields that exist in the schema
      const validFields = {};
      for (const [key, value] of Object.entries(data)) {
        if (tableSchema.fields[key] && !tableSchema.fields[key].as && !tableSchema.fields[key].calculate) {
          const field = tableSchema.fields[key];

          // Convert ISO datetime to MySQL format
          if ((field.type === 'datetime' || field.type === 'date') && value) {
            if (typeof value === 'string' && value.includes('T')) {
              // Convert ISO format (2025-11-02T10:32:00) to MySQL format (2025-11-02 10:32:00)
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                // Use LOCAL methods to preserve the user's timezone
                // This ensures the date/time displayed matches what was entered
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                const seconds = String(date.getSeconds()).padStart(2, '0');

                if (field.type === 'datetime') {
                  validFields[key] = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                } else {
                  validFields[key] = `${year}-${month}-${day}`;
                }
              } else {
                validFields[key] = value;
              }
            } else {
              validFields[key] = value;
            }
          } else {
            validFields[key] = value;
          }
        }
      }
      Object.assign(data, {}); // Clear data
      Object.assign(data, validFields); // Replace with valid fields only
    }

    // Build UPDATE query manually to handle dates properly and log it
    const updateFields = Object.keys(data).map(key => `\`${key}\` = ?`).join(', ');
    const updateValues = Object.values(data);
    const updateQuery = `UPDATE ${table} SET ${updateFields} WHERE id = ?`;

    // Console.log the UPDATE query
    console.log('UPDATE Query:', updateQuery);
    console.log('UPDATE Values:', [...updateValues, id]);

    // Update record
    await pool.query(updateQuery, [...updateValues, id]);

    res.json({
      success: true,
      message: 'Enregistrement mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la mise à jour',
      details: error.message
    });
  }
});

/**
 * DELETE /_api/:table/:id
 * Delete a record
 */
router.delete('/:tableName/:id', async (req, res) => {
  try {
    const { tableName, id } = req.params;
    const user = req.user;
    const PermissionService = require('../services/permissionService');
    const EntityService = require('../services/entityService');
    const SchemaService = require('../services/schemaService');

    // Normalize table name
    const table = SchemaService.getTableName(tableName);
    if (!table) {
      return res.status(404).json({ success: false, error: 'Table non trouvée' });
    }

    // Check delete permission
    if (!PermissionService.hasPermission(user, table, 'delete')) {
      return res.status(403).json({ success: false, error: 'Permission refusée' });
    }

    // Get existing record
    const [existingRows] = await pool.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Enregistrement non trouvé' });
    }

    const existingRecord = existingRows[0];

    // Check row-level access
    const canAccess = await EntityService.canAccessEntity(user, table, existingRecord);
    if (!canAccess) {
      return res.status(403).json({ success: false, error: 'Accès refusé à cet enregistrement' });
    }

    // Delete record
    await pool.query(`DELETE FROM ${table} WHERE id = ?`, [id]);

    res.json({
      success: true,
      message: 'Enregistrement supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la suppression',
      details: error.message
    });
  }
});

module.exports = router;
