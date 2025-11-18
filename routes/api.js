const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const schema = require('../schema.js');

const { getTableData } = require('../services/tableDataService');
const SchemaService = require('../services/schemaService');
const PermissionService = require('../services/permissionService');
const ReorderService = require('../services/reorderService');
const { GRANTED_VALUES, isPublishedRole, extractRoleFromGranted } = require('../constants/permissions');

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
      `SELECT ${selectFields} FROM \`${table}\` WHERE ${whereClause} ORDER BY ${displayFields[0]} ASC LIMIT ?`,
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

    // Convert datetime fields from ISO format to MySQL format WITHOUT timezone conversion
    // Also handle empty strings for integer fields
    const tableSchema = schema.tables[table];
    if (tableSchema && tableSchema.fields) {
      for (const [key, value] of Object.entries(data)) {
        const field = tableSchema.fields[key];
        if (field) {
          // Handle integer fields: convert empty strings to null
          if (field.type === 'integer') {
            if (value === '' || (typeof value === 'string' && value.trim() === '')) {
              data[key] = null;
            }
          }
          // Handle enum and set fields: convert empty strings to null
          else if (field.type === 'enum' || field.type === 'set') {
            if (value === '' || (typeof value === 'string' && value.trim() === '')) {
              data[key] = null;
            }
          }
          // Handle datetime/date fields
          else if (field.type === 'datetime' || field.type === 'date') {
            // Handle empty string: convert to null for MySQL compatibility
            if (value === '' || (typeof value === 'string' && value.trim() === '')) {
              data[key] = null;
            } else if (value && typeof value === 'string' && value.includes('T')) {
              // Parse ISO format (2025-11-16T16:00:00 or 2025-11-16T16:00) as a STRING
              const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
              if (match) {
                const [, year, month, day, hours, minutes, seconds = '00'] = match;
                if (field.type === 'datetime') {
                  data[key] = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
                } else {
                  data[key] = `${year}-${month}-${day}`;
                }
              }
            }
          }
        }
      }
    }

    // Insert record
    const [result] = await pool.query(`INSERT INTO \`${table}\` SET ?`, [data]);

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
    const [existingRows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Enregistrement non trouvé' });
    }

    const existingRecord = existingRows[0];

    // Check row-level access
    const canAccess = await EntityService.canAccessEntity(user, table, existingRecord);
    if (!canAccess) {
      return res.status(403).json({ success: false, error: 'Accès refusé à cet enregistrement' });
    }

    // Special validation for Attachment table: check for duplicate names
    if (table === 'Attachment' && req.body.name && req.body.name !== existingRecord.name) {
      const [duplicates] = await pool.query(
        'SELECT id FROM `Attachment` WHERE rowLink = ? AND name = ? AND id != ?',
        [existingRecord.rowLink, req.body.name, id]
      );
      if (duplicates.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Un fichier nommé "${req.body.name}" existe déjà pour cet enregistrement`
        });
      }
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

          // Handle integer fields: convert empty strings to null
          if (field.type === 'integer') {
            if (value === '' || (typeof value === 'string' && value.trim() === '')) {
              validFields[key] = null;
            } else {
              validFields[key] = value;
            }
          }
          // Handle enum and set fields: convert empty strings to null
          else if (field.type === 'enum' || field.type === 'set') {
            if (value === '' || (typeof value === 'string' && value.trim() === '')) {
              validFields[key] = null;
            } else {
              validFields[key] = value;
            }
          }
          // Convert ISO datetime to MySQL format WITHOUT timezone conversion
          // CRITICAL: We treat dates as LOCAL strings, not as UTC timestamps
          else if (field.type === 'datetime' || field.type === 'date') {
            // Handle empty string: convert to null for MySQL compatibility
            if (value === '' || (typeof value === 'string' && value.trim() === '')) {
              validFields[key] = null;
            } else if (value && typeof value === 'string' && value.includes('T')) {
              // Parse ISO format (2025-11-16T16:00:00 or 2025-11-16T16:00) as a STRING
              // WITHOUT using new Date() which would apply timezone conversion
              const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
              if (match) {
                const [, year, month, day, hours, minutes, seconds = '00'] = match;
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
    const updateQuery = `UPDATE \`${table}\` SET ${updateFields} WHERE id = ?`;

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
    const [existingRows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
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
    await pool.query(`DELETE FROM \`${table}\` WHERE id = ?`, [id]);

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

/**
 * POST /_api/:table/:id/duplicate
 * Duplicate a record (without relations)
 */
router.post('/:tableName/:id/duplicate', async (req, res) => {
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

    // Check read permission (to access source record)
    if (!PermissionService.hasPermission(user, table, 'read')) {
      return res.status(403).json({ success: false, error: 'Permission refusée' });
    }

    // Check create permission (to create duplicate)
    if (!PermissionService.hasPermission(user, table, 'create')) {
      return res.status(403).json({ success: false, error: 'Permission de création refusée' });
    }

    // Get existing record
    const [existingRows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Enregistrement non trouvé' });
    }

    const sourceRecord = existingRows[0];

    // Check row-level access
    const canAccess = await EntityService.canAccessEntity(user, table, sourceRecord);
    if (!canAccess) {
      return res.status(403).json({ success: false, error: 'Accès refusé à cet enregistrement' });
    }

    // Prepare duplicate data (exclude system fields)
    const duplicateData = { ...sourceRecord };
    delete duplicateData.id; // Will be auto-generated
    delete duplicateData.createdAt; // Will be auto-set
    delete duplicateData.updatedAt; // Will be auto-set

    // Set new owner and granted status
    if (user && user.id) {
      duplicateData.ownerId = user.id;
    }
    duplicateData.granted = 'draft'; // Always start as draft

    // Get table schema to filter only valid fields
    const tableSchema = schema.tables[table];
    if (tableSchema && tableSchema.fields) {
      // Remove computed fields
      for (const [key, field] of Object.entries(tableSchema.fields)) {
        if (field.as || field.calculate) {
          delete duplicateData[key];
        }
      }
    }

    // Insert duplicate record
    const [result] = await pool.query(`INSERT INTO \`${table}\` SET ?`, [duplicateData]);

    res.json({
      success: true,
      id: result.insertId,
      message: 'Enregistrement dupliqué avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la duplication:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la duplication',
      details: error.message
    });
  }
});

/**
 * POST /_api/:table/:id/duplicate-with-relations
 * Duplicate a record with selected 1:N relations
 * Body: { relations: ['TableName1', 'TableName2'] }
 */
router.post('/:tableName/:id/duplicate-with-relations', async (req, res) => {
  try {
    const { tableName, id } = req.params;
    const { relations = [] } = req.body;
    const user = req.user;
    const PermissionService = require('../services/permissionService');
    const EntityService = require('../services/entityService');
    const SchemaService = require('../services/schemaService');

    // Normalize table name
    const table = SchemaService.getTableName(tableName);
    if (!table) {
      return res.status(404).json({ success: false, error: 'Table non trouvée' });
    }

    // Check read permission (to access source record)
    if (!PermissionService.hasPermission(user, table, 'read')) {
      return res.status(403).json({ success: false, error: 'Permission refusée' });
    }

    // Check create permission (to create duplicate)
    if (!PermissionService.hasPermission(user, table, 'create')) {
      return res.status(403).json({ success: false, error: 'Permission de création refusée' });
    }

    // Get existing record
    const [existingRows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
    if (existingRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Enregistrement non trouvé' });
    }

    const sourceRecord = existingRows[0];

    // Check row-level access
    const canAccess = await EntityService.canAccessEntity(user, table, sourceRecord);
    if (!canAccess) {
      return res.status(403).json({ success: false, error: 'Accès refusé à cet enregistrement' });
    }

    // Prepare duplicate data (exclude system fields)
    const duplicateData = { ...sourceRecord };
    delete duplicateData.id;
    delete duplicateData.createdAt;
    delete duplicateData.updatedAt;

    // Set new owner and granted status
    if (user && user.id) {
      duplicateData.ownerId = user.id;
    }
    duplicateData.granted = 'draft';

    // Get table schema to filter only valid fields
    const tableSchema = schema.tables[table];
    if (tableSchema && tableSchema.fields) {
      // Remove computed fields
      for (const [key, field] of Object.entries(tableSchema.fields)) {
        if (field.as || field.calculate) {
          delete duplicateData[key];
        }
      }
    }

    // Insert duplicate record
    const [result] = await pool.query(`INSERT INTO \`${table}\` SET ?`, [duplicateData]);
    const newId = result.insertId;

    // Track duplicated relations count
    let duplicatedRelationsCount = 0;
    const relationResults = {};

    // Duplicate selected 1:N relations
    if (relations && relations.length > 0) {
      for (const relTableName of relations) {
        try {
          // Normalize relation table name
          const relTable = SchemaService.getTableName(relTableName);
          if (!relTable) {
            relationResults[relTableName] = { success: false, error: 'Table non trouvée' };
            continue;
          }

          // Check permissions for relation table
          if (!PermissionService.hasPermission(user, relTable, 'read') ||
              !PermissionService.hasPermission(user, relTable, 'create')) {
            relationResults[relTableName] = { success: false, error: 'Permissions insuffisantes' };
            continue;
          }

          // Find the foreign key field that points to our table
          const relTableSchema = schema.tables[relTable];
          if (!relTableSchema || !relTableSchema.fields) {
            relationResults[relTableName] = { success: false, error: 'Schema non trouvé' };
            continue;
          }

          let foreignKeyField = null;
          for (const [fieldName, fieldDef] of Object.entries(relTableSchema.fields)) {
            if (fieldDef.relation === table) {
              foreignKeyField = fieldName;
              break;
            }
          }

          if (!foreignKeyField) {
            relationResults[relTableName] = { success: false, error: 'Clé étrangère non trouvée' };
            continue;
          }

          // Get all related records
          const [relatedRows] = await pool.query(
            `SELECT * FROM \`${relTable}\` WHERE \`${foreignKeyField}\` = ?`,
            [id]
          );

          let duplicatedCount = 0;

          // Duplicate each related record
          for (const relatedRow of relatedRows) {
            // Check if user can access this related row
            const canAccessRelated = await EntityService.canAccessEntity(user, relTable, relatedRow);
            if (!canAccessRelated) {
              continue; // Skip records user can't access
            }

            // Prepare duplicate data
            const relDuplicateData = { ...relatedRow };
            delete relDuplicateData.id;
            delete relDuplicateData.createdAt;
            delete relDuplicateData.updatedAt;

            // Update foreign key to point to new parent
            relDuplicateData[foreignKeyField] = newId;

            // Set new owner and granted status
            if (user && user.id) {
              relDuplicateData.ownerId = user.id;
            }
            relDuplicateData.granted = 'draft';

            // Remove computed fields
            for (const [key, field] of Object.entries(relTableSchema.fields)) {
              if (field.as || field.calculate) {
                delete relDuplicateData[key];
              }
            }

            // Insert duplicate
            await pool.query(`INSERT INTO \`${relTable}\` SET ?`, [relDuplicateData]);
            duplicatedCount++;
          }

          relationResults[relTableName] = {
            success: true,
            count: duplicatedCount,
            total: relatedRows.length
          };
          duplicatedRelationsCount += duplicatedCount;

        } catch (relError) {
          console.error(`Erreur lors de la duplication de la relation ${relTableName}:`, relError);
          relationResults[relTableName] = {
            success: false,
            error: relError.message
          };
        }
      }
    }

    res.json({
      success: true,
      id: newId,
      message: `Enregistrement dupliqué avec succès. ${duplicatedRelationsCount} relation(s) dupliquée(s).`,
      relationResults
    });

  } catch (error) {
    console.error('Erreur lors de la duplication avec relations:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la duplication',
      details: error.message
    });
  }
});

/**
 * GET /_api/:table/:id/notify/preview
 * Get a preview of users who will receive notification for a record
 */
router.get('/:tableName/:id/notify/preview', async (req, res) => {
  try {
    const { tableName, id } = req.params;
    const { includeSender = 'false' } = req.query;
    const user = req.user;

    // Normalize table name
    const table = SchemaService.getTableName(tableName);
    if (!table) {
      return res.status(404).json({
        success: false,
        error: 'Table non trouvée'
      });
    }

    // Check read permission
    if (!PermissionService.hasPermission(user, table, 'read')) {
      return res.status(403).json({
        success: false,
        error: 'Permission refusée'
      });
    }

    // Get the record to verify access
    const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Enregistrement non trouvé'
      });
    }

    // Import NotificationService
    const NotificationService = require('../services/notificationService');

    // Get recipients preview
    const recipients = await NotificationService.getRecipientsPreview(
      table,
      parseInt(id),
      user,
      { includeSender: includeSender === 'true' }
    );

    res.json({
      success: true,
      recipients,
      count: recipients.length
    });

  } catch (error) {
    console.error('Erreur lors de la prévisualisation des destinataires:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la prévisualisation',
      details: error.message
    });
  }
});

