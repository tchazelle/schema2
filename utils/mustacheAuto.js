const schema = require('../schema.js');
const MustacheTemplateGenerator = require('./MustacheTemplateGenerator.js');

/**
 * Génère un template Mustache automatique pour une table donnée
 * basé exclusivement sur la structure définie dans schema.js
 *
 * Structure générée :
 * - Container de table : div.table[data-table=nom]
 *   - Nom de la table
 *   - Container de rows : article.table[data-table=nom]
 *     - Container de row : div.row[data-id=id]
 *       - Container de field/relation : div.row[data-field/relation=name][data-type=type]
 *         - Label : div.label
 *         - Value : div.value (simple|object n:1|array 1:n)
 *
 * @param {string} table - Nom de la table
 * @param {Object} options - Options de configuration
 * @param {boolean} options.useDisplayFields - Utiliser les displayFields du schéma (par défaut: true)
 * @param {string} options.rowsVarName - Nom de la variable pour les rows (par défaut: 'rows')
 * @param {number} options.maxDepth - Profondeur maximale pour les relations (par défaut: 2)
 * @returns {string} Template Mustache généré
 */
function mustacheAuto(table, options = {}) {
  const generator = new MustacheTemplateGenerator(schema, options);
  return generator.generateTemplate(table);
}

module.exports = {
  mustacheAuto,
  MustacheTemplateGenerator
};
