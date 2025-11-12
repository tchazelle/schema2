const schema = require('../schema.js');

/**
 * Génère un template Mustache simpliste pour une table
 * @param {string} tableName - Nom de la table
 * @returns {string} Template Mustache
 */
function generateSimpleTemplate(tableName) {
  const tableDef = schema.tables[tableName];
  if (!tableDef || !tableDef.fields) {
    throw new Error(`Table ${tableName} introuvable dans le schéma`);
  }

  let template = '';

  // Container principal des rows
  template += `<div class="rows" data-table="${tableName}">\n`;
  template += `{{#rows}}\n`;

  // Article pour chaque row
  template += `  <article class="row" data-id="{{id}}">\n`;

  // Générer un field pour chaque champ de la table
  for (const [fieldName, fieldDef] of Object.entries(tableDef.fields)) {
    // Ignorer les champs de relation et les commonFields internes
    if (fieldDef.relation) continue;
    if (['ownerId', 'granted', 'createdAt', 'updatedAt'].includes(fieldName)) continue;
    if (fieldDef.as || fieldDef.calculate) continue; // Ignorer les champs calculés

    template += `    <div data-field="${fieldName}">\n`;
    template += `      <div class="label">${fieldName}</div>\n`;
    template += `      <div class="value">{{${fieldName}}}</div>\n`;
    template += `    </div>\n`;
  }

  template += `  </article>\n`;
  template += `{{/rows}}\n`;
  template += `</div>\n`;

  return template;
}

module.exports = generateSimpleTemplate;