/**
 * POST /_api/:table/:id/notify
 * Send email notification about a record to all users who have access
 * Body: { includeSender: boolean, customMessage: string }
 */
router.post('/:tableName/:id/notify', async (req, res) => {
  try {
    const { tableName, id } = req.params;
    const { includeSender = false, customMessage = '' } = req.body;
    const user = req.user;

    // Normalize table name
    const table = SchemaService.getTableName(tableName);
    if (!table) {
      return res.status(404).json({
        success: false,
        error: 'Table non trouvée'
      });
    }

    // Check read permission
    if (!PermissionService.hasPermission(user, table, 'read')) {
      return res.status(403).json({
        success: false,
        error: 'Permission refusée'
      });
    }

    // Verify user is logged in
    if (!user || !user.id) {
      return res.status(401).json({
        success: false,
        error: 'Vous devez être connecté pour envoyer une notification'
      });
    }

    // Get the record to verify access
    const [rows] = await pool.query(`SELECT * FROM \`${table}\` WHERE id = ?`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Enregistrement non trouvé'
      });
    }

    // Import NotificationService
    const NotificationService = require('../services/notificationService');

    // Send notifications
    const result = await NotificationService.notifyRecord(
      table,
      parseInt(id),
      user,
      { includeSender, customMessage }
    );

    res.json(result);

  } catch (error) {
    console.error('Erreur lors de l\'envoi des notifications:', error);

    // Check if it's an email configuration error
    if (error.message.includes('Email not configured')) {
      return res.status(500).json({
        success: false,
        error: 'Email non configuré. Veuillez contacter l\'administrateur.',
        details: error.message
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de l\'envoi des notifications',
      details: error.message
    });
  }
});

