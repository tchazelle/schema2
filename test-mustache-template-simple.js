/**
 * Script de test simplifié pour la génération de templates Mustache
 * (sans dépendance à la base de données)
 * Usage: node test-mustache-template-simple.js [tableName]
 */

const schema = require('./schema.js');

// Simuler un utilisateur admin pour avoir tous les droits
const adminUser = {
  id: 1,
  roles: '@admin',
  email: 'admin@example.com'
};

// Import minimal de SchemaService
const SchemaService = {
  getTableConfig(tableName) {
    const exactName = this.getTableName(tableName);
    return exactName ? schema.tables[exactName] : null;
  },

  getTableName(tableName) {
    if (schema.tables[tableName]) return tableName;
    const tableNameLower = tableName.toLowerCase();
    for (const key in schema.tables) {
      if (key.toLowerCase() === tableNameLower) return key;
    }
    return null;
  },

  getDisplayFields(tableName) {
    const tableConfig = this.getTableConfig(tableName);
    if (!tableConfig) return null;
    let displayFields = tableConfig.displayFields || tableConfig.displayField;
    if (displayFields && typeof displayFields === 'string') {
      displayFields = [displayFields];
    }
    if (!displayFields && tableConfig.fields && tableConfig.fields.name) {
      displayFields = ["name"];
    }
    return displayFields;
  },

  getTableRelations(user, tableName) {
    const tableConfig = schema.tables[tableName];
    if (!tableConfig) {
      return { relationsN1: {}, relations1N: {} };
    }

    const relationsN1 = {};
    const relations1N = {};

    // Relations n:1
    for (const fieldName in tableConfig.fields) {
      const fieldConfig = tableConfig.fields[fieldName];
      if (fieldConfig.relation) {
        relationsN1[fieldName] = {
          relatedTable: fieldConfig.relation,
          foreignKey: fieldConfig.foreignKey,
          arrayName: fieldConfig.arrayName,
          relationshipStrength: fieldConfig.relationshipStrength
        };
      }
    }

    // Relations 1:n
    for (const otherTableName in schema.tables) {
      const otherTableConfig = schema.tables[otherTableName];
      for (const otherFieldName in otherTableConfig.fields) {
        const otherFieldConfig = otherTableConfig.fields[otherFieldName];
        if (otherFieldConfig.relation === tableName) {
          const relationName = otherFieldConfig.arrayName || otherFieldConfig.relation;
          relations1N[relationName] = {
            relatedTable: otherTableName,
            relatedField: otherFieldName,
            foreignKey: otherFieldConfig.foreignKey,
            relationshipStrength: otherFieldConfig.relationshipStrength,
            defaultSort: otherFieldConfig.defaultSort,
            orderable: otherFieldConfig.orderable,
            relationFieldName: otherFieldName
          };
        }
      }
    }

    return { relationsN1, relations1N };
  }
};

// Fonctions de génération de template
function _humanizeFieldName(fieldName) {
  return fieldName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, str => str.toUpperCase());
}

