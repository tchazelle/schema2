const schema = require('../schema.js');

/**
 * Générateur automatique de templates Mustache à partir du schéma
 * Génère un template avec les relations N:1, 1:N et N:1 des 1:N
 */
class TemplateGenerator {
  constructor() {
    this.schema = schema;
  }

  /**
   * Trouve toutes les relations 1:N pour une table donnée
   * @param {string} tableName - Nom de la table
   * @returns {Array} Liste des relations 1:N avec leurs informations
   */
  findOneToManyRelations(tableName) {
    const relations = [];

    // Parcourir toutes les tables du schéma
    for (const [otherTableName, otherTableDef] of Object.entries(this.schema.tables)) {
      if (!otherTableDef.fields) continue;

      // Parcourir les fields de chaque table
      for (const [fieldName, fieldDef] of Object.entries(otherTableDef.fields)) {
        // Si ce field pointe vers notre table
        if (fieldDef.relation === tableName && fieldDef.arrayName) {
          relations.push({
            tableName: otherTableName,
            fieldName: fieldName,
            arrayName: fieldDef.arrayName,
            relationshipStrength: fieldDef.relationshipStrength || 'Weak',
            defaultSort: fieldDef.defaultSort
          });
        }
      }
    }

    return relations;
  }

  /**
   * Trouve toutes les relations N:1 pour une table donnée
   * @param {string} tableName - Nom de la table
   * @returns {Array} Liste des relations N:1 avec leurs informations
   */
  findManyToOneRelations(tableName) {
    const tableDef = this.schema.tables[tableName];
    if (!tableDef || !tableDef.fields) return [];

    const relations = [];

    for (const [fieldName, fieldDef] of Object.entries(tableDef.fields)) {
      if (fieldDef.relation) {
        relations.push({
          fieldName: fieldName,
          targetTable: fieldDef.relation,
          foreignKey: fieldDef.foreignKey,
          arrayName: fieldDef.arrayName,
          relationshipStrength: fieldDef.relationshipStrength || 'Weak',
          label: fieldDef.label || fieldName
        });
      }
    }

    return relations;
  }