/**
 * POST /_api/:parentTable/:parentId/extend-authorization/:childTable
 * Extend the authorization (granted field) from parent to all linked child records
 */
router.post('/:parentTable/:parentId/extend-authorization/:childTable', async (req, res) => {
  try {
    const { parentTable: parentTableParam, parentId, childTable: childTableParam } = req.params;
    const user = req.user;

    // Normalize table names
    const parentTable = SchemaService.getTableName(parentTableParam);
    const childTable = SchemaService.getTableName(childTableParam);

    if (!parentTable || !childTable) {
      return res.status(404).json({
        success: false,
        error: 'Table non trouvée'
      });
    }

    // Check if user has update permission on parent table
    if (!PermissionService.hasPermission(user, parentTable, 'update')) {
      return res.status(403).json({
        success: false,
        error: 'Permission refusée - vous n\'avez pas les droits de modification sur la table parent'
      });
    }

    // Check if user has update permission on child table
    if (!PermissionService.hasPermission(user, childTable, 'update')) {
      return res.status(403).json({
        success: false,
        error: `Permission refusée - vous n'avez pas les droits de modification sur la table ${childTable}`
      });
    }

    // Get parent record
    const [parentRows] = await pool.query(
      `SELECT * FROM ${parentTable} WHERE id = ?`,
      [parentId]
    );

    if (parentRows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Fiche parent non trouvée'
      });
    }

    const parentRecord = parentRows[0];
    const parentGranted = parentRecord.granted;

    // Get child table configuration
    const childTableConfig = schema.tables[childTable];
    if (!childTableConfig) {
      return res.status(404).json({
        success: false,
        error: `Configuration de la table ${childTable} non trouvée`
      });
    }

    // Check if child table supports the granted value
    // For "published @role", check if the role has permissions in the child table
    if (isPublishedRole(parentGranted)) {
      const role = extractRoleFromGranted(parentGranted);
      const childGrantedConfig = childTableConfig.granted || {};

      if (!childGrantedConfig[role]) {
        return res.status(400).json({
          success: false,
          error: `La table ${childTable} n'accepte pas le niveau d'autorisation "published @${role}". Les rôles autorisés sont: ${Object.keys(childGrantedConfig).join(', ')}`
        });
      }
    }

    // Find the foreign key field in child table that references parent table
    let foreignKeyField = null;
    const childFields = childTableConfig.fields || {};

    // Search for a field that has a relation to the parent table
    for (const [fieldName, fieldConfig] of Object.entries(childFields)) {
      if (fieldConfig.relation === parentTable) {
        foreignKeyField = fieldName;
        break;
      }
    }

    if (!foreignKeyField) {
      return res.status(400).json({
        success: false,
        error: `Aucune relation trouvée entre ${childTable} et ${parentTable}`
      });
    }

    // Update all child records with the parent's granted value
    const [result] = await pool.query(
      `UPDATE ${childTable} SET granted = ? WHERE ${foreignKeyField} = ?`,
      [parentGranted, parentId]
    );

    res.json({
      success: true,
      message: `Autorisation étendue à ${result.affectedRows} fiche(s)`,
      updatedCount: result.affectedRows,
      grantedValue: parentGranted
    });

  } catch (error) {
    console.error('Erreur lors de l\'extension d\'autorisation:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de l\'extension d\'autorisation',
      details: error.message
    });
  }
});

