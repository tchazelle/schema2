const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { hasPermission, getUserAllRoles } = require('../utils/permissions');
const schema = require('../schema.js');

/**
 * Vérifie si un utilisateur peut accéder à une row selon son granted
 * @param {Object} user - L'utilisateur
 * @param {Object} row - La row avec son champ granted
 * @param {string} tableName - Nom de la table
 * @returns {boolean} - true si accessible
 */
function canAccessRow(user, row, tableName) {
  const userRoles = getUserAllRoles(user);

  if (!row.granted) {
    return true; // Pas de restriction
  }

  // Si granted = draft, seul le propriétaire peut lire
  if (row.granted === 'draft') {
    if (!user || row.ownerId !== user.id) {
      return false;
    }
  }
  // Si granted = shared, vérifier les permissions de la table
  else if (row.granted === 'shared') {
    if (!hasPermission(user, tableName, 'read')) {
      return false;
    }
  }
  // Si granted = published @role, vérifier le rôle
  else if (row.granted.startsWith('published @')) {
    const requiredRole = row.granted.replace('published @', '');
    if (!userRoles.includes(requiredRole)) {
      return false;
    }
  }

  return true;
}

/**
 * Filtre les champs d'une row selon les permissions de l'utilisateur
 * @param {Object} user - L'utilisateur
 * @param {string} tableName - Nom de la table
 * @param {Object} row - La row à filtrer
 * @returns {Object} - Row filtrée
 */
function filterRowFields(user, tableName, row) {
  const userRoles = getUserAllRoles(user);
  const tableConfig = schema.tables[tableName];
  const filteredRow = {};

  for (const fieldName in row) {
    const fieldConfig = tableConfig.fields[fieldName];

    // Si le champ n'est pas dans la config, il vient probablement de commonFields
    if (!fieldConfig) {
      filteredRow[fieldName] = row[fieldName];
      continue;
    }

    // Vérifier les permissions spécifiques au champ
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

    if (fieldAccessible) {
      filteredRow[fieldName] = row[fieldName];
    }
  }

  return filteredRow;
}

/**
 * Construit la clause WHERE pour filtrer selon granted et les conditions utilisateur
 * @param {Object} user - L'utilisateur
 * @param {string} baseWhere - Clause WHERE de base (optionnelle)
 * @returns {Object} - { where: string, params: Array }
 */
function buildWhereClause(user, baseWhere = null) {
  const userRoles = getUserAllRoles(user);
  const conditions = [];
  const params = [];

  // Ajouter la clause WHERE de base si fournie
  if (baseWhere) {
    conditions.push(`(${baseWhere})`);
  }

  // Conditions pour granted
  const grantedConditions = [];

  // 1. Draft accessible uniquement par le propriétaire
  if (user) {
    grantedConditions.push('(granted = ? AND ownerId = ?)');
    params.push('draft', user.id);
  }

  // 2. Shared accessible selon les permissions de la table (déjà vérifié)
  grantedConditions.push('granted = ?');
  params.push('shared');

  // 3. Published @role accessible selon les rôles
  for (const role of userRoles) {
    grantedConditions.push('granted = ?');
    params.push(`published @${role}`);
  }

  // 4. Rows sans granted (NULL ou vide)
  grantedConditions.push('granted IS NULL');
  grantedConditions.push('granted = ?');
  params.push('');

  if (grantedConditions.length > 0) {
    conditions.push(`(${grantedConditions.join(' OR ')})`);
  }

  const where = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

  return { where, params };
}

/**
 * GET /_api/:table
 * Récupère tous les enregistrements d'une table accessibles par l'utilisateur
 * Query params:
 * - limit: nombre maximum de résultats
 * - offset: décalage pour la pagination
 * - orderBy: champ de tri
 * - order: ASC ou DESC
 * - where: clause WHERE personnalisée
 */