function _generateBaseFieldsTemplate(fields, includeSystemFields, indent = '') {
  let template = '';
  const systemFields = ['ownerId', 'granted', 'createdAt', 'updatedAt'];

  for (const [fieldName, fieldConfig] of Object.entries(fields)) {
    if (fieldConfig.relation) continue;
    if (!includeSystemFields && systemFields.includes(fieldName)) continue;
    if (fieldConfig.isPrimary) continue;

    const renderer = fieldConfig.renderer;

    if (renderer === 'image') {
      template += `${indent}<div class="field field-image ${fieldName}">\n`;
      template += `${indent}  <label>${_humanizeFieldName(fieldName)}</label>\n`;
      template += `${indent}  {{#${fieldName}}}<img src="{{${fieldName}}}" alt="{{${fieldName}}}" class="image-preview" />{{/${fieldName}}}\n`;
      template += `${indent}</div>\n`;
    } else if (renderer === 'url') {
      template += `${indent}<div class="field field-url ${fieldName}">\n`;
      template += `${indent}  <label>${_humanizeFieldName(fieldName)}</label>\n`;
      template += `${indent}  {{#${fieldName}}}<a href="{{${fieldName}}}" target="_blank" rel="noopener">{{${fieldName}}}</a>{{/${fieldName}}}\n`;
      template += `${indent}</div>\n`;
    } else if (renderer === 'email') {
      template += `${indent}<div class="field field-email ${fieldName}">\n`;
      template += `${indent}  <label>${_humanizeFieldName(fieldName)}</label>\n`;
      template += `${indent}  {{#${fieldName}}}<a href="mailto:{{${fieldName}}}">{{${fieldName}}}</a>{{/${fieldName}}}\n`;
      template += `${indent}</div>\n`;
    } else if (renderer === 'telephone') {
      template += `${indent}<div class="field field-telephone ${fieldName}">\n`;
      template += `${indent}  <label>${_humanizeFieldName(fieldName)}</label>\n`;
      template += `${indent}  {{#${fieldName}}}<a href="tel:{{${fieldName}}}">{{${fieldName}}}</a>{{/${fieldName}}}\n`;
      template += `${indent}</div>\n`;
    } else if (renderer === 'datetime' || renderer === 'date' || renderer === 'time') {
      template += `${indent}<div class="field field-${renderer} ${fieldName}">\n`;
      template += `${indent}  <label>${_humanizeFieldName(fieldName)}</label>\n`;
      template += `${indent}  {{#${fieldName}}}<time datetime="{{${fieldName}}}">{{${fieldName}}}</time>{{/${fieldName}}}\n`;
      template += `${indent}</div>\n`;
    } else if (fieldConfig.type === 'text') {
      template += `${indent}<div class="field field-text ${fieldName}">\n`;
      template += `${indent}  <label>${_humanizeFieldName(fieldName)}</label>\n`;
      template += `${indent}  {{#${fieldName}}}<div class="text-content">{{{${fieldName}}}}</div>{{/${fieldName}}}\n`;
      template += `${indent}</div>\n`;
    } else {
      template += `${indent}<div class="field field-simple ${fieldName}">\n`;
      template += `${indent}  <label>${_humanizeFieldName(fieldName)}</label>\n`;
      template += `${indent}  <div class="value">{{${fieldName}}}</div>\n`;
      template += `${indent}</div>\n`;
    }
  }

  return template;
}

function _generateN1RelationTemplate(fieldName, relationConfig, indent = '') {
  const relatedTable = relationConfig.relatedTable;
  const relatedTableConfig = SchemaService.getTableConfig(relatedTable);
  const displayFields = SchemaService.getDisplayFields(relatedTable) || ['name'];

  let template = `${indent}{{#${fieldName}}}\n`;
  template += `${indent}<div class="relation relation-n1 ${fieldName}" data-table="${relatedTable}">\n`;
  template += `${indent}  <h3>${_humanizeFieldName(fieldName)}</h3>\n`;

  for (const displayField of displayFields) {
    const fieldConfig = relatedTableConfig?.fields?.[displayField];
    if (fieldConfig?.renderer === 'image') {
      template += `${indent}  {{#${displayField}}}<img src="{{${displayField}}}" alt="{{${displayField}}}" class="relation-image" />{{/${displayField}}}\n`;
    } else {
      template += `${indent}  <div class="relation-value">{{${displayField}}}</div>\n`;
    }
  }

  if (relatedTableConfig?.fields?.description) {
    template += `${indent}  {{#description}}<div class="relation-description">{{description}}</div>{{/description}}\n`;
  }

  template += `${indent}</div>\n`;
  template += `${indent}{{/${fieldName}}}\n`;

  return template;
}