/**
 * POST /_api/:tableName/reorder/:relationField/:parentId
 * Reorder items in a 1:N orderable relation (drag & drop)
 * Body: { orderedIds: [3, 1, 2, 5, 4] } - Array of IDs in the new order
 */
router.post('/:tableName/reorder/:relationField/:parentId', async (req, res) => {
  try {
    const { tableName, relationField, parentId } = req.params;
    const { orderedIds } = req.body;
    const user = req.user;

    // Normalize table name
    const table = SchemaService.getTableName(tableName);
    if (!table) {
      return res.status(404).json({
        success: false,
        error: 'Table non trouvée'
      });
    }

    // Validate input
    if (!orderedIds || !Array.isArray(orderedIds)) {
      return res.status(400).json({
        success: false,
        error: 'orderedIds doit être un tableau d\'identifiants'
      });
    }

    // Verify that the relation is orderable
    const config = ReorderService.getOrderableConfig(table, relationField);
    if (!config) {
      return res.status(400).json({
        success: false,
        error: `La relation ${relationField} de la table ${table} n'est pas ordonnée (propriété orderable manquante)`
      });
    }

    // Check permissions
    if (!PermissionService.hasPermission(user, table, 'update')) {
      return res.status(403).json({
        success: false,
        error: `Permission refusée - vous n'avez pas les droits de modification sur la table ${table}`
      });
    }

    // Perform reorder
    const result = await ReorderService.reorderItems(
      table,
      relationField,
      parseInt(parentId),
      orderedIds.map(id => parseInt(id)),
      user
    );

    res.json(result);

  } catch (error) {
    console.error('Erreur lors de la réorganisation:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur lors de la réorganisation',
      details: error.message
    });
  }
});

module.exports = router;
