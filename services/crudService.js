const pool = require('../config/database');
const SchemaService = require('./schemaService');
const EntityService = require('./entityService');
const TableDataService = require('./tableDataService');
const PermissionService = require('./permissionService');
const schema = require('../schema');

/**
 * CRUD Service - Business logic for CRUD operations
 */
class CrudService {

  /**
   * Get list data for CRUD interface with all necessary metadata
   * @param {Object} user - Current user
   * @param {string} tableName - Table name
   * @param {Object} options - Query options (limit, offset, orderBy, order, search, showSystemFields)
   * @returns {Object} - Complete data for rendering list
   */
  static async getListData(user, tableName, options = {}) {
    const {
      limit = 100,
      offset = 0,
      orderBy = 'updatedAt',
      order = 'DESC',
      search = '',
      showSystemFields = false,
      selectedFields = null, // Array of field names to show, null = default
      compact = true,
      advancedSearch = null, // Advanced search criteria (JSON)
      advancedSort = null // Advanced sort criteria (JSON)
    } = options;

    // Normalize table name
    const table = SchemaService.getTableName(tableName);
    if (!table) {
      return { success: false, error: 'Table non trouvée' };
    }

    // Check permissions
    if (!PermissionService.hasPermission(user, table, 'read')) {
      return { success: false, error: 'Accès refusé à cette table' };
    }

    // Get table schema
    const tableSchema = SchemaService.getTableConfig(table);
    const tableConfig = {
      ...schema.defaultConfigTable,
      ...tableSchema
    };

    // Normalize displayFields to always be an array
    // Handle both displayField (singular) and displayFields (plural) for backward compatibility
    if (tableConfig.displayField && !tableConfig.displayFields) {
      tableConfig.displayFields = Array.isArray(tableConfig.displayField)
        ? tableConfig.displayField
        : [tableConfig.displayField];
    } else if (tableConfig.displayFields && typeof tableConfig.displayFields === 'string') {
      tableConfig.displayFields = [tableConfig.displayFields];
    } else if (!tableConfig.displayFields) {
      // Fallback to ['name'] if nothing is specified
      tableConfig.displayFields = ['name'];
    }

    // Build WHERE clause for search
    let customWhere = '1=1';
    const searchParams = [];

    // Track JOIN clauses for relations (used by both search and sort)
    let joins = [];

    // Use advanced search if provided, otherwise use simple search
    if (advancedSearch) {
      const advancedResult = this.buildAdvancedSearchWhere(advancedSearch, table);
      if (advancedResult.where) {
        customWhere += ` AND (${advancedResult.where})`;
        searchParams.push(...advancedResult.params);
        // Add JOINs from search
        if (advancedResult.joins) {
          joins.push(...advancedResult.joins);
        }
      }
    } else if (search && search.length >= 2) {
      const searchFields = this.getSearchableFields(user, table);
      if (searchFields.length > 0) {
        const searchConditions = searchFields.map(field => {
          // Remove accents for French text search
          // Prefix field with table name to avoid ambiguity when JOINs are present
          return `LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(${table}.${field}, 'é', 'e'), 'è', 'e'), 'ê', 'e'), 'à', 'a'), 'ù', 'u')) LIKE ?`;
        });
        customWhere += ` AND (${searchConditions.join(' OR ')})`;
        const searchPattern = `%${this.removeAccents(search.toLowerCase())}%`;
        searchFields.forEach(() => searchParams.push(searchPattern));
      }
    }

    // Determine orderBy and order from advanced sort or simple sort
    let finalOrderBy = orderBy;
    let finalOrder = order;

    if (advancedSort && advancedSort.length > 0) {
      // Build multi-criteria ORDER BY clause with JOIN support for relations
      const sortClauses = advancedSort
        .filter(criterion => criterion.field)
        .map(criterion => {
          // Check if field references a relation (format: Table.field)
          if (criterion.field.includes('.')) {
            const [relatedTable, relatedField] = criterion.field.split('.');
            // Find the foreign key field in the main table
            const foreignKeyField = this.findForeignKeyField(table, relatedTable);
            if (foreignKeyField) {
              // Add JOIN if not already added
              const joinAlias = `rel_${relatedTable}`;
              if (!joins.some(j => j.includes(joinAlias))) {
                joins.push(`LEFT JOIN ${relatedTable} AS ${joinAlias} ON ${table}.${foreignKeyField} = ${joinAlias}.id`);
              }
              return `${joinAlias}.${relatedField} ${criterion.order || 'ASC'}`;
            }
          }
          return `${table}.${criterion.field} ${criterion.order || 'ASC'}`;
        })
        .join(', ');
      if (sortClauses) {
        finalOrderBy = sortClauses; // Override with advanced sort
        finalOrder = ''; // Clear order as it's already in finalOrderBy
      }
    } else if (finalOrderBy && finalOrderBy.includes('.')) {
      // Handle simple sort on relation fields (format: Table.field or MainTable.Table.field)
      let sortField = finalOrderBy;

      // Remove main table prefix if present (e.g., "CommunicateAction.Person.familyName" → "Person.familyName")
      const parts = sortField.split('.');
      if (parts.length === 3 && parts[0] === table) {
        sortField = `${parts[1]}.${parts[2]}`;
      }

      if (sortField.includes('.')) {
        const [relatedTable, relatedField] = sortField.split('.');
        // Find the foreign key field in the main table
        const foreignKeyField = this.findForeignKeyField(table, relatedTable);
        if (foreignKeyField) {
          // Add JOIN if not already added
          const joinAlias = `rel_${relatedTable}`;
          if (!joins.some(j => j.includes(joinAlias))) {
            joins.push(`LEFT JOIN ${relatedTable} AS ${joinAlias} ON ${table}.${foreignKeyField} = ${joinAlias}.id`);
          }
          finalOrderBy = `${joinAlias}.${relatedField}`;
        }
      }
    } else if (finalOrderBy) {
      // Prefix table name for non-relation fields to avoid ambiguity when JOINs are present
      if (joins.length > 0 && !finalOrderBy.includes('.')) {
        finalOrderBy = `${table}.${finalOrderBy}`;
      }
    }

    // Get data with relations
    // Don't pass 'relation' parameter to use the actual default behavior:
    // - All N:1 relations
    // - Only Strong 1:N relations
    const result = await TableDataService.getTableData(user, table, {
      limit,
      offset,
      orderBy: finalOrderBy,
      order: finalOrder,
      customWhere,
      customWhereParams: searchParams,
      customJoins: joins, // Pass JOINs for advanced search/sort on relations
      compact,
      includeSchema: '1'
    });

    if (!result.success) {
      return result;
    }

    // Get visible fields
    const visibleFields = this.getVisibleFields(
      user,
      table,
      showSystemFields,
      selectedFields
    );

    // Get table structure
    const structure = SchemaService.getTableStructure(user, table);

    // Get user permissions for this table
    const permissions = {
      canRead: PermissionService.hasPermission(user, table, 'read'),
      canCreate: PermissionService.hasPermission(user, table, 'create'),
      canUpdate: PermissionService.hasPermission(user, table, 'update'),
      canDelete: PermissionService.hasPermission(user, table, 'delete'),
      canPublish: PermissionService.hasPermission(user, table, 'publish')
    };

    // Get all fields INCLUDING system fields (for field selector)
    const allFieldsForSelector = Object.keys(structure.fields);

    return {
      success: true,
      table,
      tableConfig,
      rows: result.rows,
      pagination: result.pagination,
      visibleFields,
      allFields: allFieldsForSelector,
      structure,
      permissions,
      schema: result.schema
    };
  }

