/**
 * Générateur automatique de templates Mustache
 *
 * Génère des templates HTML à partir de la structure des données et du schéma
 */

const schema = require('../schema.js');

/**
 * Collecte tous les champs et relations en parcourant toutes les rows
 * @param {Array} dataArray - Tableau de rows
 * @param {string} tableName - Nom de la table
 * @returns {Object} - { fields: Set, relations1n: Map, relationsN1: Map }
 */
function collectAllFieldsAndRelations(dataArray, tableName) {
  const fields = new Set();
  const relations1n = new Map(); // Map<relationName, { tableName, sampleData }>
  const relationsN1 = new Map(); // Map<relationName, { tableName, sampleData }>

  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    return { fields, relations1n, relationsN1 };
  }

  // Parcourir TOUTES les rows pour collecter tous les champs et relations
  for (const row of dataArray) {
    for (const key in row) {
      // Ignorer les champs spéciaux
      if (shouldIgnoreField(key)) {
        continue;
      }

      const value = row[key];

      // Si c'est un tableau (relation 1:n)
      if (Array.isArray(value)) {
        if (!relations1n.has(key)) {
          const relTableName = value.length > 0 && value[0]._table ? value[0]._table : key;
          relations1n.set(key, { tableName: relTableName, sampleData: value });
        }
      }
      // Si c'est un objet (relation n:1)
      else if (value && typeof value === 'object' && value._table) {
        if (!relationsN1.has(key)) {
          relationsN1.set(key, { tableName: value._table, sampleData: value });
        }
      }
      // Si c'est une valeur simple
      else {
        fields.add(key);
      }
    }
  }

  return { fields, relations1n, relationsN1 };
}

/**
 * Obtient le renderer pour un champ donné
 * @param {string} fieldName - Nom du champ
 * @param {string} tableName - Nom de la table
 * @returns {string|null} - Template du renderer ou null
 */
function getFieldRenderer(fieldName, tableName) {
  if (!tableName || !schema.tables[tableName]) {
    return null;
  }

  const tableConfig = schema.tables[tableName];
  const fieldConfig = tableConfig.fields[fieldName];

  if (fieldConfig && fieldConfig.renderer && schema.renderer[fieldConfig.renderer]) {
    // Remplacer {{key}} par le nom du champ et {{value}} par {{fieldName}}
    return schema.renderer[fieldConfig.renderer]
      .replace(/\{\{key\}\}/g, fieldName)
      .replace(/\{\{value\}\}/g, `{{${fieldName}}}`);
  }

  return null;
}

/**
 * Génère un template automatique pour une page
 * @param {Object} pageData - Données de la page
 * @param {Object} sectionsData - Données des sections de la page
 * @returns {string} - Template Mustache généré
 */
function generatePageTemplate(pageData, sectionsData) {
  // Si la page a déjà un mustache, l'utiliser
  if (pageData.mustache && pageData.mustache.trim()) {
    return pageData.mustache;
  }

  // Sinon, générer un template automatique avec la classe page
  let template = `<div class="page {{slug}}" data-id="{{id}}" data-table="Page">
  {{#css}}<style>{{{css}}}</style>{{/css}}
  <h1>{{name}}</h1>
  {{#description}}<p class="description">{{description}}</p>{{/description}}

  {{#section}}`;

  // Générer les sections
  for (const sectionSlug in sectionsData) {
    const section = sectionsData[sectionSlug];
    template += `
    {{#${sectionSlug}}}
      ${generateSectionTemplate(section, sectionSlug)}
    {{/${sectionSlug}}}`;
  }

  template += `
  {{/section}}
</div>`;

  return template;
}

/**
 * Génère un template automatique pour une section
 * @param {Object} sectionData - Données de la section
 * @param {string} sectionSlug - Slug de la section
 * @returns {string} - Template Mustache généré
 */
function generateSectionTemplate(sectionData, sectionSlug) {
  // Si la section a déjà un mustache, l'utiliser
  if (sectionData.mustache && sectionData.mustache.trim()) {
    return sectionData.mustache;
  }

  // Sinon, générer un template automatique
  const tableName = sectionData.sqlTable || sectionData._table;

  let template = `<section class="section {{slug}} table ${tableName || 'unknown'}" data-id="{{id}}" data-table="Section">
    <h2>{{name}}</h2>
    {{#description}}<p class="section-description">{{description}}</p>{{/description}}

    {{#rows}}
      <div class="section-data">
        ${generateDataTemplate(sectionData, tableName)}
      </div>
    {{/rows}}
  </section>`;

  return template;
}

/**
 * Génère un template automatique pour les données d'une section
 * @param {Object} sectionData - Données de la section
 * @param {string} tableName - Nom de la table
 * @returns {string} - Template Mustache pour les données
 */
