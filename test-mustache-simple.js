/**
 * Test simple du générateur de templates Mustache
 * Sans dépendances à la base de données
 */

const schema = require('./schema.js');

// Mock de SchemaService
class SchemaService {
  static getTableConfig(tableName) {
    return schema.tables[tableName];
  }

  static getDisplayFields(tableName) {
    const table = schema.tables[tableName];
    return table?.displayFields || table?.displayField ?
      (Array.isArray(table.displayFields) ? table.displayFields :
       Array.isArray(table.displayField) ? table.displayField :
       [table.displayField || table.displayFields]) :
      ['name'];
  }

  static getTableRelations(user, tableName) {
    const tableConfig = schema.tables[tableName];
    if (!tableConfig) return { relationsN1: {}, relations1N: {} };

    const relationsN1 = {};
    const relations1N = {};

    // Relations n:1 (champs avec relation dans la table actuelle)
    for (const [fieldName, fieldConfig] of Object.entries(tableConfig.fields)) {
      if (fieldConfig.relation) {
        relationsN1[fieldName] = {
          relatedTable: fieldConfig.relation,
          foreignKey: fieldConfig.foreignKey || 'id',
          arrayName: fieldConfig.arrayName
        };
      }
    }

    // Relations 1:n (autres tables qui pointent vers cette table)
    for (const [otherTableName, otherTableConfig] of Object.entries(schema.tables)) {
      for (const [fieldName, fieldConfig] of Object.entries(otherTableConfig.fields)) {
        if (fieldConfig.relation === tableName) {
          const arrayName = fieldConfig.arrayName || otherTableName.toLowerCase() + 's';
          relations1N[arrayName] = {
            relatedTable: otherTableName,
            foreignKey: fieldConfig.foreignKey || 'id',
            fieldName: fieldName
          };
        }
      }
    }

    return { relationsN1, relations1N };
  }
}

// Fonction de génération simplifiée (copie de PageService._generate1NRelationTableTemplate)
function generate1NRelationTableTemplate(arrayName, relationConfig, user, maxDepth = 1, indent = '') {
  const relatedTable = relationConfig.relatedTable;
  const relatedTableConfig = SchemaService.getTableConfig(relatedTable);
  const systemFields = ['ownerId', 'granted', 'createdAt', 'updatedAt'];

  // Récupérer les champs à afficher
  const fields = Object.entries(relatedTableConfig.fields)
    .filter(([fieldName, fieldConfig]) => {
      if (fieldConfig.isPrimary) return false;
      if (fieldConfig.relation) return false;
      if (systemFields.includes(fieldName)) return false;
      return true;
    });

  // Récupérer les relations n:1 si maxDepth > 0
  let nestedRelationsN1 = {};
  if (maxDepth > 0) {
    const relations = SchemaService.getTableRelations(user, relatedTable);
    nestedRelationsN1 = relations.relationsN1 || {};
  }

  let template = `${indent}<div class="relation relation-1n relation-1n-table ${arrayName}">\n`;
  template += `${indent}  <h3>${humanizeFieldName(arrayName)}</h3>\n`;
  template += `${indent}  <table class="relation-table" data-table="${relatedTable}">\n`;

  // En-tête
  template += `${indent}    <thead>\n`;
  template += `${indent}      <tr>\n`;

  for (const [fieldName, fieldConfig] of fields) {
    template += `${indent}        <th data-field="${fieldName}">${humanizeFieldName(fieldName)}</th>\n`;
  }

  for (const [fieldName, relationN1Config] of Object.entries(nestedRelationsN1)) {
    template += `${indent}        <th data-field="${fieldName}" data-relation="n1">${humanizeFieldName(fieldName)}</th>\n`;
  }

  template += `${indent}      </tr>\n`;
  template += `${indent}    </thead>\n`;

  // Corps
  template += `${indent}    <tbody>\n`;
  template += `${indent}      {{#${arrayName}}}\n`;
  template += `${indent}      <tr data-id="{{id}}">\n`;

  for (const [fieldName, fieldConfig] of fields) {
    const renderer = fieldConfig.renderer;
    template += `${indent}        <td data-field="${fieldName}" data-type="${fieldConfig.type || 'varchar'}">\n`;

    if (renderer === 'image') {
      template += `${indent}          {{#${fieldName}}}<img src="{{${fieldName}}}" alt="{{${fieldName}}}" class="table-image" style="max-width: 100px; max-height: 100px;" />{{/${fieldName}}}\n`;
    } else if (renderer === 'url') {
      template += `${indent}          {{#${fieldName}}}<a href="{{${fieldName}}}" target="_blank" rel="noopener">🔗</a>{{/${fieldName}}}\n`;
    } else {
      template += `${indent}          {{${fieldName}}}\n`;
    }

    template += `${indent}        </td>\n`;
  }

  // Cellules pour relations n:1
  for (const [fieldName, relationN1Config] of Object.entries(nestedRelationsN1)) {
    const relTable = relationN1Config.relatedTable;
    const displayFields = SchemaService.getDisplayFields(relTable) || ['name'];

    template += `${indent}        <td data-field="${fieldName}" data-relation="n1">\n`;
    template += `${indent}          {{#${fieldName}}}\n`;

    for (const displayField of displayFields) {
      template += `${indent}            {{${displayField}}}\n`;
    }

    template += `${indent}          {{/${fieldName}}}\n`;
    template += `${indent}        </td>\n`;
  }

  template += `${indent}      </tr>\n`;
  template += `${indent}      {{/${arrayName}}}\n`;
  template += `${indent}    </tbody>\n`;
  template += `${indent}  </table>\n`;
  template += `${indent}</div>\n`;

  return template;
}

function humanizeFieldName(fieldName) {
  return fieldName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^./, str => str.toUpperCase());
}

// Mock user
const mockUser = { id: 1, email: 'admin@test.com', roles: '@dev @admin' };

console.log('='.repeat(80));
console.log('TEST: Génération de template Mustache TABLE pour relation 1:n');
console.log('='.repeat(80));

// Test avec Organization -> member (OrganizationPerson)
const orgRelations = SchemaService.getTableRelations(mockUser, 'Organization');
console.log('\n--- Relations de Organization ---');
console.log('Relations 1:n:', Object.keys(orgRelations.relations1N));

if (orgRelations.relations1N.member) {
  console.log('\n--- Template TABLE pour Organization.member ---\n');
  const template = generate1NRelationTableTemplate(
    'member',
    orgRelations.relations1N.member,
    mockUser,
    2,
    '  '
  );
  console.log(template);
}

// Test avec MusicAlbum -> track (MusicAlbumTrack)
console.log('\n' + '='.repeat(80));
const albumRelations = SchemaService.getTableRelations(mockUser, 'MusicAlbum');
console.log('--- Relations de MusicAlbum ---');
console.log('Relations 1:n:', Object.keys(albumRelations.relations1N));

if (albumRelations.relations1N.track) {
  console.log('\n--- Template TABLE pour MusicAlbum.track ---\n');
  const template = generate1NRelationTableTemplate(
    'track',
    albumRelations.relations1N.track,
    mockUser,
    2,
    '  '
  );
  console.log(template);
}

console.log('\n' + '='.repeat(80));
console.log('Tests terminés !');
console.log('='.repeat(80));