  /**
   * Get a single record with full details for expanded view
   * @param {Object} user - Current user
   * @param {string} tableName - Table name
   * @param {number} id - Record ID
   * @returns {Object} - Complete record data with all relations
   */
  static async getRecordDetails(user, tableName, id) {
    const table = SchemaService.getTableName(tableName);
    if (!table) {
      return { success: false, error: 'Table non trouvée' };
    }

    // Check permissions
    if (!PermissionService.hasPermission(user, table, 'read')) {
      return { success: false, error: 'Accès refusé à cette table' };
    }

    // Get record with all relations
    const result = await TableDataService.getTableData(user, table, {
      id,
      relation: 'all', // Load all relations for detail view
      compact: true,
      includeSchema: '1'
    });

    if (!result.success || result.rows.length === 0) {
      return { success: false, error: 'Enregistrement non trouvé' };
    }

    const record = result.rows[0];

    // Get permissions for this specific record
    const canUpdate = PermissionService.hasPermission(user, table, 'update') &&
                     EntityService.canAccessEntity(user, table, record);
    const canDelete = PermissionService.hasPermission(user, table, 'delete') &&
                     EntityService.canAccessEntity(user, table, record);

    return {
      success: true,
      table,
      record,
      permissions: {
        canUpdate,
        canDelete
      },
      schema: result.schema
    };
  }

