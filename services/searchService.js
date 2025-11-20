const pool = require('../config/database');
const schema = require('../schema.js');
const SchemaService = require('./schemaService');
const { hasPermission, getAccessibleTables } = require('./permissionService');

/**
 * SearchService
 * Service for multi-table search functionality
 */
class SearchService {
  /**
   * Get searchable fields for a table (text and date fields)
   * @param {string} table - Table name
   * @returns {Object} - { textFields: [...], dateFields: [...] }
   */
  static getSearchableFields(table) {
    const tableSchema = schema.tables[table];
    if (!tableSchema) {
      return { textFields: [], dateFields: [] };
    }

    const textFields = [];
    const dateFields = [];

    // Get all fields including common fields
    const allFields = { ...tableSchema.fields, ...schema.commonFields };

    Object.entries(allFields).forEach(([fieldName, fieldDef]) => {
      // Skip computed fields (as, calculate)
      if (fieldDef.as || fieldDef.calculate) {
        return;
      }

      // Text fields: varchar, text
      if (fieldDef.type === 'varchar' || fieldDef.type === 'text') {
        textFields.push(fieldName);
      }

      // Date fields: date, datetime, timestamp
      if (fieldDef.type === 'date' || fieldDef.type === 'datetime' || fieldDef.type === 'timestamp') {
        dateFields.push(fieldName);
      }
    });

    return { textFields, dateFields };
  }

  /**
   * Build WHERE clause for a single table search
   * @param {string} table - Table name
   * @param {string} searchTerm - Search term
   * @param {Object} searchableFields - { textFields, dateFields }
   * @returns {string} - WHERE clause
   */
  static buildSearchWhere(table, searchTerm, searchableFields) {
    const conditions = [];

    // Search in text fields (case-insensitive)
    searchableFields.textFields.forEach(field => {
      conditions.push(`${field} LIKE ?`);
    });

    // Search in date fields (formatted in country format)
    // For FR: DATE_FORMAT(field, '%d/%m/%Y') or DATE_FORMAT(field, '%d/%m/%Y %H:%i:%s')
    const dateFormat = schema.country === 'FR' ? '%d/%m/%Y' : '%Y-%m-%d';
    searchableFields.dateFields.forEach(field => {
      conditions.push(`DATE_FORMAT(${field}, '${dateFormat}') LIKE ?`);
    });

    if (conditions.length === 0) {
      return '1=0'; // No searchable fields, return no results
    }

    return `(${conditions.join(' OR ')})`;
  }

  /**
   * Search across multiple tables
   * @param {Object} user - User object
   * @param {string} searchTerm - Search term
   * @param {Object} options - Options
   * @param {number} options.limit - Max results per table (default: 10)
   * @returns {Promise<Object>} - { success: true, results: { tableName: { rows: [...], count: N } } }
   */
  static async searchAll(user, searchTerm, options = {}) {
    try {
      const { limit = 10 } = options;

      // Get accessible tables
      const accessibleTables = getAccessibleTables(user);

      if (accessibleTables.length === 0) {
        return {
          success: true,
          results: {},
          totalResults: 0,
          searchTerm
        };
      }

      const results = {};
      let totalResults = 0;

      // Search in each table
      for (const table of accessibleTables) {
        // Check read permission
        if (!hasPermission(user, table, 'read')) {
          continue;
        }

        // Get searchable fields
        const searchableFields = this.getSearchableFields(table);

        if (searchableFields.textFields.length === 0 && searchableFields.dateFields.length === 0) {
          continue; // Skip tables with no searchable fields
        }

        // Build WHERE clause
        const whereClause = this.buildSearchWhere(table, searchTerm, searchableFields);

        // Build search parameters (one for each condition)
        const searchPattern = `%${searchTerm}%`;
        const params = [];
        const numConditions = searchableFields.textFields.length + searchableFields.dateFields.length;
        for (let i = 0; i < numConditions; i++) {
          params.push(searchPattern);
        }

        // Add user-based access control
        let accessWhere = '';
        if (user && user.id) {
          const allRoles = user.allRoles || [];
          const rolesPlaceholders = allRoles.map(() => '?').join(',');

          accessWhere = ` AND (
            ownerId = ?
            OR granted = 'shared'
            OR granted IN (${rolesPlaceholders})
            OR granted LIKE 'published @%'
          )`;

          params.push(user.id);
          params.push(...allRoles);
        } else {
          // Public user: only published rows
          accessWhere = ` AND (granted = 'published @public')`;
        }

        // Execute search query with limit
        const query = `
          SELECT * FROM ${table}
          WHERE ${whereClause} ${accessWhere}
          ORDER BY updatedAt DESC
          LIMIT ?
        `;
        params.push(limit);

        try {
          const [rows] = await pool.query(query, params);

          if (rows.length > 0) {
            // Get total count (without limit)
            const countQuery = `
              SELECT COUNT(*) as total FROM ${table}
              WHERE ${whereClause} ${accessWhere}
            `;
            const countParams = params.slice(0, -1); // Remove limit param
            const [countResult] = await pool.query(countQuery, countParams);
            const totalCount = countResult[0].total;

            results[table] = {
              rows,
              count: rows.length,
              total: totalCount,
              hasMore: totalCount > limit
            };

            totalResults += totalCount;
          }
        } catch (error) {
          console.error(`Error searching in table ${table}:`, error);
          // Continue with other tables
        }
      }

      return {
        success: true,
        results,
        totalResults,
        searchTerm,
        tablesSearched: accessibleTables.length
      };

    } catch (error) {
      console.error('Error in searchAll:', error);
      return {
        success: false,
        error: 'Erreur lors de la recherche',
        details: error.message
      };
    }
  }

  /**
   * Get search statistics (number of searchable tables and fields)
   * @param {Object} user - User object
   * @returns {Object} - { tables: N, totalTextFields: N, totalDateFields: N }
   */
  static getSearchStats(user) {
    const accessibleTables = getAccessibleTables(user);
    let totalTextFields = 0;
    let totalDateFields = 0;
    let searchableTables = 0;

    accessibleTables.forEach(table => {
      if (!hasPermission(user, table, 'read')) {
        return;
      }

      const { textFields, dateFields } = this.getSearchableFields(table);
      if (textFields.length > 0 || dateFields.length > 0) {
        searchableTables++;
        totalTextFields += textFields.length;
        totalDateFields += dateFields.length;
      }
    });

    return {
      tables: searchableTables,
      totalTextFields,
      totalDateFields
    };
  }
}

module.exports = SearchService;