function generateDataTemplate(sectionData, tableName) {
  // Si on a des exemples de données, analyser leur structure
  if (sectionData.rows && sectionData.rows.length > 0) {
    // Collecter tous les champs et relations de TOUTES les rows
    const { fields, relations1n, relationsN1 } = collectAllFieldsAndRelations(sectionData.rows, tableName);
    return generateRowTemplateFromCollection(fields, relations1n, relationsN1, tableName);
  }

  // Sinon, utiliser le schéma si disponible
  if (tableName && schema.tables[tableName]) {
    return generateTemplateFromSchema(tableName);
  }

  // Template minimal par défaut
  return `{{#.}}
      <div class="row" data-id="{{id}}" data-table="${tableName || 'unknown'}">
        {{#name}}<div class="field name">{{name}}</div>{{/name}}
        {{#title}}<div class="field title">{{title}}</div>{{/title}}
        {{#description}}<div class="field description">{{description}}</div>{{/description}}
      </div>
    {{/.}}`;
}

/**
 * Génère un template à partir d'une collection de champs et relations
 * @param {Set} fields - Ensemble des champs simples
 * @param {Map} relations1n - Map des relations 1:n
 * @param {Map} relationsN1 - Map des relations n:1
 * @param {string} tableName - Nom de la table
 * @returns {string} - Template Mustache
 */
function generateRowTemplateFromCollection(fields, relations1n, relationsN1, tableName) {
  let template = `{{#.}}
    <div class="row" data-id="{{id}}" data-table="${tableName || 'item'}">`;

  // Générer les champs simples
  for (const fieldName of fields) {
    // Gérer le champ css
    if (fieldName === 'css') {
      template += `\n      {{#${fieldName}}}<style>{{{${fieldName}}}}</style>{{/${fieldName}}}`;
      continue;
    }

    // Gérer le champ template
    if (fieldName === 'template' || fieldName === 'mustache') {
      continue;
    }

    // Vérifier si un renderer est défini pour ce champ
    const renderer = getFieldRenderer(fieldName, tableName);
    if (renderer) {
      template += `\n      {{#${fieldName}}}${renderer}{{/${fieldName}}}`;
    } else {
      template += `\n      {{#${fieldName}}}<div class="field ${fieldName}">{{${fieldName}}}</div>{{/${fieldName}}}`;
    }
  }

  // Générer les relations n:1
  for (const [relationName, relationInfo] of relationsN1) {
    template += generateRelationTemplate(relationName, relationInfo.sampleData, 'n:1');
  }

  // Générer les relations 1:n
  for (const [relationName, relationInfo] of relations1n) {
    template += generateRelationTemplate(relationName, relationInfo.sampleData, '1:n');
  }

  template += `
    </div>
  {{/.}}`;

  return template;
}

/**
 * Génère un template à partir d'une row de données (ancienne méthode - conservée pour compatibilité)
 * @param {Object} row - Exemple de row
 * @param {string} tableName - Nom de la table
 * @returns {string} - Template Mustache
 */
function generateRowTemplate(row, tableName) {
  // Utiliser la nouvelle méthode avec collection
  const { fields, relations1n, relationsN1 } = collectAllFieldsAndRelations([row], tableName);
  return generateRowTemplateFromCollection(fields, relations1n, relationsN1, tableName);
}

/**
 * Génère un template pour un champ simple
 * @param {string} fieldName - Nom du champ
 * @param {*} value - Valeur du champ
 * @param {string} tableName - Nom de la table
 * @returns {string} - Template Mustache
 */
function generateFieldTemplate(fieldName, value, tableName = null) {
  // Vérifier si un renderer est défini pour ce champ
  const renderer = getFieldRenderer(fieldName, tableName);
  if (renderer) {
    return `\n      {{#${fieldName}}}${renderer}{{/${fieldName}}}`;
  }

  return `\n      {{#${fieldName}}}<div class="field ${fieldName}">{{${fieldName}}}</div>{{/${fieldName}}}`;
}

/**
 * Génère un template pour une relation
 * @param {string} relationName - Nom de la relation
 * @param {*} relationData - Données de la relation
 * @param {string} relationType - Type de relation ('1:n' ou 'n:1')
 * @returns {string} - Template Mustache
 */
function generateRelationTemplate(relationName, relationData, relationType) {
  if (relationType === '1:n') {
    // Relation 1:n (tableau)
    const tableClass = Array.isArray(relationData) && relationData.length > 0
      ? relationData[0]._table || relationName
      : relationName;

    // Collecter tous les champs et relations de toutes les rows de cette relation
    const { fields, relations1n, relationsN1 } = collectAllFieldsAndRelations(relationData, tableClass);

    return `\n      {{#${relationName}}}
        <div class="relation oneToMany ${relationName}">
          ${generateRowTemplateFromCollection(fields, relations1n, relationsN1, tableClass)}
        </div>
      {{/${relationName}}}`;
  } else {
    // Relation n:1 (objet)
    const tableClass = relationData._table || relationName;

    return `\n      {{#${relationName}}}
        <div class="relation manyToOne ${relationName}">
          <div class="row" data-id="{{id}}" data-table="${tableClass}">
            {{#name}}<span class="field name">{{name}}</span>{{/name}}
          </div>
        </div>
      {{/${relationName}}}`;
  }
}

