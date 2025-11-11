/**
 * Générateur automatique de templates Mustache
 *
 * Génère des templates HTML à partir de la structure des données et du schéma
 */

const schema = require('../schema.js');

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

  // Sinon, générer un template automatique
  let template = `<div class="{{slug}}" data-id="{{id}}" data-table="Page">
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
  const sectionClass = tableName ? `${tableName} ${sectionSlug}` : sectionSlug;

  let template = `<section class="${sectionClass}" data-id="{{id}}" data-table="Section">
    <h2>{{name}}</h2>
    {{#description}}<p class="section-description">{{description}}</p>{{/description}}

    {{#data}}
      <div class="section-data">
        ${generateDataTemplate(sectionData, tableName)}
      </div>
    {{/data}}
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
  if (sectionData.data && sectionData.data.length > 0) {
    const firstRow = sectionData.data[0];
    return generateRowTemplate(firstRow, tableName);
  }

  // Sinon, utiliser le schéma si disponible
  if (tableName && schema.tables[tableName]) {
    return generateTemplateFromSchema(tableName);
  }

  // Template minimal par défaut
  return `{{#.}}
      <div class="item" data-id="{{id}}" data-table="${tableName || 'unknown'}">
        {{#name}}<div class="name">{{name}}</div>{{/name}}
        {{#title}}<div class="title">{{title}}</div>{{/title}}
        {{#description}}<div class="description">{{description}}</div>{{/description}}
      </div>
    {{/.}}`;
}

/**
 * Génère un template à partir d'une row de données
 * @param {Object} row - Exemple de row
 * @param {string} tableName - Nom de la table
 * @returns {string} - Template Mustache
 */
function generateRowTemplate(row, tableName) {
  const tableClass = row._table || tableName || 'item';

  let template = `{{#.}}
    <div class="${tableClass}" data-id="{{id}}" data-table="${tableClass}">`;

  // Parcourir les champs de la row
  for (const key in row) {
    // Ignorer les champs spéciaux
    if (shouldIgnoreField(key)) {
      continue;
    }

    // Gérer le champ css
    if (key === 'css') {
      template += `\n      {{#${key}}}<style>{{{${key}}}}</style>{{/${key}}}`;
      continue;
    }

    // Gérer le champ template (pas affiché mais utilisé)
    if (key === 'template') {
      continue;
    }

    const value = row[key];

    // Si c'est un tableau (relation 1:n)
    if (Array.isArray(value)) {
      template += generateRelationTemplate(key, value, '1:n');
    }
    // Si c'est un objet (relation n:1)
    else if (value && typeof value === 'object' && value._table) {
      template += generateRelationTemplate(key, value, 'n:1');
    }
    // Si c'est une valeur simple
    else {
      template += generateFieldTemplate(key, value);
    }
  }

  template += `
    </div>
  {{/.}}`;

  return template;
}

/**
 * Génère un template pour un champ simple
 * @param {string} fieldName - Nom du champ
 * @param {*} value - Valeur du champ
 * @returns {string} - Template Mustache
 */
function generateFieldTemplate(fieldName, value) {
  return `\n      {{#${fieldName}}}<div class="${fieldName}">{{${fieldName}}}</div>{{/${fieldName}}}`;
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

    return `\n      {{#${relationName}}}
        <div class="${relationName}">
          ${generateRowTemplate(Array.isArray(relationData) && relationData[0] || {}, tableClass)}
        </div>
      {{/${relationName}}}`;
  } else {
    // Relation n:1 (objet)
    const tableClass = relationData._table || relationName;

    return `\n      {{#${relationName}}}
        <div class="${relationName}">
          <div class="${tableClass}" data-id="{{id}}" data-table="${tableClass}">
            {{#name}}<span class="name">{{name}}</span>{{/name}}
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
    return '{{#.}}<div>{{.}}</div>{{/.}}';
  }

  let template = `{{#.}}
    <div class="${tableName}" data-id="{{id}}" data-table="${tableName}">`;

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
    if (fieldName === 'template') {
      continue;
    }

    // Si c'est une relation
    if (fieldConfig.relation) {
      const relatedTable = fieldConfig.relation;
      template += `\n      {{#${fieldName}}}
        <div class="${fieldName}">
          <div class="${relatedTable}" data-id="{{id}}" data-table="${relatedTable}">
            {{#name}}<span class="name">{{name}}</span>{{/name}}
          </div>
        </div>
      {{/${fieldName}}}`;
    }
    // Sinon c'est un champ simple
    else {
      template += `\n      {{#${fieldName}}}<div class="${fieldName}">{{${fieldName}}}</div>{{/${fieldName}}}`;
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
