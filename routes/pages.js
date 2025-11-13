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

router.get('/:slug?', async (req, res, next) => {
  try {
    const user = req.user
    const slug = req.params.slug || 'index';
    html = await PageService.pageRender(user, slug, req.query)
    
    if(typeof html == "object") {
      const err = new Error("Page introuvable");
      err.status = 404; // on ajoute une propriété HTTP personnalisée
      return next(err); // on passe l’erreur au middleware suivant
    }
    
    res.send(html)
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