/**
 * Génère un template à partir du schéma de la table
 * @param {string} tableName - Nom de la table
 * @returns {string} - Template Mustache
 */
function generateTemplateFromSchema(tableName) {
  const tableConfig = schema.tables[tableName];
  if (!tableConfig) {
    return '{{#.}}<div class="row">{{.}}</div>{{/.}}';
  }

  let template = `{{#.}}
    <div class="row" data-id="{{id}}" data-table="${tableName}">`;

  // Parcourir les champs du schéma
  for (const fieldName in tableConfig.fields) {
    const fieldConfig = tableConfig.fields[fieldName];

    // Ignorer les champs spéciaux
    if (shouldIgnoreField(fieldName)) {
      continue;
    }

    // Gérer le champ css
    if (fieldName === 'css') {
      template += `\n      {{#${fieldName}}}<style>{{{${fieldName}}}}</style>{{/${fieldName}}}`;
      continue;
    }

    // Gérer le champ template
    if (fieldName === 'template' || fieldName === 'mustache') {
      continue;
    }

    // Si c'est une relation
    if (fieldConfig.relation) {
      const relatedTable = fieldConfig.relation;
      const arrayName = fieldConfig.arrayName || fieldName;

      // Déterminer si c'est une relation 1:n ou n:1
      // Si le champ est une foreign key (idXXX), c'est une relation n:1
      // Sinon, c'est une relation 1:n (utilisera arrayName)
      const isN1 = fieldName.startsWith('id') && fieldName !== 'id';

      if (isN1) {
        template += `\n      {{#${fieldName}}}
        <div class="relation manyToOne ${fieldName}">
          <div class="row" data-id="{{id}}" data-table="${relatedTable}">
            {{#name}}<span class="field name">{{name}}</span>{{/name}}
          </div>
        </div>
      {{/${fieldName}}}`;
      }
    }
    // Sinon c'est un champ simple
    else {
      // Vérifier si un renderer est défini pour ce champ
      const renderer = getFieldRenderer(fieldName, tableName);
      if (renderer) {
        template += `\n      {{#${fieldName}}}${renderer}{{/${fieldName}}}`;
      } else {
        template += `\n      {{#${fieldName}}}<div class="field ${fieldName}">{{${fieldName}}}</div>{{/${fieldName}}}`;
      }
    }
  }

  // Ajouter les relations 1:n depuis le schéma
  // On les détecte en cherchant les arrayName dans les autres tables
  for (const otherTableName in schema.tables) {
    const otherTable = schema.tables[otherTableName];
    for (const otherFieldName in otherTable.fields) {
      const otherFieldConfig = otherTable.fields[otherFieldName];
      if (otherFieldConfig.relation === tableName && otherFieldConfig.arrayName) {
        const relationName = otherFieldConfig.arrayName;
        template += `\n      {{#${relationName}}}
        <div class="relation oneToMany ${relationName}">
          {{#.}}
            <div class="row" data-id="{{id}}" data-table="${otherTableName}">
              {{#name}}<span class="field name">{{name}}</span>{{/name}}
            </div>
          {{/.}}
        </div>
      {{/${relationName}}}`;
      }
    }
  }

  template += `
    </div>
  {{/.}}`;

  return template;
}

/**
 * Détermine si un champ doit être ignoré dans le template
 * @param {string} fieldName - Nom du champ
 * @returns {boolean} - true si le champ doit être ignoré
 */
function shouldIgnoreField(fieldName) {
  // Ignorer les champs spéciaux
  const ignoredFields = [
    'id',           // Affiché dans data-id
    '_table',       // Affiché dans data-table
    '_relations',   // Champ interne
    'ownerId',      // Champ système
    'granted',      // Champ système
    'createdAt',    // Champ système (peut être affiché si nécessaire)
    'updatedAt'     // Champ système (peut être affiché si nécessaire)
  ];

  return ignoredFields.includes(fieldName);
}

/**
 * Génère un template complet pour une page avec ses sections
 * @param {Object} apiResponse - Réponse de l'API /_api/_page/:page
 * @returns {string} - Template Mustache complet
 */
function generateCompleteTemplate(apiResponse) {
  if (!apiResponse || !apiResponse.page) {
    return '<div>No data</div>';
  }

  const pageData = apiResponse.page;
  const sectionsData = pageData.section || {};

  return generatePageTemplate(pageData, sectionsData);
}

module.exports = {
  generatePageTemplate,
  generateSectionTemplate,
  generateDataTemplate,
  generateRowTemplate,
  generateCompleteTemplate
};