router.get('/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const user = req.user;
    const { limit, offset, orderBy, order, where: customWhere } = req.query;

    // Si l'utilisateur n'est pas connecté, utiliser un user par défaut avec rôle public
    const effectiveUser = user || { roles: 'public' };

    // Vérifier si l'utilisateur a accès à la table
    if (!hasPermission(effectiveUser, table, 'read')) {
      return res.status(403).json({
        error: 'Accès refusé à cette table'
      });
    }

    // Vérifier si la table existe dans le schéma
    if (!schema.tables[table]) {
      return res.status(404).json({
        error: 'Table non trouvée'
      });
    }

    // Construire la requête SQL
    const { where, params } = buildWhereClause(effectiveUser, customWhere);

    let query = `SELECT * FROM ${table} WHERE ${where}`;

    // Ajouter ORDER BY si spécifié
    if (orderBy) {
      const orderDirection = order && order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY ${orderBy} ${orderDirection}`;
    }

    // Ajouter LIMIT et OFFSET si spécifiés
    if (limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(limit));
    }

    if (offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(offset));
    }

    // Exécuter la requête
    const [rows] = await pool.query(query, params);

    // Filtrer les rows selon granted et les champs selon les permissions
    const filteredRows = rows
      .filter(row => canAccessRow(effectiveUser, row, table))
      .map(row => filterRowFields(effectiveUser, table, row));

    // Compter le nombre total de résultats (sans limit)
    const countQuery = `SELECT COUNT(*) as total FROM ${table} WHERE ${where}`;
    const [countResult] = await pool.query(countQuery, params.slice(0, params.length - (limit ? 1 : 0) - (offset ? 1 : 0)));
    const total = countResult[0].total;

    res.json({
      success: true,
      table: table,
      data: filteredRows,
      pagination: {
        total: total,
        count: filteredRows.length,
        limit: limit ? parseInt(limit) : null,
        offset: offset ? parseInt(offset) : 0
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des données:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération des données',
      details: error.message
    });
  }
});

/**
 * GET /_api/:table/:id
 * Récupère un enregistrement spécifique avec vérification des permissions
 * Query params:
 * - includeRelations: true/false pour inclure les relations
 */
router.get('/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const user = req.user;
    const { includeRelations } = req.query;

    // Si l'utilisateur n'est pas connecté, utiliser un user par défaut avec rôle public
    const effectiveUser = user || { roles: 'public' };

    // Vérifier si l'utilisateur a accès à la table
    if (!hasPermission(effectiveUser, table, 'read')) {
      return res.status(403).json({
        error: 'Accès refusé à cette table'
      });
    }

    // Vérifier si la table existe dans le schéma
    if (!schema.tables[table]) {
      return res.status(404).json({
        error: 'Table non trouvée'
      });
    }

    // Récupérer l'enregistrement
    const [rows] = await pool.query(
      `SELECT * FROM ${table} WHERE id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({
        error: 'Enregistrement non trouvé',
        table: table,
        id: id
      });
    }

    const row = rows[0];

    // Vérifier si l'utilisateur peut accéder à cette row
    if (!canAccessRow(effectiveUser, row, table)) {
      return res.status(403).json({
        error: 'Accès refusé à cet enregistrement'
      });
    }

    // Filtrer les champs selon les permissions
    let filteredRow = filterRowFields(effectiveUser, table, row);

    // Si includeRelations est true, charger les relations
    if (includeRelations === 'true') {
      const tableConfig = schema.tables[table];
      const relations = {};

      for (const fieldName in tableConfig.fields) {
        const fieldConfig = tableConfig.fields[fieldName];

        // Si c'est une relation et que l'utilisateur y a accès
        if (fieldConfig.relation && hasPermission(effectiveUser, fieldConfig.relation, 'read')) {
          const relatedTable = fieldConfig.relation;
          const foreignKey = fieldConfig.foreignKey;
          const foreignValue = row[fieldName];

          if (foreignValue) {
            // Charger l'enregistrement lié
            const [relatedRows] = await pool.query(
              `SELECT * FROM ${relatedTable} WHERE ${foreignKey} = ?`,
              [foreignValue]
            );

            if (relatedRows.length > 0) {
              const relatedRow = relatedRows[0];
              if (canAccessRow(effectiveUser, relatedRow, relatedTable)) {
                relations[fieldName] = filterRowFields(effectiveUser, relatedTable, relatedRow);
              }
            }
          }
        }
      }

      filteredRow.relations = relations;
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
      error: 'Erreur serveur lors de la récupération de l\'enregistrement',
      details: error.message
    });
  }
});

module.exports = router;
