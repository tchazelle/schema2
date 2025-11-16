const express = require('express');
const router = express.Router();
const CalendarService = require('../services/calendarService');
const TemplateService = require('../services/templateService');
const UIService = require('../services/uiService');

/**
 * GET /_calendar/events
 * API pour récupérer les événements du calendrier (format JSON)
 * IMPORTANT: Cette route doit être AVANT les routes avec paramètres /:year
 */
router.get('/events', async (req, res) => {
  try {
    const user = req.user;

    // Vérifier si l'utilisateur a accès au calendrier
    if (!CalendarService.hasCalendarAccess(user)) {
      return res.status(403).json(UIService.jsonError('Accès au calendrier non autorisé'));
    }

    // Récupérer les paramètres de filtrage
    const { start, end } = req.query;

    const options = {};
    if (start) options.startDate = start;
    if (end) options.endDate = end;

    // Récupérer les événements
    const events = await CalendarService.getCalendarEvents(user, options);

    res.json(events);

  } catch (error) {
    console.error('Erreur lors de la récupération des événements:', error);
    res.status(500).json(UIService.jsonError('Erreur serveur lors de la récupération des événements'));
  }
});

/**
 * GET /_calendar/stats
 * Retourne les statistiques du calendrier
 */
router.get('/stats', async (req, res) => {
  try {
    const user = req.user;

    // Vérifier si l'utilisateur a accès au calendrier
    if (!CalendarService.hasCalendarAccess(user)) {
      return res.status(403).json(UIService.jsonError('Accès au calendrier non autorisé'));
    }

    const stats = await CalendarService.getCalendarStats(user);

    res.json(UIService.jsonSuccess(stats));

  } catch (error) {
    console.error('Erreur lors de la récupération des statistiques:', error);
    res.status(500).json(UIService.jsonError('Erreur serveur lors de la récupération des statistiques'));
  }
});

/**
 * GET /_calendar/tables
 * Retourne la liste des tables accessibles pour la création d'événements
 */
router.get('/tables', async (req, res) => {
  try {
    const user = req.user;

    // Vérifier si l'utilisateur a accès au calendrier
    if (!CalendarService.hasCalendarAccess(user)) {
      console.log('[Calendar] User has no calendar access:', user ? user.id : 'anonymous');
      return res.status(403).json(UIService.jsonError('Accès au calendrier non autorisé'));
    }

    const PermissionService = require('../services/permissionService');
    const calendarTables = CalendarService.getCalendarTables();
    console.log('[Calendar] All calendar tables:', calendarTables.map(t => t.name));

    // Filtrer les tables où l'utilisateur a le droit de créer
    const creatableTables = calendarTables.filter(tableInfo => {
      const hasCreatePerm = PermissionService.hasPermission(user, tableInfo.name, 'create');
      console.log(`[Calendar] User ${user ? user.id : 'anonymous'} create permission for ${tableInfo.name}:`, hasCreatePerm);
      return hasCreatePerm;
    });

    console.log('[Calendar] Creatable tables for user:', creatableTables.map(t => t.name));
    res.json(UIService.jsonSuccess(creatableTables));

  } catch (error) {
    console.error('Erreur lors de la récupération des tables:', error);
    res.status(500).json(UIService.jsonError('Erreur serveur lors de la récupération des tables'));
  }
});

/**
 * GET /_calendar
 * GET /_calendar/:year
 * GET /_calendar/:year/:month
 * GET /_calendar/:year/:month/:day
 * Affiche le calendrier avec tous les événements accessibles par l'utilisateur
 * Les paramètres year, month, day sont optionnels et permettent de naviguer vers une date spécifique
 * IMPORTANT: Cette route doit être APRÈS les routes spécifiques (/events, /stats, /tables)
 */
router.get(['/', '/:year', '/:year/:month', '/:year/:month/:day'], async (req, res) => {
  try {
    const user = req.user;
    const { year, month, day } = req.params;

    // Vérifier si l'utilisateur a accès au calendrier
    if (!CalendarService.hasCalendarAccess(user)) {
      return res.status(403).json(UIService.jsonError('Accès au calendrier non autorisé'));
    }

    // Construire la date initiale si des paramètres sont fournis
    let initialDate = null;
    if (year) {
      const y = parseInt(year);
      const m = month ? parseInt(month) - 1 : 0; // Mois en JS commence à 0
      const d = day ? parseInt(day) : 1;

      // Valider la date
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        initialDate = new Date(y, m, d);
        if (isNaN(initialDate.getTime())) {
          initialDate = null; // Date invalide
        }
      }
    }

    // Si le paramètre ?json=1 est présent, retourner du JSON
    if (req.query.json === '1') {
      const events = await CalendarService.getCalendarEvents(user);
      const stats = await CalendarService.getCalendarStats(user);

      return res.json(UIService.jsonSuccess({
        events,
        stats,
        tables: CalendarService.getCalendarTables(),
        initialDate: initialDate ? initialDate.toISOString() : null
      }));
    }

    // Sinon, afficher la page HTML du calendrier
    const html = TemplateService.htmlCalendar(user, initialDate);
    res.send(html);

  } catch (error) {
    console.error('Erreur lors de l\'affichage du calendrier:', error);
    res.status(500).json(UIService.jsonError('Erreur serveur lors de l\'affichage du calendrier'));
  }
});

module.exports = router;
