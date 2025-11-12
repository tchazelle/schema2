const schema = require('../schema.js');

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
 * @returns {string} Template Mustache généré
 */
function mustacheAuto(table) {
  // Vérifier que la table existe dans le schéma
  if (!schema.tables[table]) {
    throw new Error(`Table "${table}" non trouvée dans le schéma`);
  }

  const tableSchema = schema.tables[table];
  const fields = tableSchema.fields;

  // Commencer le template avec le container de table
  let template = `<div class="table" data-table="${table}">\n`;
  template += `  <h2>${table}</h2>\n\n`;

  // Container de rows (article répété pour chaque row)
  template += `  {{#rows}}\n`;
  template += `  <article class="table" data-table="${table}">\n`;
  template += `    <div class="row" data-id="{{id}}">\n\n`;

  // Parcourir tous les champs de la table
  for (const [fieldName, fieldConfig] of Object.entries(fields)) {
    // Ignorer les champs communs systèmes (sauf si nécessaire)
    if (['ownerId', 'createdAt', 'updatedAt'].includes(fieldName)) {
      continue;
    }

    // Déterminer le type de champ
    if (fieldConfig.relation) {
      // C'est une relation n:1 (manyToOne)
      const relationType = 'manyToOne';
      const relatedTable = fieldConfig.relation;
      const arrayName = fieldConfig.arrayName || fieldName;

      template += `      {{#${fieldName}}}\n`;
      template += `      <div class="row" data-relation="${fieldName}" data-type="${relationType}">\n`;
      template += `        <div class="label">${fieldConfig.label || fieldName}</div>\n`;
      template += `        <div class="value">\n`;

      // Container pour l'objet n:1 avec structure de sub-row
      template += `          <div class="sub-row manyToOne" data-field-table="${relatedTable}">\n`;

      // Afficher les champs du displayField de la table reliée
      const relatedTableSchema = schema.tables[relatedTable];
      if (relatedTableSchema) {
        const displayField = relatedTableSchema.displayField || schema.defaultConfigTable.displayField;
        const displayFields = Array.isArray(displayField) ? displayField : [displayField];

        displayFields.forEach(df => {
          template += `            <span class="display-field">{{${df}}}</span>\n`;
        });
      }

      template += `          </div>\n`;
      template += `        </div>\n`;
      template += `      </div>\n`;
      template += `      {{/${fieldName}}}\n\n`;

    } else {
      // C'est un champ simple
      const fieldType = fieldConfig.type;

      template += `      <div class="row" data-field="${fieldName}" data-type="${fieldType}">\n`;
      template += `        <div class="label">${fieldConfig.label || fieldName}</div>\n`;
      template += `        <div class="value">{{${fieldName}}}</div>\n`;
      template += `      </div>\n\n`;
    }
  }

  // Maintenant, gérer les relations 1:n (oneToMany)
  // Ce sont les relations inverses définies dans d'autres tables qui pointent vers cette table
  const oneToManyRelations = findOneToManyRelations(table);

  for (const relation of oneToManyRelations) {
    const { fromTable, fieldName, arrayName } = relation;

    template += `      {{#${arrayName}}}\n`;
    template += `      <div class="row" data-relation="${arrayName}" data-type="oneToMany">\n`;
    template += `        <div class="label">${arrayName}</div>\n`;
    template += `        <div class="value oneToMany">\n`;

    // Container pour chaque élément du array 1:n
    template += `          {{#.}}\n`;
    template += `          <div class="sub-row" data-table="${fromTable}">\n`;

    // Afficher les champs de la table source
    const fromTableSchema = schema.tables[fromTable];
    if (fromTableSchema) {
      const displayField = fromTableSchema.displayField || schema.defaultConfigTable.displayField;
      const displayFields = Array.isArray(displayField) ? displayField : [displayField];

      displayFields.forEach(df => {
        template += `            <span class="display-field">{{${df}}}</span>\n`;
      });

      // Gérer les relations n:1 dans les éléments 1:n (sub-sub-row)
      for (const [subFieldName, subFieldConfig] of Object.entries(fromTableSchema.fields)) {
        if (subFieldConfig.relation && subFieldConfig.relation !== table) {
          const subRelatedTable = subFieldConfig.relation;

          template += `            {{#${subFieldName}}}\n`;
          template += `            <div class="sub-sub-row manyToOne" data-field-table="${subRelatedTable}">\n`;

          const subRelatedTableSchema = schema.tables[subRelatedTable];
          if (subRelatedTableSchema) {
            const subDisplayField = subRelatedTableSchema.displayField || schema.defaultConfigTable.displayField;
            const subDisplayFields = Array.isArray(subDisplayField) ? subDisplayField : [subDisplayField];

            subDisplayFields.forEach(df => {
              template += `              <span class="display-field">{{${df}}}</span>\n`;
            });
          }

          template += `            </div>\n`;
          template += `            {{/${subFieldName}}}\n`;
        }
      }
    }

    template += `          </div>\n`;
    template += `          {{/.}}\n`;
    template += `        </div>\n`;
    template += `      </div>\n`;
    template += `      {{/${arrayName}}}\n\n`;
  }

  // Fermer les containers
  template += `    </div>\n`;
  template += `  </article>\n`;
  template += `  {{/rows}}\n\n`;
  template += `</div>`;

  return template;
}

/**
 * Trouve toutes les relations 1:n (oneToMany) pour une table donnée
 * en cherchant dans toutes les autres tables qui ont une relation vers celle-ci
 *
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

module.exports = { mustacheAuto, findOneToManyRelations };
