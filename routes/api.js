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
 * - relation: liste de relations à inclure (ex: rel1,rel2,rel3) ou "all" pour toutes
 *   Par défaut : inclut toutes les relations n:1 et les relations 1:n "Strong"
 * - schema: si "1", retourne également le schéma filtré de la table
 * - compact: si "1", réduit les relations n:1 à leur version compacte (displayFields uniquement)
 */
router.get('/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const user = req.user;
    const { limit, offset, orderBy, order, where: customWhere, relation, schema: includeSchema, compact } = req.query;

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
    const accessibleRows = rows.filter(row => canAccessRow(effectiveUser, row, table));

    // Charger les relations si demandées
    const { relationsN1, relations1N } = getTableRelations(effectiveUser, table);

    // Déterminer quelles relations charger
    let requestedRelations = [];
    if (relation === 'all') {
      // Toutes les relations
      requestedRelations = [...Object.keys(relationsN1), ...Object.keys(relations1N)];
    } else if (relation) {
      // Relations spécifiées dans le query param
      requestedRelations = relation.split(',').map(r => r.trim());
    } else {
      // Par défaut : toutes les relations n:1 et les relations 1:n "Strong"
      requestedRelations = [
        ...Object.keys(relationsN1),
        ...Object.keys(relations1N).filter(relName => relations1N[relName].relationshipStrength === 'Strong')
      ];
    }

    // Filtrer les rows et charger les relations
    const filteredRows = [];
    for (const row of accessibleRows) {
      const filteredRow = filterRowFields(effectiveUser, table, row);

      // Charger les relations pour cette row
      if (requestedRelations.length > 0) {
        const useCompact = compact === '1';
        const relations = await loadRelationsForRow(effectiveUser, table, row, requestedRelations, true, useCompact);

        // Ajouter les relations au résultat (utilise _relations pour éviter conflit avec champ DB)
        if (Object.keys(relations).length > 0) {
          filteredRow._relations = relations;
        }
      }

      filteredRows.push(filteredRow);
    }

    // Compter le nombre total de résultats (sans limit)
    const countQuery = `SELECT COUNT(*) as total FROM ${table} WHERE ${where}`;
    const [countResult] = await pool.query(countQuery, params.slice(0, params.length - (limit ? 1 : 0) - (offset ? 1 : 0)));
    const total = countResult[0].total;

    const response = {
      success: true,
      table: table,
      data: filteredRows,
      pagination: {
        total: total,
        count: filteredRows.length,
        limit: limit ? parseInt(limit) : null,
        offset: offset ? parseInt(offset) : 0
      }
    };

    // Ajouter le schéma si demandé
    if (includeSchema === '1') {
      response.schema = buildFilteredSchema(effectiveUser, table);
    }

    res.json(response);

  } catch (error) {
    console.error('Erreur lors de la récupération des données:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération des données',
      details: error.message
    });
  }
});

/**
 * Charge la structure d'une table pour obtenir les relations
 */
function getTableRelations(user, tableName) {
  const tableConfig = schema.tables[tableName];
  if (!tableConfig) {
    return { relationsN1: {}, relations1N: {} };
  }

  const relationsN1 = {};
  const relations1N = {};

  // Relations n:1 (many-to-one) : champs avec relation dans la table actuelle
  for (const fieldName in tableConfig.fields) {
    const fieldConfig = tableConfig.fields[fieldName];
    if (fieldConfig.relation && hasPermission(user, fieldConfig.relation, 'read')) {
      relationsN1[fieldName] = {
        relatedTable: fieldConfig.relation,
        foreignKey: fieldConfig.foreignKey,
        arrayName: fieldConfig.arrayName,
        relationshipStrength: fieldConfig.relationshipStrength
      };
    }
  }

  // Relations 1:n (one-to-many) : chercher les tables qui ont une relation vers cette table
  for (const otherTableName in schema.tables) {
    const otherTableConfig = schema.tables[otherTableName];

    for (const otherFieldName in otherTableConfig.fields) {
      const otherFieldConfig = otherTableConfig.fields[otherFieldName];

      if (otherFieldConfig.relation === tableName && hasPermission(user, otherTableName, 'read')) {
        // Nom de la relation selon la doctrine
        const relationName = otherFieldConfig.arrayName || otherFieldConfig.relation;

        relations1N[relationName] = {
          relatedTable: otherTableName,
          relatedField: otherFieldName,
          foreignKey: otherFieldConfig.foreignKey,
          relationshipStrength: otherFieldConfig.relationshipStrength,
          defaultSort: otherFieldConfig.defaultSort
        };
      }
    }
  }

  return { relationsN1, relations1N };
}

/**
 * Réduit une relation n:1 à sa version compacte selon les displayFields du schéma
 * @param {Object} relatedRow - La row de la relation
 * @param {string} relatedTable - Nom de la table de la relation
 * @returns {Object} - Version compacte de la relation
 */