  /**
   * Get visible fields for a table based on permissions and filters
   * @param {Object} user - Current user
   * @param {string} table - Table name
   * @param {boolean} showSystemFields - Include system fields
   * @param {Array} selectedFields - Specific fields to show (null = default)
   * @returns {Array} - Array of field names
   */
  static getVisibleFields(user, table, showSystemFields = false, selectedFields = null) {
    const structure = SchemaService.getTableStructure(user, table);
    if (!structure) return [];

    let fields = Object.keys(structure.fields);

    // If specific fields selected, use those first
    if (selectedFields && Array.isArray(selectedFields) && selectedFields.length > 0) {
      fields = fields.filter(f => selectedFields.includes(f));
    }

    // Then filter system fields if not requested (this ensures system fields are always filtered unless explicitly requested)
    const systemFields = ['id', 'ownerId', 'granted', 'createdAt', 'updatedAt'];
    if (!showSystemFields) {
      fields = fields.filter(f => !systemFields.includes(f));
    }

    return fields;
  }

  /**
   * Get searchable fields for a table (text fields only)
   * @param {Object} user - Current user
   * @param {string} table - Table name
   * @returns {Array} - Array of searchable field names
   */
  static getSearchableFields(user, table) {
    const structure = SchemaService.getTableStructure(user, table);
    if (!structure) return [];

    const textTypes = ['varchar', 'text', 'enum'];
    const fields = [];

    for (const [fieldName, field] of Object.entries(structure.fields)) {
      // Skip computed fields
      if (field.as || field.calculate) continue;

      // Include text fields
      if (textTypes.includes(field.type)) {
        fields.push(fieldName);
      }
    }

    return fields;
  }

  /**
   * Remove French accents from text for search
   * @param {string} text - Text to process
   * @returns {string} - Text without accents
   */
  static removeAccents(text) {
    return text
      .replace(/[éèêë]/g, 'e')
      .replace(/[àâä]/g, 'a')
      .replace(/[ùûü]/g, 'u')
      .replace(/[îï]/g, 'i')
      .replace(/[ôö]/g, 'o')
      .replace(/[ç]/g, 'c')
      .replace(/[ñ]/g, 'n');
  }

  /**
   * Format field value according to renderer
   * @param {any} value - Field value
   * @param {Object} field - Field definition from schema
   * @param {string} country - Country code for date formatting
   * @returns {Object} - Formatted value with metadata { value, formatted, renderer }
   */
  static formatFieldValue(value, field, country = 'FR') {
    const renderer = field.renderer || field.type;

    // Handle null/undefined
    if (value === null || value === undefined) {
      return { value: null, formatted: '', renderer: 'text' };
    }

    // Handle dates
    if (field.type === 'date' || field.type === 'datetime') {
      const date = new Date(value);
      const formatted = country === 'FR'
        ? date.toLocaleDateString('fr-FR')
        : date.toLocaleDateString();
      return { value, formatted, renderer: 'date' };
    }

    // Return with renderer info
    return {
      value,
      formatted: String(value),
      renderer: renderer || 'text'
    };
  }

  /**
   * Get menu tables for user (tables they can create in)
   * @param {Object} user - Current user
   * @returns {Array} - Array of table names
   */
  static getMenuTables(user) {
    const tables = SchemaService.getAllTableNames();
    return tables.filter(table => {
      return PermissionService.hasPermission(user, table, 'create') ||
             PermissionService.hasPermission(user, table, 'update');
    });
  }

