const pool = require('../config/database');
const schema = require('../schema');
const { hasPermission } = require('./permissionService');
const SchemaService = require('./schemaService');
const EntityService = require('./entityService');
const RepositoryService = require('./repositoryService');
const {dataProxy} = require('../utils/dataProxy');
const { enrichRowWithDateRange, hasCalendar, getCalendarConfig } = require('../utils/dateRangeFormatter');

/**
 * Charge les relations d'une row de manière récursive
 * @param {Object} user - L'utilisateur
 * @param {string} tableName - Nom de la table
 * @param {Object} row - La row dont on veut charger les relations
 * @param {Object} options - Options de chargement
 * @param {Array} options.requestedRelations - Liste des relations à charger
 * @param {boolean} [options.loadN1InRelations=false] - Charger automatiquement les relations N:1 dans les relations 1:N
 * @param {boolean} [options.compact=false] - Réduire les relations n:1 à leur version compacte (displayFields uniquement)
 * @returns {Object} - Objet des relations chargées
 */
async function loadRelationsForRow(user, tableName, row, options = {}) {
  
  const {
    requestedRelations = [],
    loadN1InRelations = false,
    compact = false,
    noId = false,
    noSystemFields = false,
  } = options;
  
  const { relationsN1, relations1N } = SchemaService.getTableRelations(user, tableName);
  const relations = {};
  // Charger les relations n:1 (many-to-one)
  for (const fieldName of requestedRelations) { 
    if (relationsN1[fieldName]) {
      const relConfig = relationsN1[fieldName];
      const foreignValue = row[fieldName];
      //console.log("relConfig", relConfig)
      if (foreignValue) {
        // Charger l'enregistrement lié
        const [relatedRows] = await pool.query(
          `SELECT * FROM \`${relConfig.relatedTable}\` WHERE ${relConfig.foreignKey} = ?`,
          [foreignValue]
        );

        if (relatedRows.length > 0) {
          const relatedRow = relatedRows[0];
          
          if (EntityService.canAccessEntity(user, relConfig.relatedTable, relatedRow)) {
            let filteredRelatedRow = EntityService.filterEntityFields(user, relConfig.relatedTable, relatedRow);
            // Ajouter le champ _table pour marquer la provenance
            filteredRelatedRow._table = relConfig.relatedTable;

            // Ajouter un label construit à partir des displayFields
            const displayFields = SchemaService.getDisplayFields(relConfig.relatedTable);
            if (displayFields && displayFields.length > 0) {
              const labelValues = displayFields
                .map(field => filteredRelatedRow[field])
                .filter(val => val !== null && val !== undefined && val !== '');
              if (labelValues.length > 0) {
                filteredRelatedRow._label = labelValues.join(' ');
              }
            }

            // Appliquer le mode compact si demandé
            if (compact) {
              filteredRelatedRow = EntityService.compactRelation(filteredRelatedRow, relConfig.relatedTable);
              // Réajouter le _label si compact l'a supprimé
              if (displayFields && displayFields.length > 0) {
                const labelValues = displayFields
                  .map(field => filteredRelatedRow[field])
                  .filter(val => val !== null && val !== undefined && val !== '');
                if (labelValues.length > 0) {
                  filteredRelatedRow._label = labelValues.join(' ');
                }
              }
            }

            if (noId) {
              delete filteredRelatedRow.id
              delete filteredRelatedRow._table
            }
            if (noSystemFields) {
              delete filteredRelatedRow.ownerId;
              delete filteredRelatedRow.granted;
              delete filteredRelatedRow.createdAt;
              delete filteredRelatedRow.updatedAt;
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
      let query = `SELECT * FROM \`${relConfig.relatedTable}\` WHERE ${relConfig.relatedField} = ?`;
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
        if (EntityService.canAccessEntity(user, relConfig.relatedTable, relRow)) {
          
          const filteredRelRow = EntityService.filterEntityFields(user, relConfig.relatedTable, relRow);
          // Ajouter le champ _table pour marquer la provenance
          filteredRelRow._table = relConfig.relatedTable;
        
          // Si loadN1InRelations est true, charger automatiquement les relations N:1 de cette row
          if (loadN1InRelations) {
            const { relationsN1: subRelationsN1 } = SchemaService.getTableRelations(user, relConfig.relatedTable);
            

            const subRelations = {};
            
            for (const subFieldName in subRelationsN1) {
              const subRelConfig = subRelationsN1[subFieldName];

              //console.log("subRelConfig", subRelConfig, " subFieldName",subFieldName, "relationName", relationName)

              // CORRECTION: Exclure la relation qui pointe vers la table parent (éviter le doublon)
              // Ex: dans OrganizationPerson, ne pas charger Organization car c'est déjà la fiche master
              //if (subRelConfig.relatedTable === tableName) { // FAUX on peut avoir deux relations sur une même table
              if (subRelConfig.arrayName === relationName  ) {
                continue; // Skip cette relation
              }
              
              const subForeignValue = relRow[subFieldName];
            

              if (subForeignValue) {
                // Charger l'enregistrement lié
                const [subRelatedRows] = await pool.query(
                  `SELECT * FROM \`${subRelConfig.relatedTable}\` WHERE ${subRelConfig.foreignKey} = ?`,
                  [subForeignValue]
                );

                if (subRelatedRows.length > 0) {
                  const subRelatedRow = subRelatedRows[0];
                  if (EntityService.canAccessEntity(user, subRelConfig.relatedTable, subRelatedRow)) {
                    let filteredSubRelatedRow = EntityService.filterEntityFields(user, subRelConfig.relatedTable, subRelatedRow);
                    // Ajouter le champ _table pour marquer la provenance
                    filteredSubRelatedRow._table = subRelConfig.relatedTable;

                    // Appliquer le mode compact si demandé
                    if (compact) {
                      filteredSubRelatedRow = EntityService.compactRelation(filteredSubRelatedRow, subRelConfig.relatedTable);
                    }
                    if (noId) {
                      delete filteredSubRelatedRow.id
                      delete filteredSubRelatedRow._table
                    }
                    if (noSystemFields) {
                      delete filteredSubRelatedRow.ownerId;
                      delete filteredSubRelatedRow.granted;
                      delete filteredSubRelatedRow.createdAt;
                      delete filteredSubRelatedRow.updatedAt;
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
          if (noId) {
            delete filteredRelRow.id
            delete filteredRelRow._table
          }
          if (noSystemFields) {
            delete filteredRelRow.ownerId;
            delete filteredRelRow.granted;
            delete filteredRelRow.createdAt;
            delete filteredRelRow.updatedAt;
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
 * Récupère les données d'une table avec relations et filtres
 * @param {Object} user - L'utilisateur connecté
 * @param {string} tableName - Nom de la table
 * @param {Object} options - Options de chargement
 * @param {number} [options.id] - ID spécifique à récupérer
 * @param {number} [options.limit] - Nombre maximum de résultats
 * @param {number} [options.offset] - Décalage pour la pagination
 * @param {string} [options.orderBy] - Champ de tri
 * @param {string} [options.order] - Direction du tri (ASC/DESC)
 * @param {string} [options.customWhere] - Clause WHERE personnalisée
 * @param {Array} [options.customWhereParams] - Paramètres pour la clause WHERE personnalisée
 * @param {string} [options.relation] - Relations à charger ('all' ou liste CSV)
 * @param {string} [options.includeSchema] - Inclure le schéma ('1' pour oui)
 * @param {string} [options.compact] - Mode compact pour relations ('1' pour oui)
 * @returns {Object} - Résultat avec rows, pagination et éventuellement schema
 */
async function getTableData(user, tableName, options = {}) {
  const {
    id,
    limit,
    offset,
    orderBy,
    order,
    customWhere,
    customWhereParams = [],
    customJoins = [], // Array of JOIN clauses for advanced search/sort on relations
    relation,
    includeSchema,
    compact,
    useProxy,
    noSystemFields,
    noId
  } = options;

  /*
  //console.log('\n====== [TableDataService.getTableData] Début ======');
  //console.log('[TableDataService] tableName:', tableName);
  //console.log('[TableDataService] options:', { id, limit, offset, orderBy, order, relation, compact, includeSchema });
  //console.log('[TableDataService] user:', user ? `id=${user.id}, roles=${JSON.stringify(user.roles)}` : 'null');
  */

  // user est déjà enrichi par userEnrichMiddleware (toujours défini, même pour visiteurs publics)

  // Normaliser le nom de la table (case-insensitive)
  const table = SchemaService.getTableName(tableName);
  //console.log('[TableDataService] Table normalisée:', table);

  // Vérifier si la table existe dans le schéma
  if (!table) {
    //console.log('[TableDataService] ❌ Table non trouvée');
    return { success: false, error: 'Table non trouvée', statusCode: 404, rows: [] };
  }

  // Vérifier si l'utilisateur a accès à la table
  //console.log('[TableDataService] Vérification permission...');
  if (!hasPermission(user, table, 'read')) {
    //console.log('[TableDataService] ❌ Accès refusé à cette table');
    return { success: false, error: 'Accès refusé à cette table', statusCode: 403, rows: [] };
  }
  //console.log('[TableDataService] ✅ Permission OK');

  // Construire la requête SQL
  // Si id est fourni, ajouter une condition id = ? au customWhere
  let effectiveCustomWhere = customWhere;
  let effectiveCustomWhereParams = [...customWhereParams];
  
  if (id) {
    // Convert id to integer to avoid type mismatch issues
    const idAsInt = parseInt(id, 10);
    effectiveCustomWhere = customWhere ? `(${customWhere}) AND id = ?` : 'id = ?';
    effectiveCustomWhereParams.push(idAsInt);
  }

  //console.log("**************************** effectiveCustomWhereParams",effectiveCustomWhereParams)

  // Passer le nom de table si des JOINs sont présents pour éviter l'ambiguïté des colonnes granted/ownerId
  //console.log('[TableDataService] Construction WHERE clause avec EntityService.buildWhereClause...');
  const { where, params } = EntityService.buildWhereClause(
    user,
    effectiveCustomWhere,
    effectiveCustomWhereParams,
    customJoins.length > 0 ? table : null
  );
  //console.log('[TableDataService] WHERE clause:', where);
  //console.log('[TableDataService] Params initial:', params);

  // Select with table prefix when there are JOINs, and include computed fields (as)
  const tableAlias = customJoins.length > 0 ? table : null;
  const selectClause = SchemaService.buildSelectClause(table, tableAlias);
  let query = `SELECT ${selectClause} FROM \`${table}\``;

  // Add JOINs if provided (for advanced search/sort on relation fields)
  if (customJoins.length > 0) {
    query += ' ' + customJoins.join(' ');
  }

  // Add WHERE clause
  query += ` WHERE ${where}`;

  // Ajouter ORDER BY si spécifié
  // Replace _dateRange with actual database field if needed (_dateRange is a virtual computed field)
  let finalOrderBy = orderBy;
  if (orderBy && orderBy.includes('_dateRange') && hasCalendar(table)) {
    const calendarConfig = getCalendarConfig(table);
    const startDateField = calendarConfig.startDate || 'startDate';
    // Replace _dateRange with the actual startDate field
    // Handle both simple field and prefixed field (e.g., "Todo._dateRange" -> "Todo.startDate")
    finalOrderBy = orderBy.replace(/_dateRange/g, startDateField);
  }

  if (finalOrderBy) {
    query += ` ORDER BY ${finalOrderBy}`;
    // Only add direction if order is provided and not empty (for advanced sort, direction is already in orderBy)
    if (order && order !== '') {
      const orderDirection = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ${orderDirection}`;
    }
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

  // Console log the query for debugging
  //console.log('[TableDataService] Query SQL finale:', query);
  //console.log('[TableDataService] Params SQL finale:', params);

  // Exécuter la requête
  //console.log('[TableDataService] Exécution de la requête SQL...');
  const [rows] = await pool.query(query, params);
  //console.log(`[TableDataService] ✅ Requête exécutée - ${rows.length} row(s) trouvée(s)`);


  // Filtrer les rows selon granted et les champs selon les permissions
  //console.log('[TableDataService] Filtrage des rows avec EntityService.canAccessEntity...');
  if (rows.length > 0) {
    //console.log('[TableDataService] Première row avant filtrage:', { id: rows[0].id, granted: rows[0].granted, ownerId: rows[0].ownerId });
  }

  const accessibleRows = rows.filter(row => EntityService.canAccessEntity(user, table, row));
  //console.log(`[TableDataService] Rows accessibles après filtrage: ${accessibleRows.length}/${rows.length}`);

  // Debug: Log if rows were filtered out by granted check
  if (id && rows.length > 0 && accessibleRows.length === 0) {
    //console.log(`[TableDataService] ⚠️ WARNING: Record id=${id} trouvé mais filtré par granted check`);
    //console.log(`[TableDataService] Record granted value:`, rows[0].granted);
    //console.log(`[TableDataService] Record ownerId:`, rows[0].ownerId);
    //console.log(`[TableDataService] User:`, user ? `id=${user.id}, roles=${JSON.stringify(user.roles)}` : 'null (public)');
  }

  // Charger les relations si demandées
  const { relationsN1, relations1N } = SchemaService.getTableRelations(user, table);

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

  // Obtenir les champs calculés JS et les champs de statistiques
  const calculatedFields = SchemaService.getCalculatedFields(table, user);
  const statFields = SchemaService.getStatFields(table, user);

  // Filtrer les rows et charger les relations
  //console.log('[TableDataService] Filtrage des champs et chargement des relations...');
  const filteredRows = [];
  for (const row of accessibleRows) {
    //console.log(`[TableDataService] Traitement row id=${row.id}...`);
    const filteredRow = EntityService.filterEntityFields(user, table, row);
    //console.log(`[TableDataService] Champs filtrés pour row id=${row.id}:`, Object.keys(filteredRow));

    // Calculer les champs JavaScript (calculate)
    const context = {
      pool,
      user,
      schema,
      tableName: table,
      rows: accessibleRows
    };

    for (const fieldName in calculatedFields) {
      try {
        const calculateFn = calculatedFields[fieldName];
        filteredRow[fieldName] = await calculateFn(row, context);
      } catch (error) {
        console.error(`[TableDataService] Error calculating field ${fieldName}:`, error);
        filteredRow[fieldName] = null;
      }
    }

    // Ajouter un label construit à partir des displayFields
    const displayFields = SchemaService.getDisplayFields(table);
    if (displayFields && displayFields.length > 0) {
      const labelValues = displayFields
        .map(field => filteredRow[field])
        .filter(val => val !== null && val !== undefined && val !== '');
      if (labelValues.length > 0) {
        filteredRow._label = labelValues.join(' ');
      }
    }

    // Enrichir avec _dateRange si la table a un calendar
    enrichRowWithDateRange(table, filteredRow);

    // Retirer les champs système si demandé (ownerId, granted, createdAt, updatedAt)
    if (noSystemFields) {
      delete filteredRow.ownerId;
      delete filteredRow.granted;
      delete filteredRow.createdAt;
      delete filteredRow.updatedAt;
    }

    // Retirer l'id si demandé
    if (noId) {
      delete filteredRow.id;
      delete filteredRow._table;
    }

    // Charger les relations pour cette row
    if (requestedRelations.length > 0) {
      //console.log(`[TableDataService] Chargement des relations pour row id=${row.id}:`, requestedRelations);

      const relations = await loadRelationsForRow(user, table, row, {
        requestedRelations,
        loadN1InRelations: true,
        compact,
        noSystemFields,
        noId
      });
      //console.log(`[TableDataService] Relations chargées pour row id=${row.id}:`, Object.keys(relations));

      // Ajouter les relations au résultat (utilise _relations pour éviter conflit avec champ DB)
      if (Object.keys(relations).length > 0) {
        filteredRow._relations = relations;
      }
    }

    filteredRows.push(filteredRow);
  }

  //console.log(`[TableDataService] ✅ Total rows filtrées et enrichies: ${filteredRows.length}`);

  // Calculer les statistiques si des champs ont stat défini
  const stats = {};
  if (Object.keys(statFields).length > 0 && filteredRows.length > 0) {
    for (const fieldName in statFields) {
      const statType = statFields[fieldName];
      const values = filteredRows.map(row => row[fieldName]).filter(val => val !== null && val !== undefined);

      if (values.length > 0) {
        switch (statType) {
          case 'sum':
            stats[fieldName] = values.reduce((acc, val) => acc + parseFloat(val || 0), 0);
            break;
          case 'average':
            const sum = values.reduce((acc, val) => acc + parseFloat(val || 0), 0);
            stats[fieldName] = sum / values.length;
            break;
          case 'count':
            stats[fieldName] = values.length;
            break;
          default:
            console.warn(`[TableDataService] Unknown stat type: ${statType}`);
        }
      } else {
        stats[fieldName] = null;
      }
    }
  }

  // Compter le nombre total de résultats (sans limit)
  const countQuery = `SELECT COUNT(*) as total FROM \`${table}\` WHERE ${where}`;
  const [countResult] = await pool.query(countQuery, params.slice(0, params.length - (limit ? 1 : 0) - (offset ? 1 : 0)));
  const total = countResult[0].total;
  //console.log('[TableDataService] Total count (sans limit):', total);

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

  // Ajouter les stats si présentes
  if (Object.keys(stats).length > 0) {
    response.stats = stats;
  }

  // Ajouter le schéma si demandé
  if (includeSchema === '1') {
    //console.log('[TableDataService] Ajout du schéma à la réponse...');
    response.schema = SchemaService.buildFilteredSchema(user, table);
  }
  if(useProxy) {
  //console.log('[TableDataService] Application du dataProxy...');
    const response2  = dataProxy(response)
    return JSON.parse(JSON.stringify(response2))

  }

  //console.log('[TableDataService] ✅ Réponse finale:', { rows:response.rows });
  //console.log('====== [TableDataService.getTableData] Fin ======\n');
  return response;
}

module.exports = {
  getTableData,
  loadRelationsForRow
};