function compactRelation(relatedRow, relatedTable) {
  const tableConfig = schema.tables[relatedTable];
  if (!tableConfig) {
    return relatedRow; // Si pas de config, retourner la row complète
  }

  // Déterminer les displayFields
  let displayFields = tableConfig.displayField || 'name';
  if (!Array.isArray(displayFields)) {
    displayFields = [displayFields];
  }

  // Construire l'objet compact
  const compact = {
    _table: relatedRow._table,
    id: relatedRow.id
  };

  // Ajouter les displayFields
  for (const field of displayFields) {
    if (relatedRow[field] !== undefined) {
      compact[field] = relatedRow[field];
    }
  }

  return compact;
}

/**
 * Charge les relations d'une row de manière récursive
 * @param {Object} user - L'utilisateur
 * @param {string} tableName - Nom de la table
 * @param {Object} row - La row dont on veut charger les relations
 * @param {Array} requestedRelations - Liste des relations à charger
 * @param {boolean} loadN1InRelations - Charger automatiquement les relations N:1 dans les relations 1:N
 * @param {boolean} compact - Réduire les relations n:1 à leur version compacte (displayFields uniquement)
 * @returns {Object} - Objet des relations chargées
 */
async function loadRelationsForRow(user, tableName, row, requestedRelations, loadN1InRelations = false, compact = false) {
  const { relationsN1, relations1N } = getTableRelations(user, tableName);
  const relations = {};

  // Charger les relations n:1 (many-to-one)
  for (const fieldName of requestedRelations) {
    if (relationsN1[fieldName]) {
      const relConfig = relationsN1[fieldName];
      const foreignValue = row[fieldName];

      if (foreignValue) {
        // Charger l'enregistrement lié
        const [relatedRows] = await pool.query(
          `SELECT * FROM ${relConfig.relatedTable} WHERE ${relConfig.foreignKey} = ?`,
          [foreignValue]
        );

        if (relatedRows.length > 0) {
          const relatedRow = relatedRows[0];
          if (canAccessRow(user, relatedRow, relConfig.relatedTable)) {
            let filteredRelatedRow = filterRowFields(user, relConfig.relatedTable, relatedRow);
            // Ajouter le champ _table pour marquer la provenance
            filteredRelatedRow._table = relConfig.relatedTable;

            // Appliquer le mode compact si demandé
            if (compact) {
              filteredRelatedRow = compactRelation(filteredRelatedRow, relConfig.relatedTable);
            }

            relations[fieldName] = filteredRelatedRow;
          }
        }
      }
    }
  }

  // Charger les relations 1:n (one-to-many)
  for (const relationName of requestedRelations) {
    if (relations1N[relationName]) {
      const relConfig = relations1N[relationName];

      // Construire la requête avec ORDER BY si défini
      let query = `SELECT * FROM ${relConfig.relatedTable} WHERE ${relConfig.relatedField} = ?`;
      const params = [row.id];

      if (relConfig.defaultSort) {
        if (Array.isArray(relConfig.defaultSort)) {
          const sortClauses = relConfig.defaultSort.map(sort => `${sort.field} ${sort.order}`).join(', ');
          query += ` ORDER BY ${sortClauses}`;
        } else {
          query += ` ORDER BY ${relConfig.defaultSort.field} ${relConfig.defaultSort.order}`;
        }
      }

      const [relatedRows] = await pool.query(query, params);

      // Filtrer et vérifier les permissions pour chaque row
      const filteredRelatedRows = [];

      for (const relRow of relatedRows) {
        if (canAccessRow(user, relRow, relConfig.relatedTable)) {
          const filteredRelRow = filterRowFields(user, relConfig.relatedTable, relRow);
          // Ajouter le champ _table pour marquer la provenance
          filteredRelRow._table = relConfig.relatedTable;

          // Si loadN1InRelations est true, charger automatiquement les relations N:1 de cette row
          if (loadN1InRelations) {
            const { relationsN1: subRelationsN1 } = getTableRelations(user, relConfig.relatedTable);
            const subRelations = {};

            for (const subFieldName in subRelationsN1) {
              const subRelConfig = subRelationsN1[subFieldName];

              // CORRECTION: Exclure la relation qui pointe vers la table parent (éviter le doublon)
              // Ex: dans OrganizationPerson, ne pas charger Organization car c'est déjà la fiche master
              if (subRelConfig.relatedTable === tableName) {
                continue; // Skip cette relation
              }

              const subForeignValue = relRow[subFieldName];

              if (subForeignValue) {
                // Charger l'enregistrement lié
                const [subRelatedRows] = await pool.query(
                  `SELECT * FROM ${subRelConfig.relatedTable} WHERE ${subRelConfig.foreignKey} = ?`,
                  [subForeignValue]
                );

                if (subRelatedRows.length > 0) {
                  const subRelatedRow = subRelatedRows[0];
                  if (canAccessRow(user, subRelatedRow, subRelConfig.relatedTable)) {
                    let filteredSubRelatedRow = filterRowFields(user, subRelConfig.relatedTable, subRelatedRow);
                    // Ajouter le champ _table pour marquer la provenance
                    filteredSubRelatedRow._table = subRelConfig.relatedTable;

                    // Appliquer le mode compact si demandé
                    if (compact) {
                      filteredSubRelatedRow = compactRelation(filteredSubRelatedRow, subRelConfig.relatedTable);
                    }

                    subRelations[subFieldName] = filteredSubRelatedRow;
                  }
                }
              }
            }

            // Ajouter les sous-relations si elles existent (utilise _relations pour éviter conflit avec champ DB)
            if (Object.keys(subRelations).length > 0) {
              filteredRelRow._relations = subRelations;
            }
          }

          filteredRelatedRows.push(filteredRelRow);
        }
      }

      if (filteredRelatedRows.length > 0) {
        relations[relationName] = filteredRelatedRows;
      }
    }
  }

  return relations;
}