  /**
   * Build WHERE clause from advanced search criteria
   * @param {Object} searchGroups - Advanced search criteria (groups with AND/OR logic)
   * @param {string} table - Table name
   * @returns {Object} - { where: string, params: array, joins: array }
   */
  static buildAdvancedSearchWhere(searchGroups, table) {
    const groupClauses = [];
    const allParams = [];
    const joins = [];
    const joinedTables = new Set(); // Track which tables we've already joined

    // Each group is an OR condition
    for (const group of searchGroups) {
      if (!group.conditions || group.conditions.length === 0) continue;

      const conditionClauses = [];

      // Each condition in a group is an AND condition
      for (const condition of group.conditions) {
        if (!condition.field || !condition.operator) continue;

        let { field, operator, value, value2 } = condition;

        // Check if field references a relation (format: Table.field)
        if (field.includes('.')) {
          const [relatedTable, relatedField] = field.split('.');
          // Find the foreign key field in the main table
          const foreignKeyField = this.findForeignKeyField(table, relatedTable);
          if (foreignKeyField) {
            // Add JOIN if not already added
            const joinAlias = `rel_${relatedTable}`;
            if (!joinedTables.has(relatedTable)) {
              joins.push(`LEFT JOIN ${relatedTable} AS ${joinAlias} ON ${table}.${foreignKeyField} = ${joinAlias}.id`);
              joinedTables.add(relatedTable);
            }
            // Replace field with joined table alias
            field = `${joinAlias}.${relatedField}`;
          }
        } else {
          // Prefix table name for non-relation fields
          field = `${table}.${field}`;
        }

        // Build SQL based on operator
        switch (operator) {
          case 'contains':
            conditionClauses.push(`${field} LIKE ?`);
            allParams.push(`%${value}%`);
            break;

          case 'not_contains':
            conditionClauses.push(`(${field} NOT LIKE ? OR ${field} IS NULL)`);
            allParams.push(`%${value}%`);
            break;

          case 'equals':
            conditionClauses.push(`${field} = ?`);
            allParams.push(value);
            break;

          case 'not_equals':
            conditionClauses.push(`(${field} != ? OR ${field} IS NULL)`);
            allParams.push(value);
            break;

          case 'starts_with':
            conditionClauses.push(`${field} LIKE ?`);
            allParams.push(`${value}%`);
            break;

          case 'ends_with':
            conditionClauses.push(`${field} LIKE ?`);
            allParams.push(`%${value}`);
            break;

          case 'is_empty':
            conditionClauses.push(`(${field} IS NULL OR ${field} = '')`);
            break;

          case 'is_not_empty':
            conditionClauses.push(`(${field} IS NOT NULL AND ${field} != '')`);
            break;

          case 'greater_than':
            conditionClauses.push(`${field} > ?`);
            allParams.push(value);
            break;

          case 'less_than':
            conditionClauses.push(`${field} < ?`);
            allParams.push(value);
            break;

          case 'between':
            if (value && value2) {
              conditionClauses.push(`${field} BETWEEN ? AND ?`);
              allParams.push(value, value2);
            }
            break;

          case 'is_zero':
            conditionClauses.push(`${field} = 0`);
            break;

          case 'is_not_zero':
            conditionClauses.push(`${field} != 0`);
            break;

          case 'before':
            conditionClauses.push(`${field} < ?`);
            allParams.push(value);
            break;

          case 'after':
            conditionClauses.push(`${field} > ?`);
            allParams.push(value);
            break;

          case 'is_true':
            conditionClauses.push(`${field} = 1`);
            break;

          case 'is_false':
            conditionClauses.push(`${field} = 0`);
            break;

          default:
            // Unknown operator, skip
            break;
        }
      }

      // Combine conditions with AND
      if (conditionClauses.length > 0) {
        groupClauses.push(`(${conditionClauses.join(' AND ')})`);
      }
    }

    // Combine groups with OR
    if (groupClauses.length > 0) {
      return {
        where: groupClauses.join(' OR '),
        params: allParams,
        joins: joins
      };
    }

    return { where: '', params: [], joins: [] };
  }

  /**
   * Find the foreign key field that links to a related table
   * @param {string} table - Main table name
   * @param {string} relatedTable - Related table name
   * @returns {string|null} - Foreign key field name or null
   */
  static findForeignKeyField(table, relatedTable) {
    const tableSchema = schema.tables[table];
    if (!tableSchema || !tableSchema.fields) return null;

    // Look for a field with a relation to the target table
    // Note: arrayName defines the reverse 1:N relation property name,
    // but doesn't prevent this field from being used as a N:1 foreign key
    for (const [fieldName, field] of Object.entries(tableSchema.fields)) {
      if (field.relation === relatedTable && field.type === 'integer') {
        return fieldName;
      }
    }

    return null;
  }
}

module.exports = CrudService;
