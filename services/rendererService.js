const schema = require('../schema');
const SchemaService = require('./schemaService');

// marked is an ES Module, we'll import it dynamically when needed
let markedModule = null;

/**
 * Renderer Service
 * Provides server-side field rendering for API responses
 * Used when ?renderer=1 is passed to API endpoints
 */
class RendererService {
  /**
   * Lazy load the marked module (ES Module)
   * @private
   */
  static async _getMarked() {
    if (!markedModule) {
      const { marked } = await import('marked');
      markedModule = marked;
    }
    return markedModule;
  }
  /**
   * Render a field value based on its renderer type
   * @param {*} value - The field value
   * @param {Object} field - The field definition from schema
   * @param {string} fieldName - The field name
   * @param {Object} row - The full row data (for context)
   * @param {Object} options - Rendering options
   * @param {boolean} options.compact - Whether compact mode is enabled
   * @returns {Promise<*>} - The rendered value
   */
  static async renderField(value, field, fieldName, row, options = {}) {
    if (value === null || value === undefined) {
      return null;
    }

    const renderer = field.renderer || field.type;

    switch (renderer) {
      case 'markdown':
        return await this.renderMarkdown(value);

      case 'date':
        return this.renderDate(value);

      case 'datetime':
        return this.renderDateTime(value);

      case 'duration':
        return this.renderDuration(value);

      case 'email':
      case 'telephone':
      case 'url':
      case 'image':
        // For these types, we could add specific formatting
        // For now, just return the value as-is
        return value;

      default:
        return value;
    }
  }

  /**
   * Render markdown text to HTML
   * @param {string} markdown - Markdown text
   * @returns {Promise<string>} - HTML output
   */
  static async renderMarkdown(markdown) {
    if (!markdown || typeof markdown !== 'string') {
      return '';
    }

    try {
      const marked = await this._getMarked();

      // Configure marked with GFM (GitHub Flavored Markdown) support
      marked.setOptions({
        gfm: true,
        breaks: true,
        headerIds: true,
        mangle: false
      });

      return marked.parse(markdown);
    } catch (error) {
      console.error('[RendererService] Error rendering markdown:', error);
      return markdown; // Fallback to original text
    }
  }

  /**
   * Render date in locale format
   * @param {string|Date} date - Date value
   * @returns {string} - Formatted date
   */
  static renderDate(date) {
    if (!date) return '';

    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const locale = this.getLocale();

      return dateObj.toLocaleDateString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (error) {
      console.error('[RendererService] Error rendering date:', error);
      return String(date);
    }
  }

