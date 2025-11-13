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
      console.log("$$$$$$$$$$$$$ PAGE", slug)
    const result = await PageService.pageRender(user, slug, req.query ? req.query : {}) // ?debug=1
    if (typeof result == "object" && result.error) {
      const err = new Error(result.error);
      err.status = 404; // on ajoute une propriété HTTP personnalisée
      return next(err); // on passe l’erreur au middleware suivant
    }
    res.send(result)
  } catch (error) {
    console.error("Erreur lors du chargement de la page " + req.params.slug, error);
    res.status(500).send('<h1>Erreur serveur</h1>');
  }
});

module.exports = router;
