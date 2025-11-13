const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { hasPermission } = require('../utils/permissions');
const { dataProxy } = require('../utils/dataProxy');
const schema = require('../schema.js');
const SchemaService = require('./services/schemaService');
const EntityService = require('./services/entityService');

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
  const { relationsN1, relations1N } = SchemaService.getTableRelations(user, tableName);
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
          if (EntityService.canAccessEntity(user, relatedRow, relConfig.relatedTable)) {
            let filteredRelatedRow = EntityService.filterEntityFields(user, relConfig.relatedTable, relatedRow);
            // Ajouter le champ _table pour marquer la provenance
            filteredRelatedRow._table = relConfig.relatedTable;

            // Appliquer le mode compact si demandé
            if (compact) {
              filteredRelatedRow = EntityService.compactRelation(filteredRelatedRow, relConfig.relatedTable);
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
        if (EntityService.canAccessEntity(user, relRow, relConfig.relatedTable)) {
          const filteredRelRow = EntityService.filterEntityFields(user, relConfig.relatedTable, relRow);
          // Ajouter le champ _table pour marquer la provenance
          filteredRelRow._table = relConfig.relatedTable;

          // Si loadN1InRelations est true, charger automatiquement les relations N:1 de cette row
          if (loadN1InRelations) {
            const { relationsN1: subRelationsN1 } = SchemaService.getTableRelations(user, relConfig.relatedTable);
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
                  if (EntityService.canAccessEntity(user, subRelatedRow, subRelConfig.relatedTable)) {
                    let filteredSubRelatedRow = EntityService.filterEntityFields(user, subRelConfig.relatedTable, subRelatedRow);
                    // Ajouter le champ _table pour marquer la provenance
                    filteredSubRelatedRow._table = subRelConfig.relatedTable;


                    // Appliquer le mode compact si demandé
                    if (compact) {
                      filteredSubRelatedRow = EntityService.compactRelation(filteredSubRelatedRow, subRelConfig.relatedTable);
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

// [#TC] buildFilteredSchema() déplacée dans utils/services/schemaService.js

// [#TC] pas utilisée mais sera utile pour le fields JSON en mariaDB
/**
 * Parse un JSON de manière sécurisée pour MariaDB/MySQL
 * @param {string} jsonString - String JSON à parser
 * @returns {Object|null} - Objet parsé ou null si erreur
 */
function safeJsonParse(jsonString) {
  if (!jsonString) return null;

  try {
    // Si c'est déjà un objet, le retourner
    if (typeof jsonString === 'object') {
      return jsonString;
    }

    // Parser le JSON
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('Erreur lors du parsing JSON:', error);
    return null;
  }
}
// ==========================================================
// [#TC] ré-écrite par moi d'après le chemin _api/:table/:id?
// ==========================================================
async function getTableData({
  user, 
  tableName, 
  id, 
  limit, 
  offset, 
  orderBy, 
  order, 
  customWhere, 
  relation, 
  includeSchema, 
  compact, 
  useProxy
}) {
  //console.log("tableName", tableName, useProxy)
  
  // Si l'utilisateur n'est pas connecté, utiliser un user par défaut avec rôle public
  const effectiveUser = user || { roles: 'public' };

  // Normaliser le nom de la table (case-insensitive)
  const table = SchemaService.getTableName(tableName);

  // Vérifier si la table existe dans le schéma
  if (!table) {
    return { status:404, error: 'Table non trouvée' };
  }

  // Vérifier si l'utilisateur a accès à la table
  // [#TC] module permissions
  if (!hasPermission(effectiveUser, table, 'read')) {
    return {status:403, error: 'Accès refusé à cette table'};
  }

  // Construire la requête SQL
  const { where, params } = EntityService.buildWhereClause(effectiveUser, customWhere);
  let rows = []
  if(!id) {
    let query = `SELECT * FROM ${table} WHERE ${where}`;

    // Ajouter ORDER BY si spécifié
    if (orderBy) {
      const orderDirection = order && order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY ${orderBy}`;
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
    [rows] = await pool.query(query, params);
  } else {
      [rows] = await pool.query(
        `SELECT * FROM ${table} WHERE id = ?`,
        [id]
      );
  }
  

  // Filtrer les rows selon granted et les champs selon les permissions
  const accessibleRows = rows.filter(row => EntityService.canAccessEntity(effectiveUser, row, table));

  // Charger les relations si demandées
  const { relationsN1, relations1N } = SchemaService.getTableRelations(effectiveUser, table);

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
    const filteredRow = EntityService.filterEntityFields(effectiveUser, table, row);

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
    rows: filteredRows,
    pagination: {
      total: total,
      count: filteredRows.length,
      limit: limit ? parseInt(limit) : null,
      offset: offset ? parseInt(offset) : 0
    }
  };
  // Ajouter le schéma si demandé
  if (includeSchema === '1') {
    response.schema = SchemaService.buildFilteredSchema(effectiveUser, table);
  }
  if(useProxy) {
    const responseProxyfied = JSON.parse(JSON.stringify(response)) // [#TC] POURQUOI ? je l'ignore mais sinon problème de Date ?!
    return JSON.parse(JSON.stringify(dataProxy(responseProxyfied))); // [#TC] résolution du proxy car sinon complexité de modif
  } else return response
} 
// ==========================================================


module.exports = {getTableData};
