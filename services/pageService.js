/**
 * Service pour la gestion des pages et sections
 * Extrait la logique métier de routes/pages.js
 */

const pool = require('../config/database');
const schema = require('../schema.js');

const { hasPermission } = require('./permissionService');
const EntityService = require('./entityService');
const TemplateService = require('../services/templateService');
const { getTableData } = require('../services/tableDataService');
const CrudService = require('../services/crudService');
const SchemaService = require('./schemaService');
const mustache = require('mustache');

class PageService {

  static async pagesLoad(user) {
    const pagesFromTablePage = await getTableData(user, schema.menu.page, {resolvedRelations:1});
    return pagesFromTablePage.rows;
  }

  static async buildSectionsAsTableData(user, sections) {
    // Conversion des champs table Section pour getTableData
    const translateTableDataOptions = {
      tableName: 'sqlTable',
      limit: 'sqlLimit',
      orderBy: 'sqlOrderBy',
      customWhere: 'sqlWhere',
      relation: 'apiRelations',
      compact: 'apiCompact',
      includeSchema: 'apiSchema',
      noSystemFields: "apiNoSystemFields",
      noId: "apiNoId",
      presentationType: "presentationType"
    };
    // tarnsforme les section en object pour getTableData
    const newSections = sections.map(section => {
      let tableDataOptions = Object.fromEntries(
        Object.entries(translateTableDataOptions)
          .filter(([newKey, oldKey]) => section[oldKey])
          .map(([newKey, oldKey]) => [newKey, section[oldKey]])
      );
      tableDataOptions.resolvedRelations = 1;
      // DEBUG : ici on a bien les options noId et noSystemFields
      return ({ tableName: tableDataOptions.tableName, tableDataOptions });
    })
      // prépare les query
    const promises = newSections.map(section => {
      const {tableName, tableDataOptions} = section
      return getTableData(user, tableName, tableDataOptions)
    })
    return Promise.all(promises);
  }

  static async pageRender(user, slug, options) {
    const pages = await PageService.pagesLoad(user)
    if(!pages.length) return TemplateService.htmlSitePage({user, pages:[], main: "<h2>Aucune page disponible</h2>"})
    const page = pages.find(page => page.slug == slug);
    if (!page) return {error: "Page non trouvée"}; // [#TC] ici il faudrait déclencher une error 404
    page.user = user // [#TC] options ?
    page.permissions = {
      canEdit: user && EntityService.canPerformAction(user, 'Page', 'update', page),
      canDelete: user && EntityService.canPerformAction(user, 'Page', 'delete', page),
      canAddSection: user && hasPermission(user, 'Section', 'create')
    }
    var main = "vide"
    var data = {}
    if (page.sections?.length) {
      data = await PageService.buildSectionsAsTableData(user, page.sections)
      main = page.sections.map((section, i) => {

        console.log("Generating mustache template for section:", section.slug, "table:", section.sqlTable)
        const mustacheAuto =  this.generateMustacheTemplate(user, section.sqlTable, {
          includeWrapper: true,
          includeSystemFields: section.apiNoSystemFields ? false : true,
          maxDepth: 2
        })
        const mustacheWithRows = "{{#rows}}" + mustacheAuto + "{{/rows}}"
        const html = mustache.render(mustacheWithRows, data[i])

        return html
        return 
        return TemplateService.htmlSectionMustache(section, mustache, data)
      }).join("\n")
    }

    /*
    // traitement des sections si disponibles
    let data = []
    let htmlSections =  (page.css ? `<style>${page.css}</style>`: "")
    // Construction des sections
    if (page.sections?.length) {
      data = await PageService.buildSectionsAsTableData(user, page.sections)
      // Report des rows dans les sections
      const newSectionsWithRows = page.sections.map((section, i) => {
        const { id, slug, name, description, mustache, presentationType } = section;
        const rows = data[i].rows
        const permissions = {
          canEdit: user && EntityService.canPerformAction(user, 'Section', 'update', section),
          canDelete: user && EntityService.canPerformAction(user, 'Section', 'delete', section)
        }
        return { id, slug, name, description , rows, mustache, permissions, presentationType};
      })
      page.sections = Object.fromEntries(newSectionsWithRows.map(s => [s.slug, s])); // transforme en objects [transformer en option]
      htmlSections += newSectionsWithRows.map(section => TemplateService.htmlSection(section))
    }
    const main = options.debug ? TemplateService.htmlDebugJSON(page) : htmlSections
    */
    const accessibleTables = user ? CrudService.getMenuTables(user) : [];
    
    const html = TemplateService.htmlSitePage({user, pages, main, accessibleTables})
    return html
  }

