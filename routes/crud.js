const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { hasPermission, getUserAllRoles } = require('../utils/permissions');
const schema = require('../schema.js');

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
    displayField: tableConfig.displayField || schema.defaultConfigPage.displayField,
    searchFields: tableConfig.searchFields || schema.defaultConfigPage.searchFields,
    pageSize: tableConfig.pageSize || schema.defaultConfigPage.pageSize,
    dateFormat: tableConfig.dateFormat || schema.defaultConfigPage.dateFormat,
    cardWidth: tableConfig.cardWidth || schema.defaultConfigPage.cardWidth,
    hasAttachmentsTab: tableConfig.hasAttachmentsTab !== undefined
      ? tableConfig.hasAttachmentsTab
      : schema.defaultConfigPage.hasAttachmentsTab,
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

  return structure;
}

/**
 * GET /_crud/:table
 * Retourne la structure des champs accessibles de la table
 * ainsi que les champs des relations si autorisés
 */
router.get('/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const user = req.user;

    // Si l'utilisateur n'est pas connecté, utiliser un user par défaut avec rôle public
    const effectiveUser = user || { roles: 'public' };

    // Récupérer la structure de la table
    const structure = getTableStructure(effectiveUser, table);

    if (!structure) {
      return res.status(404).json({
        error: 'Table non trouvée ou accès refusé',
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
    const { table, id } = req.params;
    const user = req.user;

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
