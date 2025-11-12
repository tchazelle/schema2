/**
 * Service centralisé pour tout ce qui concerne le schéma
 * Élimine la duplication de code entre apiTables.js et crud.js
 */

const schema = require('../../schema.js');
const { hasPermission, getUserAllRoles } = require('../permissions');

class SchemaService {
  /**
   * Trouve le nom exact d'une table dans le schéma, indépendamment de la casse
   * UNIQUE INSTANCE - Plus de doublon entre apiTables.js et crud.js !
   *
   * @param {string} tableName - Nom de la table (peut être en minuscules, majuscules, etc.)
   * @returns {string|null} - Nom exact de la table ou null si non trouvée
   */
  static getTableName(tableName) {
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
   * Vérifie si une table existe dans le schéma
   * @param {string} tableName - Nom de la table
   * @returns {boolean} - true si la table existe
   */
  static tableExists(tableName) {
    return this.getTableName(tableName) !== null;
  }

  /**
   * Obtient la configuration d'une table
   * @param {string} tableName - Nom de la table
   * @returns {Object|null} - Configuration de la table ou null
   */
  static getTableConfig(tableName) {
    const exactName = this.getTableName(tableName);
    return exactName ? schema.tables[exactName] : null;
  }

  /**
   * Charge les relations d'une table (n:1 et 1:n)
   * Déplacé de apiTables.js ligne 161
   *
   * @param {Object} user - L'utilisateur (pour vérifier les permissions)
   * @param {string} tableName - Nom de la table
   * @returns {Object} - { relationsN1: {}, relations1N: {} }
   */
  static getTableRelations(user, tableName) {
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
   * Construit le schéma filtré selon les permissions de l'utilisateur
   * Déplacé de apiTables.js ligne 385
   * [#TC] Cette fonction était déjà identifiée comme devant être dans utils/schema
   *
   * @param {Object} user - L'utilisateur
   * @param {string} tableName - Nom de la table
   * @returns {Object} - Schéma filtré
   */
  static buildFilteredSchema(user, tableName) {
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
    const { relationsN1, relations1N } = this.getTableRelations(user, tableName);
    filteredSchema.relations.n1 = relationsN1;
    filteredSchema.relations["1n"] = relations1N;

    return filteredSchema;
  }

  /**
   * Obtient la liste de tous les noms de tables
   * @returns {Array<string>} - Liste des noms de tables
   */
  static getAllTableNames() {
    return Object.keys(schema.tables);
  }

  /**
   * Obtient les champs d'affichage (displayFields) d'une table
   * @param {string} tableName - Nom de la table
   * @returns {Array<string>|null} - Liste des champs d'affichage
   */
  static getDisplayFields(tableName) {
    const tableConfig = this.getTableConfig(tableName);
    return tableConfig ? tableConfig.displayFields : null;
  }

  /**
   * Vérifie si un champ existe dans une table
   * @param {string} tableName - Nom de la table
   * @param {string} fieldName - Nom du champ
   * @returns {boolean} - true si le champ existe
   */
  static fieldExists(tableName, fieldName) {
    const tableConfig = this.getTableConfig(tableName);
    if (!tableConfig) return false;
    return !!tableConfig.fields[fieldName];
  }

  /**
   * Obtient la configuration d'un champ
   * @param {string} tableName - Nom de la table
   * @param {string} fieldName - Nom du champ
   * @returns {Object|null} - Configuration du champ
   */
  static getFieldConfig(tableName, fieldName) {
    const tableConfig = this.getTableConfig(tableName);
    if (!tableConfig) return null;
    return tableConfig.fields[fieldName] || null;
  }
}

module.exports = SchemaService;