  /**
   * Génère le HTML pour un field en utilisant le renderer si disponible
   * @param {string} fieldName - Nom du field
   * @param {object} fieldDef - Définition du field
   * @returns {string} HTML du field
   */
  generateFieldHTML(fieldName, fieldDef) {
    // Ne pas afficher les fields de relation (ils seront affichés dans les sections de relation)
    if (fieldDef.relation) return '';

    // Ne pas afficher les commonFields sauf si nécessaire
    if (['ownerId', 'granted', 'createdAt', 'updatedAt'].includes(fieldName)) return '';

    // Ne pas afficher les champs calculés SQL (as) ou JavaScript (calculate)
    if (fieldDef.as || fieldDef.calculate) return '';

    const label = fieldDef.label || fieldName;
    let valueHTML;

    if (fieldDef.renderer && this.schema.renderer[fieldDef.renderer]) {
      // Utiliser le renderer personnalisé et corriger les classes
      const rendererTemplate = this.schema.renderer[fieldDef.renderer];
      valueHTML = rendererTemplate
        .replace(/class='field-label/g, "class='field-value")
        .replace(/\{\{key\}\}/g, fieldName)
        .replace(/\{\{value\}\}/g, `{{${fieldName}}}`);
    } else if (fieldDef.type === 'boolean') {
      // Boolean avec renderer par défaut
      if (this.schema.renderer.boolean) {
        valueHTML = this.schema.renderer.boolean
          .replace(/class='field-label/g, "class='field-value")
          .replace(/\{\{key\}\}/g, fieldName)
          .replace(/\{\{value\}\}/g, fieldName);
      } else {
        valueHTML = `<div class="field-value ${fieldName}">{{${fieldName}}}</div>`;
      }
    } else {
      // Field standard
      valueHTML = `<div class="field-value ${fieldName}">{{${fieldName}}}</div>`;
    }

    // Format rigoureux : {{#field}} <div data-field> <div class="label"> <div class="value">
    return `    {{#${fieldName}}}\n    <div data-field="${fieldName}">\n      <div class="label">${label}</div>\n      <div class="value">{{${fieldName}}}</div>\n    </div>\n    {{/${fieldName}}}\n`;
  }

  /**
   * Génère le template pour une relation N:1 (Many-to-One)
   * @param {object} relation - Information sur la relation
   * @param {string} indent - Indentation
   * @param {boolean} isNested - Si true, c'est une relation N:1 d'une relation 1:N
   * @returns {string} HTML du template de relation
   */
  generateManyToOneTemplate(relation, indent = '    ', isNested = false) {
    const targetTableDef = this.schema.tables[relation.targetTable];
    if (!targetTableDef || !targetTableDef.fields) return '';

    // Format rigoureux avec wrapper + label + relation
    let template = `${indent}<div data-field="${relation.fieldName}">\n`;
    template += `${indent}  <div class="label">${relation.label}</div>\n`;
    template += `${indent}  <div data-field="${relation.fieldName}" class="relation manyToOne" data-relation="${relation.targetTable}">\n`;
    template += `${indent}  {{#${relation.fieldName}}}\n`;

    // Afficher les fields de la table cible (déjà avec conditions via generateFieldHTML)
    for (const [fieldName, fieldDef] of Object.entries(targetTableDef.fields)) {
      const fieldHTML = this.generateFieldHTML(fieldName, fieldDef);
      if (fieldHTML) {
        template += fieldHTML.split('\n').map(line => `${indent}    ${line}`).join('\n') + '\n';
      }
    }

    template += `${indent}  {{/${relation.fieldName}}}\n`;
    template += `${indent}  </div>\n`;
    template += `${indent}</div>\n`;

    return template;
  }

  /**
   * Génère le template pour une relation 1:N (One-to-Many)
   * @param {object} relation - Information sur la relation
   * @returns {string} HTML du template de relation
   */
  generateOneToManyTemplate(relation) {
    const relatedTableDef = this.schema.tables[relation.tableName];
    if (!relatedTableDef || !relatedTableDef.fields) return '';

    let template = `    {{#${relation.arrayName}}}\n`;
    template += `    <div class="sub-card relation oneToMany ${relation.arrayName}">\n`;
    template += `      <h4>${relation.arrayName}</h4>\n`;
    template += `      <div class="row" data-id="{{id}}">\n`;

    // Afficher les fields de la table liée
    for (const [fieldName, fieldDef] of Object.entries(relatedTableDef.fields)) {
      // Ne pas afficher le field de relation vers la table parent
      if (fieldDef.relation && fieldName === relation.fieldName) continue;

      // Si c'est une relation N:1 dans la relation 1:N
      if (fieldDef.relation) {
        const subRelation = {
          fieldName: fieldName,
          targetTable: fieldDef.relation,
          label: fieldDef.label || fieldName
        };
        template += this.generateManyToOneTemplate(subRelation, '        ', true);
      } else {
        const fieldHTML = this.generateFieldHTML(fieldName, fieldDef);
        if (fieldHTML) {
          template += fieldHTML.split('\n').map(line => `        ${line}`).join('\n') + '\n';
        }
      }
    }

    template += `      </div>\n`;
    template += `    </div>\n`;
    template += `    {{/${relation.arrayName}}}\n`;

    return template;
  }

  /**
   * Génère un template complet pour une table
   * @param {string} tableName - Nom de la table
   * @param {string} context - Contexte ('page' ou 'section')
   * @returns {string} Template Mustache complet
   */
  generateTemplate(tableName, context = 'section') {
    const tableDef = this.schema.tables[tableName];
    if (!tableDef || !tableDef.fields) {
      throw new Error(`Table ${tableName} introuvable dans le schéma`);
    }

    let template = '';

    if (context === 'page') {
      template += `<div class="page {{slug}}" data-id="{{id}}" data-table="Page">\n`;
      template += `  <h1>{{name}}</h1>\n`;
      template += `  <p>{{description}}</p>\n\n`;
      template += `  {{#sections}}\n`;
      template += `  <section class="section {{slug}}" data-id="{{id}}" data-table="Section">\n`;
      template += `    <h2>{{name}}</h2>\n`;
      template += `    <p>{{description}}</p>\n\n`;
    }

    // Container principal pour les rows
    template += `<div class="rows" data-table="${tableName}">\n`;
    template += `{{#rows}}\n`;
    template += `  <article class="row" data-id="{{id}}">\n`;

    // Afficher tous les fields normaux
    for (const [fieldName, fieldDef] of Object.entries(tableDef.fields)) {
      // Ne pas afficher les relations ici (elles seront affichées après)
      if (fieldDef.relation) continue;

      const fieldHTML = this.generateFieldHTML(fieldName, fieldDef);
      if (fieldHTML) {
        template += fieldHTML.split('\n').map(line => `    ${line}`).join('\n') + '\n';
      }
    }

    // Ajouter les relations N:1 (Many-to-One)
    const manyToOneRelations = this.findManyToOneRelations(tableName);
    for (const relation of manyToOneRelations) {
      template += '\n' + this.generateManyToOneTemplate(relation);
    }

    // Ajouter les relations 1:N (One-to-Many)
    const oneToManyRelations = this.findOneToManyRelations(tableName);
    for (const relation of oneToManyRelations) {
      template += '\n' + this.generateOneToManyTemplate(relation);
    }

    template += `  </article>\n`;
    template += `{{/rows}}\n`;
    template += `</div>\n`;

    if (context === 'page') {
      template += `  </section>\n`;
      template += `  {{/sections}}\n`;
      template += `</div>\n`;
    }

    return template;
  }
}

module.exports = TemplateGenerator;