  /**
   * Render datetime in locale format
   * @param {string|Date} datetime - DateTime value
   * @returns {string} - Formatted datetime
   */
  static renderDateTime(datetime) {
    if (!datetime) return '';

    try {
      const dateObj = typeof datetime === 'string' ? new Date(datetime) : datetime;
      const locale = this.getLocale();

      return dateObj.toLocaleString(locale, {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      console.error('[RendererService] Error rendering datetime:', error);
      return String(datetime);
    }
  }

  /**
   * Render ISO 8601 duration to human-readable format
   * Converts PT37M53S to 37'53"
   * Supports: PT1H30M, PT45M, PT2H, PT1H2M3S, etc.
   * @param {string} duration - ISO 8601 duration string (e.g., PT37M53S)
   * @returns {string} - Formatted duration (e.g., 37'53")
   */
  static renderDuration(duration) {
    if (!duration || typeof duration !== 'string') return '';

    try {
      // ISO 8601 duration format: PT1H30M45S
      // P = Period, T = Time separator
      const regex = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/;
      const match = duration.match(regex);

      if (!match) {
        return duration; // Return original if not valid ISO 8601
      }

      const hours = match[1] ? parseInt(match[1], 10) : 0;
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const seconds = match[3] ? parseFloat(match[3]) : 0;

      // Build formatted string
      const parts = [];

      if (hours > 0) {
        parts.push(`${hours}h`);
      }

      if (minutes > 0) {
        parts.push(`${minutes}'`);
      }

      if (seconds > 0) {
        // Format seconds as integer if no decimal part
        const formattedSeconds = seconds % 1 === 0 ? seconds : seconds.toFixed(2);
        parts.push(`${formattedSeconds}"`);
      }

      // If no parts, return 0"
      if (parts.length === 0) {
        return '0"';
      }

      return parts.join('');
    } catch (error) {
      console.error('[RendererService] Error rendering duration:', error);
      return String(duration);
    }
  }

  /**
   * Get locale from schema configuration
   * @returns {string} - Locale string (e.g., 'fr-FR', 'en-US')
   */
  static getLocale() {
    const country = schema.country || 'FR';
    const language = schema.languages || 'fr';

    // Build locale string (e.g., 'fr-FR', 'en-US')
    const locale = `${language}-${country}`;
    return locale;
  }

  /**
   * Enrich a row with rendered fields (prefixed with _)
   * @param {Object} row - The row data
   * @param {string} tableName - The table name
   * @param {Object} options - Rendering options
   * @param {boolean} options.compact - Whether compact mode is enabled
   * @returns {Promise<Object>} - The enriched row with _fieldName rendered values
   */
  static async enrichRowWithRenderers(row, tableName, options = {}) {
    const { compact = false } = options;

    // Get table schema
    const tableConfig = SchemaService.getTableConfig(tableName);
    if (!tableConfig || !tableConfig.fields) {
      return row;
    }

    // Clone row to avoid mutation
    const enrichedRow = { ...row };

    // Process each field in the schema
    for (const [fieldName, field] of Object.entries(tableConfig.fields)) {
      // Skip computed fields and fields not in the row
      if (field.as || field.calculate || !(fieldName in row)) {
        continue;
      }

      const value = row[fieldName];

      // Check if field has a renderer
      if (field.renderer) {
        // Render the field value
        const renderedValue = await this.renderField(value, field, fieldName, row, { compact });

        // Add rendered value with _ prefix
        enrichedRow[`_${fieldName}`] = renderedValue;
      }
      // Check if field is a relation (n:1) in compact mode
      else if (field.relation && compact) {
        // If there's a relation loaded in _relations
        if (row._relations && row._relations[fieldName]) {
          const relatedRow = row._relations[fieldName];

          // Use the _label if available, otherwise try to construct it
          if (relatedRow._label) {
            enrichedRow[`_${fieldName}`] = relatedRow._label;
          } else {
            // Try to construct label from displayFields
            const displayFields = SchemaService.getDisplayFields(field.relation);
            if (displayFields && displayFields.length > 0) {
              const labelValues = displayFields
                .map(df => relatedRow[df])
                .filter(val => val !== null && val !== undefined && val !== '');
              if (labelValues.length > 0) {
                enrichedRow[`_${fieldName}`] = labelValues.join(' ');
              }
            }
          }
        }
      }
    }

    // Also process relations if they exist
    if (row._relations) {
      const enrichedRelations = {};

      for (const [relationName, relationData] of Object.entries(row._relations)) {
        if (Array.isArray(relationData)) {
          // 1:N relation - process each item
          enrichedRelations[relationName] = await Promise.all(
            relationData.map(async (relRow) => {
              // Get the related table name
              const relatedTableName = relRow._table;
              if (relatedTableName) {
                return await this.enrichRowWithRenderers(relRow, relatedTableName, options);
              }
              return relRow;
            })
          );
        } else {
          // N:1 relation - process single item
          const relatedTableName = relationData._table;
          if (relatedTableName) {
            enrichedRelations[relationName] = await this.enrichRowWithRenderers(relationData, relatedTableName, options);
          } else {
            enrichedRelations[relationName] = relationData;
          }
        }
      }

      enrichedRow._relations = enrichedRelations;
    }

    return enrichedRow;
  }
}

module.exports = RendererService;
