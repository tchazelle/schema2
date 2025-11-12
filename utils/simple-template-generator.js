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

  // Générer un field pour chaque champ de la table (y compris les relations n:1)
  for (const [fieldName, fieldDef] of Object.entries(tableDef.fields)) {
    // Ignorer les commonFields internes
    if (['ownerId', 'granted', 'createdAt', 'updatedAt'].includes(fieldName)) continue;
    if (fieldDef.as || fieldDef.calculate) continue; // Ignorer les champs calculés

    // Si c'est une relation n:1
    if (fieldDef.relation) {
      template += `    {{#${fieldName}}}\n`;
      template += `    <div data-field="${fieldName}" class="relation manyToOne">\n`;
      template += `      <div class="label">${fieldDef.label || fieldName}</div>\n`;
      template += `      <div class="value">\n`;

      // Afficher le nom de l'objet lié
      const relatedTableDef = schema.tables[fieldDef.relation];
      if (relatedTableDef) {
        const displayField = relatedTableDef.displayField || schema.defaultConfigTable.displayField || 'name';
        const displayFields = Array.isArray(displayField) ? displayField : [displayField];
        displayFields.forEach(df => {
          template += `        <span class="display-field">{{${df}}}</span>\n`;
        });
      }

      template += `      </div>\n`;
      template += `    </div>\n`;
      template += `    {{/${fieldName}}}\n`;
      continue;
    }

    // Champ simple
    template += `    <div data-field="${fieldName}">\n`;
    template += `      <div class="label">${fieldName}</div>\n`;
    template += `      <div class="value">{{${fieldName}}}</div>\n`;
    template += `    </div>\n`;
  }

  // Ajouter les relations 1:n (oneToMany)
  const oneToManyRelations = findOneToManyRelations(tableName);
  for (const relation of oneToManyRelations) {
    template += `    {{#${relation.arrayName}}}\n`;
    template += `    <div data-relation="${relation.arrayName}" class="relation oneToMany">\n`;
    template += `      <div class="label">${relation.arrayName}</div>\n`;
    template += `      <div class="value">\n`;
    template += `        {{#.}}\n`;
    template += `        <div class="sub-row" data-table="${relation.fromTable}">\n`;

    // Afficher les champs de la table liée
    const relatedTableDef = schema.tables[relation.fromTable];
    if (relatedTableDef) {
      const displayField = relatedTableDef.displayField || schema.defaultConfigTable.displayField || 'name';
      const displayFields = Array.isArray(displayField) ? displayField : [displayField];
      displayFields.forEach(df => {
        template += `          <span class="display-field">{{${df}}}</span>\n`;
      });
    }

    template += `        </div>\n`;
    template += `        {{/.}}\n`;
    template += `      </div>\n`;
    template += `    </div>\n`;
    template += `    {{/${relation.arrayName}}}\n`;
  }

  template += `  </article>\n`;
  template += `{{/rows}}\n`;
  template += `</div>\n`;

  return template;
}

/**
 * Trouve toutes les relations 1:n (oneToMany) pour une table donnée
 * @param {string} targetTable - Nom de la table cible
 * @returns {Array} Liste des relations 1:n trouvées
 */
function findOneToManyRelations(targetTable) {
  const relations = [];

  for (const [tableName, tableSchema] of Object.entries(schema.tables)) {
    if (!tableSchema.fields) continue;

    for (const [fieldName, fieldConfig] of Object.entries(tableSchema.fields)) {
      // Si ce champ est une relation vers notre table cible
      if (fieldConfig.relation === targetTable) {
        relations.push({
          fromTable: tableName,
          fieldName: fieldName,
          arrayName: fieldConfig.arrayName || `${tableName}s`,
          relationshipStrength: fieldConfig.relationshipStrength || 'Weak'
        });
      }
    }
  }

  return relations;
}

module.exports = generateSimpleTemplate;