  /**
   * Génère un template Mustache pour une table en se basant sur son schéma
   * Inclut les relations n:1, relations 1:n et relations n:1 imbriquées dans les 1:n
   *
   * @param {string} tableName - Nom de la table
   * @param {Object} user - Utilisateur (pour vérifier les permissions)
   * @param {Object} options - Options de génération
   * @param {boolean} options.includeWrapper - Inclure le wrapper article (default: true)
   * @param {boolean} options.includeSystemFields - Inclure les champs système (default: false)
   * @param {number} options.maxDepth - Profondeur maximale des relations (default: 2)
   * @returns {string|null} - Template Mustache généré ou null si table non trouvée
   */
  static  (user, tableName, options = {}) {
    const {
      includeWrapper = true,
      includeSystemFields = false,
      maxDepth = 2
    } = options;

    // Récupérer la configuration de la table
    const tableConfig = SchemaService.getTableConfig(tableName);
    if (!tableConfig) {
      return null;
    }

    // Récupérer les relations
    const { relationsN1, relations1N } = SchemaService.getTableRelations(user, tableName);

    // Construire le template
    let template = '';

    if (includeWrapper) {
      template += `<article class="row" data-table="${tableName}" data-id="{{id}}">\n`;
      template += `  <h2>{{${SchemaService.getDisplayFields(tableName)?.[0] || 'name'}}}</h2>\n\n`;
    }

    // Ajouter les champs de base (non-relations)
    const baseFieldsTemplate = PageService._generateBaseFieldsTemplate(
      tableConfig.fields,
      includeSystemFields,
      '  '
    );
    template += baseFieldsTemplate;

    // Ajouter les relations n:1
    if (Object.keys(relationsN1).length > 0) {
      template += '\n  <!-- Relations n:1 (Many-to-One) -->\n';
      for (const [fieldName, relationConfig] of Object.entries(relationsN1)) {
        const n1Template = PageService._generateN1RelationTemplate(
          fieldName,
          relationConfig,
          '  '
        );
        template += n1Template;
      }
    }

    // Ajouter les relations 1:n
    if (Object.keys(relations1N).length > 0) {
      template += '\n  <!-- Relations 1:n (One-to-Many) -->\n';
      for (const [arrayName, relationConfig] of Object.entries(relations1N)) {
        const oneNTemplate = PageService._generate1NRelationTemplate(
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

  /**
   * Génère le template pour les champs de base (non-relations)
   * @private
   */
  static _generateBaseFieldsTemplate(fields, includeSystemFields, indent = '') {
    let template = '';
    const systemFields = ['ownerId', 'granted', 'createdAt', 'updatedAt'];

    for (const [fieldName, fieldConfig] of Object.entries(fields)) {
      // Ignorer les relations et les champs système si demandé
      if (fieldConfig.relation) continue;
      if (!includeSystemFields && systemFields.includes(fieldName)) continue;
      if (fieldConfig.isPrimary) continue; // Ignorer l'id (déjà dans data-id)

      const renderer = fieldConfig.renderer;

      if (renderer === 'image') {
        template += `${indent}<div class="field field-image ${fieldName}">\n`;
        template += `${indent}  <label>${PageService._humanizeFieldName(fieldName)}</label>\n`;
        template += `${indent}  {{#${fieldName}}}<img src="{{${fieldName}}}" alt="{{${fieldName}}}" class="image-preview" />{{/${fieldName}}}\n`;
        template += `${indent}</div>\n`;
      } else if (renderer === 'url') {
        template += `${indent}<div class="field field-url ${fieldName}">\n`;
        template += `${indent}  <label>${PageService._humanizeFieldName(fieldName)}</label>\n`;
        template += `${indent}  {{#${fieldName}}}<a href="{{${fieldName}}}" target="_blank" rel="noopener">{{${fieldName}}}</a>{{/${fieldName}}}\n`;
        template += `${indent}</div>\n`;
      } else if (renderer === 'email') {
        template += `${indent}<div class="field field-email ${fieldName}">\n`;
        template += `${indent}  <label>${PageService._humanizeFieldName(fieldName)}</label>\n`;
        template += `${indent}  {{#${fieldName}}}<a href="mailto:{{${fieldName}}}">{{${fieldName}}}</a>{{/${fieldName}}}\n`;
        template += `${indent}</div>\n`;
      } else if (renderer === 'telephone') {
        template += `${indent}<div class="field field-telephone ${fieldName}">\n`;
        template += `${indent}  <label>${PageService._humanizeFieldName(fieldName)}</label>\n`;
        template += `${indent}  {{#${fieldName}}}<a href="tel:{{${fieldName}}}">{{${fieldName}}}</a>{{/${fieldName}}}\n`;
        template += `${indent}</div>\n`;
      } else if (renderer === 'datetime' || renderer === 'date' || renderer === 'time') {
        template += `${indent}<div class="field field-${renderer} ${fieldName}">\n`;
        template += `${indent}  <label>${PageService._humanizeFieldName(fieldName)}</label>\n`;
        template += `${indent}  {{#${fieldName}}}<time datetime="{{${fieldName}}}">{{${fieldName}}}</time>{{/${fieldName}}}\n`;
        template += `${indent}</div>\n`;
      } else if (fieldConfig.type === 'text') {
        template += `${indent}<div class="field field-text ${fieldName}">\n`;
        template += `${indent}  <label>${PageService._humanizeFieldName(fieldName)}</label>\n`;
        template += `${indent}  {{#${fieldName}}}<div class="text-content">{{{${fieldName}}}}</div>{{/${fieldName}}}\n`;
        template += `${indent}</div>\n`;
      } else {
        // Champ simple (varchar, integer, etc.)
        template += `${indent}<div class="field field-simple ${fieldName}">\n`;
        template += `${indent}  <label>${PageService._humanizeFieldName(fieldName)}</label>\n`;
        template += `${indent}  <div class="value">{{${fieldName}}}</div>\n`;
        template += `${indent}</div>\n`;
      }
    }

    return template;
  }

  /**
   * Génère le template pour une relation n:1 (many-to-one)
   * @private
   */
  static _generateN1RelationTemplate(fieldName, relationConfig, indent = '') {
    const relatedTable = relationConfig.relatedTable;
    const relatedTableConfig = SchemaService.getTableConfig(relatedTable);
    const displayFields = SchemaService.getDisplayFields(relatedTable) || ['name'];

    let template = `${indent}{{#${fieldName}}}\n`;
    template += `${indent}<div class="relation relation-n1 ${fieldName}" data-table="${relatedTable}">\n`;
    template += `${indent}  <h3>${PageService._humanizeFieldName(fieldName)}</h3>\n`;

    // Afficher les champs d'affichage de la table liée
    for (const displayField of displayFields) {
      const fieldConfig = relatedTableConfig?.fields?.[displayField];

      if (fieldConfig?.renderer === 'image') {
        template += `${indent}  {{#${displayField}}}<img src="{{${displayField}}}" alt="{{${displayField}}}" class="relation-image" />{{/${displayField}}}\n`;
      } else {
        template += `${indent}  <div class="relation-value">{{${displayField}}}</div>\n`;
      }
    }

    // Ajouter description si elle existe
    if (relatedTableConfig?.fields?.description) {
      template += `${indent}  {{#description}}<div class="relation-description">{{description}}</div>{{/description}}\n`;
    }

    template += `${indent}</div>\n`;
    template += `${indent}{{/${fieldName}}}\n`;

    return template;
  }

  /**
   * Génère le template pour une relation 1:n (one-to-many)
   * Inclut les relations n:1 imbriquées si maxDepth > 0
   * @private
   */
  static _generate1NRelationTemplate(arrayName, relationConfig, user, maxDepth = 1, indent = '') {
    const relatedTable = relationConfig.relatedTable;
    const relatedTableConfig = SchemaService.getTableConfig(relatedTable);

    let template = `${indent}{{#${arrayName}}}\n`;
    template += `${indent}<div class="relation relation-1n ${arrayName}">\n`;
    template += `${indent}  <h3>${PageService._humanizeFieldName(arrayName)}</h3>\n`;
    template += `${indent}  <div class="relation-items">\n`;

    // Afficher les champs de base de la relation
    const baseFieldsTemplate = PageService._generateBaseFieldsTemplate(
      relatedTableConfig.fields,
      false, // Ne pas inclure les champs système
      `${indent}    `
    );
    template += baseFieldsTemplate;

    // Si maxDepth > 0, ajouter les relations n:1 imbriquées
    if (maxDepth > 0) {
      const { relationsN1: nestedRelationsN1 } = SchemaService.getTableRelations(user, relatedTable);

      if (Object.keys(nestedRelationsN1).length > 0) {
        template += `${indent}    <!-- Relations n:1 imbriquées -->\n`;
        for (const [nestedFieldName, nestedRelationConfig] of Object.entries(nestedRelationsN1)) {
          const nestedTemplate = PageService._generateN1RelationTemplate(
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

  /**
   * Convertit un nom de champ en format lisible
   * Ex: "byArtist" -> "By Artist", "recordLabel" -> "Record Label"
   * @private
   */
  static _humanizeFieldName(fieldName) {
    return fieldName
      // Séparer les mots par espaces (camelCase ou PascalCase)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Capitaliser la première lettre
      .replace(/^./, str => str.toUpperCase());
  }

}

module.exports = PageService;
