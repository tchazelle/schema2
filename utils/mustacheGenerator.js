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

  // Récupérer la définition de la table depuis le schéma
  const tableConfig = tableName && schema.tables[tableName] ? schema.tables[tableName] : null;

  // Parcourir TOUTES les rows pour collecter tous les champs et relations
  for (const row of dataArray) {
    // 1. Parcourir les propriétés directes de la row
    for (const key in row) {
      // Ignorer les champs spéciaux
      if (shouldIgnoreField(key)) {
        continue;
      }

      const value = row[key];

      // PRIORITÉ 1: Consulter le schéma pour savoir si c'est une relation
      if (tableConfig && tableConfig.fields && tableConfig.fields[key]) {
        const fieldConfig = tableConfig.fields[key];

        // Si c'est un champ de relation dans le schéma
        if (fieldConfig.relation) {
          // Relation n:1
          if (!relationsN1.has(key)) {
            // Si l'objet est déjà chargé dans les données, l'utiliser
            const sampleData = (value && typeof value === 'object' && value._table) ? value : null;
            relationsN1.set(key, {
              tableName: fieldConfig.relation,
              sampleData: sampleData
            });
          }
          continue; // Ne pas ajouter aux fields
        }
      }

      // PRIORITÉ 2: Détecter les relations dans les données
      // Si c'est un tableau (relation 1:n)
      if (Array.isArray(value)) {
        if (!relations1n.has(key)) {
          const relTableName = value.length > 0 && value[0]._table ? value[0]._table : key;
          relations1n.set(key, { tableName: relTableName, sampleData: value });
        }
      }
      // Si c'est un objet avec _table (relation n:1)
      else if (value && typeof value === 'object' && value._table) {
        // C'est une relation n:1 détectée dans les données
        if (!relationsN1.has(key)) {
          relationsN1.set(key, { tableName: value._table, sampleData: value });
        }
        // NE PAS AJOUTER aux fields - c'est une relation !
        // (ajout du continue pour éviter qu'elle soit ajoutée comme field simple)
        continue;
      }
      // Si c'est une valeur simple (et pas une relation selon le schéma)
      else {
        fields.add(key);
      }
    }

    // 2. Parcourir _relations si présent (les relations peuvent être stockées ici par l'API)
    if (row._relations && typeof row._relations === 'object') {
      for (const relKey in row._relations) {
        const relValue = row._relations[relKey];

        // Si c'est un tableau (relation 1:n)
        if (Array.isArray(relValue)) {
          if (!relations1n.has(relKey)) {
            const relTableName = relValue.length > 0 && relValue[0]._table ? relValue[0]._table : relKey;
            relations1n.set(relKey, { tableName: relTableName, sampleData: relValue });
          }
        }
        // Si c'est un objet (relation n:1)
        else if (relValue && typeof relValue === 'object') {
          if (!relationsN1.has(relKey)) {
            const relTableName = relValue._table || relKey;
            relationsN1.set(relKey, { tableName: relTableName, sampleData: relValue });
          }
        }
      }
    }
  }

  // 3. Ajouter les relations n:1 du schéma qui n'ont pas été trouvées dans les données
  if (tableConfig && tableConfig.fields) {
    for (const fieldName in tableConfig.fields) {
      const fieldConfig = tableConfig.fields[fieldName];

      // Si c'est une relation n:1 dans le schéma et qu'elle n'a pas été détectée
      if (fieldConfig.relation && !relationsN1.has(fieldName) && !relations1n.has(fieldName)) {
        relationsN1.set(fieldName, {
          tableName: fieldConfig.relation,
          sampleData: null // Pas de données d'exemple
        });

        // Retirer des fields si elle y était
        fields.delete(fieldName);
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
  let tableName = sectionData.sqlTable || sectionData._table;

  // Si pas de tableName, essayer de le détecter depuis les données
  if (!tableName && sectionData.rows && Array.isArray(sectionData.rows) && sectionData.rows.length > 0) {
    tableName = sectionData.rows[0]._table || sectionSlug;
  }

  let template = `<section class="section {{slug}} table ${tableName || sectionSlug}" data-id="{{id}}" data-table="Section">
    <h2>{{name}}</h2>
    {{#description}}<p class="section-description">{{description}}</p>{{/description}}

    {{#rows}}
      ${generateDataTemplate(sectionData, tableName)}
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
  let innerTemplate;
  let detectedTableName = tableName;

  // Si pas de tableName, essayer de le détecter depuis les données
  if (!detectedTableName && sectionData.rows && Array.isArray(sectionData.rows) && sectionData.rows.length > 0) {
    detectedTableName = sectionData.rows[0]._table;
  }

  // PRIORITÉ 1: Utiliser le schéma si disponible (plus fiable)
  if (detectedTableName && schema.tables[detectedTableName]) {
    innerTemplate = generateTemplateFromSchema(detectedTableName);
  }
  // PRIORITÉ 2: Si on a des exemples de données mais pas de schéma
  else if (sectionData.rows && sectionData.rows.length > 0) {
    // Collecter tous les champs et relations de TOUTES les rows
    const { fields, relations1n, relationsN1 } = collectAllFieldsAndRelations(sectionData.rows, detectedTableName);
    innerTemplate = generateRowTemplateFromCollection(fields, relations1n, relationsN1, detectedTableName);
  }
  // Template minimal par défaut
  else {
    innerTemplate = `{{#.}}
      <div class="card row" data-id="{{id}}">
        {{#name}}<div class="field-label name">{{name}}</div>{{/name}}
        {{#title}}<div class="field-label title">{{title}}</div>{{/title}}
        {{#description}}<div class="field-label description">{{description}}</div>{{/description}}
      </div>
    {{/.}}`;
  }

  // Envelopper dans le conteneur cards rows
  return `<div class="cards rows" data-table="${detectedTableName || 'data'}">
    ${innerTemplate}
  </div>`;
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
    <div class="card row" data-id="{{id}}">`;

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
      template += `\n      {{#${fieldName}}}<div class="field-label ${fieldName}">{{${fieldName}}}</div>{{/${fieldName}}}`;
    }
  }

  // Générer les relations n:1
  for (const [relationName, relationInfo] of relationsN1) {
    template += generateRelationTemplate(relationName, relationInfo.sampleData, 'n:1', relationInfo.tableName);
  }

  // Générer les relations 1:n
  for (const [relationName, relationInfo] of relations1n) {
    template += generateRelationTemplate(relationName, relationInfo.sampleData, '1:n', relationInfo.tableName);
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

  return `\n      {{#${fieldName}}}<div class="field-label ${fieldName}">{{${fieldName}}}</div>{{/${fieldName}}}`;
}

/**
 * Détecte si une table est une table de liaison (junction table)
 * @param {string} tableName - Nom de la table
 * @param {Map} relationsN1 - Map des relations n:1 détectées dans les données
 * @returns {boolean|Object} - false ou { parentRelation, linkedRelations, junctionFields }
 */
function detectJunctionTable(tableName, relationsN1) {
  if (!tableName || !schema.tables[tableName]) {
    return false;
  }

  const tableConfig = schema.tables[tableName];
  const n1Relations = [];

  // Collecter toutes les relations n:1 de la table
  for (const fieldName in tableConfig.fields) {
    const fieldConfig = tableConfig.fields[fieldName];
    if (fieldConfig.relation && fieldName.startsWith('id') && fieldName !== 'id') {
      n1Relations.push({
        fieldName,
        relationTable: fieldConfig.relation,
        relationshipStrength: fieldConfig.relationshipStrength,
        arrayName: fieldConfig.arrayName
      });
    }
  }

  // Une table de liaison a au moins 2 relations n:1
  if (n1Relations.length < 2) {
    return false;
  }

  // Trouver la relation "Strong" (parent) et les autres (linked objects)
  const strongRelation = n1Relations.find(r => r.relationshipStrength === 'Strong');
  const linkedRelations = n1Relations.filter(r => r.relationshipStrength !== 'Strong');

  if (linkedRelations.length === 0) {
    return false;
  }

  // Collecter les champs propres à la jonction (ni foreign keys, ni champs système)
  const junctionFields = [];
  for (const fieldName in tableConfig.fields) {
    if (!shouldIgnoreField(fieldName) &&
        !fieldName.startsWith('id') &&
        fieldName !== 'css' &&
        fieldName !== 'template' &&
        fieldName !== 'mustache') {
      junctionFields.push(fieldName);
    }
  }

  return {
    parentRelation: strongRelation,
    linkedRelations,
    junctionFields
  };
}

/**
 * Génère un template pour une relation
 * @param {string} relationName - Nom de la relation
 * @param {*} relationData - Données de la relation (peut être null si détecté depuis le schéma)
 * @param {string} relationType - Type de relation ('1:n' ou 'n:1')
 * @param {string} targetTableName - Nom de la table cible (optionnel, utilisé si relationData est null)
 * @returns {string} - Template Mustache
 */
function generateRelationTemplate(relationName, relationData, relationType, targetTableName = null) {
  if (relationType === '1:n') {
    // Relation 1:n (tableau)
    const tableClass = Array.isArray(relationData) && relationData.length > 0
      ? relationData[0]._table || relationName
      : (targetTableName || relationName);

    // Collecter tous les champs et relations de toutes les rows de cette relation
    const { fields, relations1n, relationsN1 } = collectAllFieldsAndRelations(relationData || [], tableClass);

    // Vérifier si c'est une table de liaison
    const junctionInfo = detectJunctionTable(tableClass, relationsN1);

    if (junctionInfo) {
      // C'est une table de liaison - générer un template spécial
      return generateJunctionTableTemplate(relationName, junctionInfo, tableClass);
    }

    // Sinon, générer un template standard
    return `\n      {{#${relationName}}}
        <div class="sub-card relation oneToMany ${relationName}">
          ${generateRowTemplateFromCollection(fields, relations1n, relationsN1, tableClass)}
        </div>
      {{/${relationName}}}`;
  } else {
    // Relation n:1 (objet)
    const tableClass = (relationData && relationData._table) || targetTableName || relationName;

    // Générer le template avec tous les champs de la table cible
    let template = `\n      {{#${relationName}}}
        <div class="sub-card relation manyToOne ${relationName}">`;

    // Si on a un schéma pour cette table, utiliser ses champs
    if (tableClass && schema.tables[tableClass]) {
      const tableConfig = schema.tables[tableClass];

      for (const fieldName in tableConfig.fields) {
        const fieldConfig = tableConfig.fields[fieldName];

        // Ignorer les champs spéciaux et les relations
        if (shouldIgnoreField(fieldName) || fieldConfig.relation || fieldName === 'css' || fieldName === 'template' || fieldName === 'mustache') {
          continue;
        }

        // Utiliser le renderer si défini
        const renderer = getFieldRenderer(fieldName, tableClass);
        if (renderer) {
          template += `\n          {{#${fieldName}}}${renderer}{{/${fieldName}}}`;
        } else {
          template += `\n          {{#${fieldName}}}<div class="field-label ${fieldName}">{{${fieldName}}}</div>{{/${fieldName}}}`;
        }
      }
    } else {
      // Fallback : afficher les champs de base
      template += `
          {{#id}}<div class="field-label id">{{id}}</div>{{/id}}
          {{#name}}<div class="field-label name">{{name}}</div>{{/name}}
          {{#description}}<div class="field-label description">{{description}}</div>{{/description}}`;
    }

    template += `
        </div>
      {{/${relationName}}}`;

    return template;
  }
}

/**
 * Génère un template pour une table de liaison (junction table)
 * @param {string} relationName - Nom de la relation
 * @param {Object} junctionInfo - Informations sur la table de liaison
 * @param {string} tableName - Nom de la table de liaison
 * @returns {string} - Template Mustache
 */
function generateJunctionTableTemplate(relationName, junctionInfo, tableName) {
  const { linkedRelations, junctionFields } = junctionInfo;

  let template = `\n      {{#${relationName}}}`;

  // Pour chaque relation liée (généralement 1, mais peut être plusieurs)
  for (const linkedRel of linkedRelations) {
    template += `
        {{#${linkedRel.fieldName}}}
          <div class="sub-card row" data-id="{{id}}">`;

    // Ajouter les champs propres à la jonction (comme position)
    for (const fieldName of junctionFields) {
      const renderer = getFieldRenderer(fieldName, tableName);
      if (renderer) {
        template += `\n            {{#${fieldName}}}${renderer}{{/${fieldName}}}`;
      } else {
        template += `\n            {{#${fieldName}}}<span class="field-label ${fieldName}">{{${fieldName}}}</span>{{/${fieldName}}}`;
      }
    }

    // Ajouter les champs de l'objet lié
    const linkedTableConfig = schema.tables[linkedRel.relationTable];
    if (linkedTableConfig) {
      // Ajouter les champs principaux de l'objet lié
      for (const fieldName in linkedTableConfig.fields) {
        const fieldConfig = linkedTableConfig.fields[fieldName];

        // Ignorer les champs spéciaux et les relations
        if (shouldIgnoreField(fieldName) || fieldConfig.relation || fieldName === 'css' || fieldName === 'template' || fieldName === 'mustache') {
          continue;
        }

        // Utiliser le renderer si défini
        const renderer = getFieldRenderer(fieldName, linkedRel.relationTable);
        if (renderer) {
          template += `\n            {{#${fieldName}}}${renderer}{{/${fieldName}}}`;
        } else {
          template += `\n            {{#${fieldName}}}<span class="field-label ${fieldName}">{{${fieldName}}}</span>{{/${fieldName}}}`;
        }
      }
    }

    template += `
          </div>
        {{/${linkedRel.fieldName}}}`;
  }

  template += `
      {{/${relationName}}}`;

  return template;
}

/**
 * Génère un template à partir du schéma de la table
 * @param {string} tableName - Nom de la table
 * @returns {string} - Template Mustache
 */
function generateTemplateFromSchema(tableName) {
  const tableConfig = schema.tables[tableName];
  if (!tableConfig) {
    return '{{#.}}<div class="card row" data-id="{{id}}">{{.}}</div>{{/.}}';
  }

  // Utiliser le nouveau générateur basé sur le schéma
  const TemplateGenerator = require('./template-generator.js');
  const generator = new TemplateGenerator();

  try {
    // Générer le template complet avec toutes les relations
    const fullTemplate = generator.generateTemplate(tableName, 'section');

    // Extraire juste la partie "rows" (sans le conteneur cards rows)
    // Le template généré est : <div class="cards rows">{{#items}}...{{/items}}</div>
    // On veut juste la partie {{#items}}...{{/items}} mais avec {{#.}}...{{/.}}

    // Parser le template pour extraire le contenu des rows
    const match = fullTemplate.match(/{{#items}}([\s\S]*?){{\/items}}/);
    if (match && match[1]) {
      // Remplacer {{#items}} par {{#.}} pour correspondre à l'ancien format
      return `{{#.}}${match[1]}{{/.}}`;
    }

    // Si le parsing échoue, retourner le template complet
    return fullTemplate;
  } catch (error) {
    console.error('Erreur lors de la génération du template depuis le schéma:', error);

    // Fallback : template minimal
    return `{{#.}}
    <div class="card row" data-id="{{id}}">
      {{#name}}<div class="field-label name">{{name}}</div>{{/name}}
    </div>
  {{/.}}`;
  }
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
