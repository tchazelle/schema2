const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const schema = require('../schema.js');

const { getTableData } = require('../services/tableDataService');

/**
 * GET /_api/:table
 * Récupère tous les enregistrements d'une table accessibles par l'utilisateur
 * Query params:
 * - limit: nombre maximum de résultats
 * - offset: décalage pour la pagination
 * - orderBy: champ de tri
 * - order: ASC ou DESC
 * - where: clause WHERE personnalisée
 * - relation: liste de relations à inclure (ex: rel1,rel2,rel3) ou "all" pour toutes
 *   Par défaut : inclut toutes les relations n:1 et les relations 1:n "Strong"
 * - schema: si "1", retourne également le schéma filtré de la table
 * - compact: si "1", réduit les relations n:1 à leur version compacte (displayFields uniquement)
 */
router.get('/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const user = req.user;
    const { limit, offset, orderBy, order, where: customWhere, relation, includeSchema, compact, useProxy, noSystemFields, noId} = req.query;
    const response = await getTableData(user, tableName, {id:null, limit, offset, orderBy, order, customWhere, relation, includeSchema, compact, useProxy, noSystemFields, noId})
    res.json(response);

  } catch (error) {
    console.error('Erreur lors de la récupération des données:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération des données',
      details: error.message 
    });
  }
});

router.get('/:tableName/:id', async (req, res) => {
  try {
    const { tableName, id } = req.params;
    const user = req.user;
    const { relation, includeSchema, compact } = req.query;
    const response = await getTableData(user, tableName, {id, relation, includeSchema, compact})
    res.json(response);

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'enregistrement:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération de l\'enregistrement',
      details: error.message
    });
  }
});

module.exports = router;