function _generate1NRelationTemplate(arrayName, relationConfig, user, maxDepth = 1, indent = '') {
  const relatedTable = relationConfig.relatedTable;
  const relatedTableConfig = SchemaService.getTableConfig(relatedTable);

  let template = `${indent}{{#${arrayName}}}\n`;
  template += `${indent}<div class="relation relation-1n ${arrayName}">\n`;
  template += `${indent}  <h3>${_humanizeFieldName(arrayName)}</h3>\n`;
  template += `${indent}  <div class="relation-items">\n`;

  const baseFieldsTemplate = _generateBaseFieldsTemplate(
    relatedTableConfig.fields,
    false,
    `${indent}    `
  );
  template += baseFieldsTemplate;

  if (maxDepth > 0) {
    const { relationsN1: nestedRelationsN1 } = SchemaService.getTableRelations(user, relatedTable);

    if (Object.keys(nestedRelationsN1).length > 0) {
      template += `${indent}    <!-- Relations n:1 imbriquées -->\n`;
      for (const [nestedFieldName, nestedRelationConfig] of Object.entries(nestedRelationsN1)) {
        const nestedTemplate = _generateN1RelationTemplate(
          nestedFieldName,
          nestedRelationConfig,
          `${indent}    `
        );
        template += nestedTemplate;
      }
    }
  }

  template += `${indent}  </div>\n`;
  template += `${indent}</div>\n`;
  template += `${indent}{{/${arrayName}}}\n`;

  return template;
}

function generateMustacheTemplate(tableName, user, options = {}) {
  const {
    includeWrapper = true,
    includeSystemFields = false,
    maxDepth = 2
  } = options;

  const tableConfig = SchemaService.getTableConfig(tableName);
  if (!tableConfig) {
    return null;
  }

  const { relationsN1, relations1N } = SchemaService.getTableRelations(user, tableName);

  let template = '';

  if (includeWrapper) {
    template += `<article class="row" data-table="${tableName}" data-id="{{id}}">\n`;
    template += `  <h2>{{${SchemaService.getDisplayFields(tableName)?.[0] || 'name'}}}</h2>\n\n`;
  }

  const baseFieldsTemplate = _generateBaseFieldsTemplate(
    tableConfig.fields,
    includeSystemFields,
    '  '
  );
  template += baseFieldsTemplate;

  if (Object.keys(relationsN1).length > 0) {
    template += '\n  <!-- Relations n:1 (Many-to-One) -->\n';
    for (const [fieldName, relationConfig] of Object.entries(relationsN1)) {
      const n1Template = _generateN1RelationTemplate(
        fieldName,
        relationConfig,
        '  '
      );
      template += n1Template;
    }
  }

  if (Object.keys(relations1N).length > 0) {
    template += '\n  <!-- Relations 1:n (One-to-Many) -->\n';
    for (const [arrayName, relationConfig] of Object.entries(relations1N)) {
      const oneNTemplate = _generate1NRelationTemplate(
        arrayName,
        relationConfig,
        user,
        maxDepth - 1,
        '  '
      );
      template += oneNTemplate;
    }
  }

  if (includeWrapper) {
    template += '</article>\n';
  }

  return template;
}

// Main
const tableName = process.argv[2] || 'MusicAlbum';

console.log(`\n=== Génération du template Mustache pour la table: ${tableName} ===\n`);

const template = generateMustacheTemplate(tableName, adminUser);

if (template) {
  console.log(template);
  console.log('\n=== Fin du template ===\n');

  console.log('\n=== Version sans wrapper (pour utilisation dans une section) ===\n');
  const templateNoWrapper = generateMustacheTemplate(tableName, adminUser, {
    includeWrapper: false,
    includeSystemFields: false,
    maxDepth: 2
  });
  console.log(templateNoWrapper);
  console.log('\n=== Fin du template sans wrapper ===\n');

} else {
  console.error(`Erreur: La table "${tableName}" n'a pas été trouvée dans le schéma.`);
  console.log('\nTables disponibles:');
  Object.keys(schema.tables).forEach(table => console.log(`  - ${table}`));
}

console.log('\n=== Exemple d\'utilisation ===');
console.log('Dans votre code:');
console.log('  const PageService = require("./services/pageService");');
console.log('  const template = PageService.generateMustacheTemplate("MusicAlbum", user);');
console.log('\nOptions disponibles:');
console.log('  { includeWrapper: false, includeSystemFields: true, maxDepth: 3 }');
console.log('');
