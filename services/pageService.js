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
    var main = "<style>img {max-width: 50%; height: auto;}</style>"
    var data = {}
    if (page.sections?.length) {
      data = await PageService.buildSectionsAsTableData(user, page.sections)
      main += page.sections.map((section, i) => {

        console.log("Generating mustache template for section:", section.slug, "table:", section.sqlTable)
        const mustacheAuto =  TemplateService.generateMustacheTemplate(section.sqlTable, user, {
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

}

module.exports = PageService;
