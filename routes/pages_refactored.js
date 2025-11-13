const express = require('express');
const mustache = require('mustache');
const router = express.Router();
const pool = require('../config/database');
const { getAccessibleTables, getUserAllRoles, hasPermission } = require('../services/permissionService');
const schema = require('../schema.js');
const { getTableData } = require('../services/tableDataService');
const { mustacheAuto } = require('../utils/mustacheAuto');
const PageService = require('../services/pageService');
const TemplateService = require('../services/templateService');

/**
 * GET /
 * Page d'accueil avec menu du site et menu utilisateur
 */
router.get('/:slug?', async (req, res) => {
  try {
    const slug = req.params.slug || 'index';
    console.log('PAGE ' + slug);
    const user = req.user;
    const isAuthenticated = !!user;

    // Récupérer les informations complètes de l'utilisateur si connecté
    // [#TC] Est-ce sécurisé ? N'importe qui peut ajouter un cookie avec user.id = 1 ou c'est impossible ?
    let fullUser = null;
    if (isAuthenticated) {
      const [users] = await pool.query(
        'SELECT * FROM Person WHERE id = ?', // [#TC] IMPRECISION n'utilise pas les infos schema.user
        [user.id]
      );
      if (users.length > 0) {
        fullUser = users[0];
      }
    }

    // Récupérer tous les rôles de l'utilisateur
    const allRoles = fullUser ? getUserAllRoles(fullUser) : ['public'];

    // Récupérer les tables accessibles
    const accessibleTables = fullUser ? getAccessibleTables(fullUser) : [];

    // Chargement des pages
    const pagesFromTablePage = await getTableData(user, schema.menu.page, {});
    const pages = pagesFromTablePage.rows;

    // Page sélectionnée
    const targetPage = pages.find(page => page.slug == slug);

    if (!targetPage) {
      return res.status(404).send('<h1>Page non trouvée</h1>');
    }

    // Conversion des champs table Section pour getTableData
    const translateTableDataOptions = {
      tableName: 'sqlTable',
      limit: 'sqlLimit',
      orderBy: 'sqlOrderBy',
      customWhere: 'sqlWhere',
      relation: 'apiRelations',
      compact: 'apiCompact',
      includeSchema: 'apiSchema',
      noSystemFields: 'apiNoSystemFields',
      noId: 'apiNoId'
    };

    // Construction des sections
    if (targetPage.sections) {
      const newSections = Object.fromEntries(
        targetPage.sections.map(section => {
          const { id, slug, name, description } = section;
          let tableDataOptions = Object.fromEntries(
            Object.entries(translateTableDataOptions)
              .filter(([newKey, oldKey]) => section[oldKey])
              .map(([newKey, oldKey]) => [newKey, section[oldKey]])
          );
          return [section.slug, { id, slug, name, description, tableDataOptions, sectionUser: user }];
        })
      );

      // Chargement des rows
      const data = await Promise.all(
        Object.values(newSections).map(section => getTableData(section.sectionUser, section.tableDataOptions.tableName, section.tableDataOptions))
      );

      // Report des rows dans les sections
      const newSectionsWithRows = Object.fromEntries(
        Object.entries(newSections).map(([sectionSlug, section], i) => {
          const sectionWithRows = Object.assign(section, data[i]);
          return [sectionSlug, sectionWithRows];
        })
      );
      targetPage.sections = newSectionsWithRows;
    }

    // [#TC] Templates automatiques des sections : ATTENTION intégrer les templates de la bdd si non nuls
    const templateSections = targetPage.sections
      ? Object.entries(targetPage.sections)
          .map(([sectionSlug, section]) => {
            const sectionMustache = `{{#${sectionSlug}}}<section class="section ${sectionSlug}"><h3 class="name">{{name}}</h3><p class="description"></p>${mustacheAuto(
              section.tableDataOptions.tableName
            )} </section>{{/${sectionSlug}}}`;
            return sectionMustache;
          })
          .join('\n')
      : '';

    const templatePage = mustacheAuto('Page'); // [#TC] approximatif, c'est en attendant

    const style = `
    .rows { border: solid 1px purple; margin: 3px; padding :0.5rem}
    .row { border: solid 1px grey; margin: 3px; padding :0.5rem }
    .sub-row { border: dotted 1px grey; margin: 3px; padding :0.5rem }
    .oneToMany { border: dotted 6px grey; margin: 3px; padding :0.5rem }

    [data-relation=track] {  border: dotted 2px blue; color: red }
    .label {font-size:0.8rem; color: grey }
    `;

    let templatePageWithNewSections = templatePage.replace(
      /{{#sections}}[\s\S]*?{{\/sections}}/g,
      `<style>${style}</style>{{#sections}}\n${templateSections}\n{{/sections}}`
    );

    const content = mustache.render(templatePageWithNewSections, { rows: targetPage });

    // Utilisation du service de templates pour générer le HTML complet
    const html = TemplateService.generateHomeHTML({
      user: fullUser,
      pages: pages,
      pageName: slug,
      content: content,
      accessibleTables: accessibleTables,
      allRoles: allRoles,
      isAuthenticated: isAuthenticated
    });

    res.send(html);
  } catch (error) {
    console.error("Erreur lors du chargement de la page d'accueil:", error);
    res.status(500).send('<h1>Erreur serveur</h1>');
  }
});

/**
 * GET /:page (JSON API)
 * Retourne le setup Page-Section de la page si autorisée
 * Inclut la page et ses sections avec toutes leurs configurations
 *
 * Note: Cette route peut entrer en conflit avec /:slug? ci-dessus
 * À fusionner ou différencier avec un préfixe (ex: /_pages/:page)
 */
router.get('/:page', async (req, res) => {
  try {
    const { page: pageSlug } = req.params;
    const user = req.user; // Déjà enrichi par userEnrichMiddleware

    // Utilisation du PageService pour charger la page et ses sections
    const pageData = await PageService.getPageWithSections(pageSlug, user);

    if (!pageData) {
      return res.status(404).json({
        error: 'Page non trouvée ou accès refusé',
        slug: pageSlug
      });
    }

    // Construction de la réponse avec le service
    const response = PageService.buildPageResponse(
      pageData.page,
      pageData.sections,
      user
    );

    res.json(response);
  } catch (error) {
    console.error('Erreur lors de la récupération de la page:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération de la page'
    });
  }
});

module.exports = router;