/**
 * Construit le schéma filtré selon les permissions de l'utilisateur
 * @param {Object} user - L'utilisateur
 * @param {string} tableName - Nom de la table
 * @returns {Object} - Schéma filtré
 */
function buildFilteredSchema(user, tableName) {
  const tableConfig = schema.tables[tableName];
  if (!tableConfig) {
    return null;
  }

  const userRoles = getUserAllRoles(user);
  const filteredSchema = {
    table: tableName,
    fields: {},
    relations: {
      n1: {},
      "1n": {}
    }
  };

  // Filtrer les champs selon les permissions
  for (const fieldName in tableConfig.fields) {
    const fieldConfig = tableConfig.fields[fieldName];

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
      // Déterminer si le champ est calculé (non physique)
      const isComputed = (
        // Champ calculé via fonction JavaScript
        (fieldConfig.calculate && typeof fieldConfig.calculate === 'function') ||
        // Champ calculé via MySQL (propriété 'as')
        fieldConfig.as
      );

      filteredSchema.fields[fieldName] = {
        type: fieldConfig.type,
        ...(isComputed && { computed: true }),
        ...(fieldConfig.relation && { relation: fieldConfig.relation }),
        ...(fieldConfig.foreignKey && { foreignKey: fieldConfig.foreignKey }),
        ...(fieldConfig.arrayName && { arrayName: fieldConfig.arrayName }),
        ...(fieldConfig.relationshipStrength && { relationshipStrength: fieldConfig.relationshipStrength }),
        ...(fieldConfig.defaultSort && { defaultSort: fieldConfig.defaultSort })
      };
    }
  }

  // Ajouter les relations N:1 et 1:N
  const { relationsN1, relations1N } = getTableRelations(user, tableName);
  filteredSchema.relations.n1 = relationsN1;
  filteredSchema.relations["1n"] = relations1N;

  return filteredSchema;
}

/**
 * GET /_api/:table/:id
 * Récupère un enregistrement spécifique avec vérification des permissions
 * Query params:
 * - relation: liste de relations à inclure (ex: rel1,rel2,rel3) ou "all" pour toutes
 *   Par défaut : inclut toutes les relations n:1 et les relations 1:n "Strong"
 * - schema: si "1", retourne également le schéma filtré de la table
 * - compact: si "1", réduit les relations n:1 à leur version compacte (displayFields uniquement)
 */
router.get('/:table/:id', async (req, res) => {
  try {
    const { table, id } = req.params;
    const user = req.user;
    const { relation, schema: includeSchema, compact } = req.query;

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

    // Charger les relations
    const { relationsN1, relations1N } = getTableRelations(effectiveUser, table);

    // Déterminer quelles relations charger
    let requestedRelations = [];
    if (relation === 'all') {
      // Toutes les relations
      requestedRelations = [...Object.keys(relationsN1), ...Object.keys(relations1N)];
    } else if (relation) {
      // Relations spécifiées dans le query param
      requestedRelations = relation.split(',').map(r => r.trim());
    } else {
      // Par défaut : toutes les relations n:1 et les relations 1:n "Strong"
      requestedRelations = [
        ...Object.keys(relationsN1),
        ...Object.keys(relations1N).filter(relName => relations1N[relName].relationshipStrength === 'Strong')
      ];
    }

    // Charger les relations pour cette row (avec chargement automatique des relations N:1 dans les 1:N)
    const useCompact = compact === '1';
    const relations = await loadRelationsForRow(effectiveUser, table, row, requestedRelations, true, useCompact);

    // Ajouter les relations au résultat (utilise _relations pour éviter conflit avec champ DB)
    if (Object.keys(relations).length > 0) {
      filteredRow._relations = relations;
    }

    const response = {
      success: true,
      table: table,
      id: id,
      data: filteredRow
    };

    // Ajouter le schéma si demandé
    if (includeSchema === '1') {
      response.schema = buildFilteredSchema(effectiveUser, table);
    }

    res.json(response);

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'enregistrement:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération de l\'enregistrement',
      details: error.message
    });
  }
});

module.exports = router;
