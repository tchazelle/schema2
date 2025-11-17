/**
 * CRUD List Utility Functions
 *
 * Standalone utility functions used by the CRUD List component.
 * These are pure functions with no React dependencies.
 */

/**
 * Helper function to build card title from displayFields
 * @param {Object} row - The data row
 * @param {string} tableName - Table name
 * @param {Object} tableConfig - Table configuration
 * @returns {string} - Display title
 */
function buildCardTitle(row, tableName, tableConfig) {
  if (!tableConfig || !tableConfig.displayFields || tableConfig.displayFields.length === 0) {
    return null;
  }

  const values = tableConfig.displayFields
    .map(fieldName => row[fieldName])
    .filter(val => val !== null && val !== undefined && val !== '')
    .join(' ');

  return values || null;
}

/**
 * Get icon representing the granted status
 * @param {string} granted - The granted value (draft, shared, published @role)
 * @returns {string} - Emoji icon
 */
function getGrantedIcon(granted) {
  if (!granted || granted === 'draft') {
    return '📝'; // Draft - pencil
  } else if (granted === 'shared') {
    return '👥'; // Shared - people
  } else if (granted.startsWith('published @')) {
    return '🌐'; // Published - globe
  }
  return '📋'; // Default - clipboard
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildCardTitle,
    getGrantedIcon
  };
}

// Export to global scope for browser use
if (typeof window !== 'undefined') {
  window.buildCardTitle = buildCardTitle;
  window.getGrantedIcon = getGrantedIcon;
}
