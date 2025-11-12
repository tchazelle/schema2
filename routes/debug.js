const express = require('express');
const router = express.Router();

// Import des sous-modules de debug
const userRoutes = require('./debug/user');
const homeRoutes = require('./debug/home');
const fieldSelectorRoutes = require('./debug/fieldSelector');
const apiRoutes = require('./debug/api');
const templateRoutes = require('./debug/template');

// Montage des routes
router.use('/user', userRoutes);
router.use('/fieldSelector', fieldSelectorRoutes);
router.use('/', apiRoutes);
router.use('/', templateRoutes);
router.use('/', homeRoutes);

module.exports = router;
