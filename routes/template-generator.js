const express = require('express');
const router = express.Router();
const generateSimpleTemplate = require('../utils/simple-template-generator');
const schema = require('../schema.js');

/**
 * GET /_api/template-generator/tables
 * Retourne la liste de toutes les tables disponibles
 */
router.get('/tables', (req, res) => {
  try {
    const tables = Object.keys(schema.tables);
    res.json(tables);
  } catch (error) {
    console.error('Erreur lors de la récupération des tables:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /_api/template-generator/:tableName
 * Génère un template Mustache pour une table donnée
 */
router.get('/:tableName', (req, res) => {
  try {
    const { tableName } = req.params;
    const template = generateSimpleTemplate(tableName);

    res.json({
      tableName,
      template,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erreur lors de la génération du template:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
