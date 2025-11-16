/**
 * Service pour la gestion du calendrier
 * Regroupe toutes les tables avec la propriété calendar
 */

const schema = require('../schema.js');
const pool = require('../config/database');
const SchemaService = require('./schemaService');
const PermissionService = require('./permissionService');
const EntityService = require('./entityService');

class CalendarService {
  /**
   * Vérifie si l'utilisateur a accès au calendrier
   * @param {Object} user - Utilisateur connecté
   * @returns {boolean} - true si l'utilisateur a accès
   */
  static hasCalendarAccess(user) {
    if (!schema.calendar || !schema.calendar.granted) {
      return false;
    }

    const userRoles = PermissionService.getUserAllRoles(user);

    // Vérifier si l'utilisateur a au moins le droit "read"
    for (const role of userRoles) {
      const permissions = schema.calendar.granted[role];
      if (permissions && (permissions.includes('read') || permissions.includes('write'))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Récupère toutes les tables qui ont la propriété calendar
   * @returns {Array} - Liste des tables avec leur config calendar
   */
  static getCalendarTables() {
    const calendarTables = [];

    for (const [tableName, tableConfig] of Object.entries(schema.tables)) {
      if (tableConfig.calendar) {
        calendarTables.push({
          name: tableName,
          calendar: tableConfig.calendar,
          displayFields: tableConfig.displayFields || schema.defaultConfigTable.displayFields
        });
      }
    }

    return calendarTables;
  }

  /**
   * Récupère tous les événements du calendrier pour un utilisateur
   * @param {Object} user - Utilisateur connecté
   * @param {Object} options - Options de filtrage { startDate, endDate }
   * @returns {Array} - Liste des événements
   */
  static async getCalendarEvents(user, options = {}) {
    const { startDate, endDate } = options;
    const calendarTables = this.getCalendarTables();
    const allEvents = [];

    for (const tableInfo of calendarTables) {
      const tableName = tableInfo.name;

      // Vérifier si l'utilisateur a accès à cette table
      if (!PermissionService.hasPermission(user, tableName, 'read')) {
        continue;
      }

      const tableConfig = SchemaService.getTableConfig(tableName);
      const calendarConfig = tableInfo.calendar;

      // Construire la requête SQL
      const startDateField = calendarConfig.startDate || 'startDate';
      const endDateField = calendarConfig.endDate || 'endDate';
      const bgColor = calendarConfig.bgColor || '#3788d8';

      let whereClause = '';
      const queryParams = [];

      // Filtrer par dates si spécifié
      // Un événement est visible si :
      // - Il commence pendant la période OU
      // - Il se termine pendant la période OU
      // - Il englobe toute la période
      if (startDate && endDate) {
        // L'événement chevauche la période si :
        // (startDate <= period.end) ET (endDate >= period.start)
        whereClause = `WHERE ${startDateField} <= ? AND (${endDateField} >= ? OR ${endDateField} IS NULL)`;
        queryParams.push(endDate, startDate);
      } else if (startDate) {
        // Événements qui se terminent après startDate
        whereClause = `WHERE ${endDateField} >= ? OR ${endDateField} IS NULL`;
        queryParams.push(startDate);
      } else if (endDate) {
        // Événements qui commencent avant endDate
        whereClause = `WHERE ${startDateField} <= ?`;
        queryParams.push(endDate);
      }

      try {
        // Récupérer les données
        const query = `
          SELECT * FROM ${tableName}
          ${whereClause}
          ORDER BY ${startDateField} ASC
        `;

        const [rows] = await pool.query(query, queryParams);

        // Filtrer les rows selon les permissions (row-level security)
        const accessibleRows = [];
        for (const row of rows) {
          const canAccess = await EntityService.canAccessEntity(user, tableName, row);
          if (canAccess) {
            accessibleRows.push(row);
          }
        }

        // Transformer les rows en événements calendrier
        for (const row of accessibleRows) {
          const event = {
            id: row.id,
            table: tableName,
            title: this.buildEventTitle(row, tableInfo.displayFields),
            start: row[startDateField],
            end: row[endDateField] || row[startDateField], // Si pas de endDate, utiliser startDate
            backgroundColor: bgColor,
            borderColor: bgColor,
            url: `/_crud/${tableName}/${row.id}`,
            extendedProps: {
              table: tableName,
              row: row,
              displayFields: tableInfo.displayFields
            }
          };

          allEvents.push(event);
        }
      } catch (error) {
        console.error(`[CalendarService] Erreur lors de la récupération des événements de ${tableName}:`, error);
        // Continuer avec les autres tables
      }
    }

    return allEvents;
  }

  /**
   * Construit le titre d'un événement à partir des displayFields
   * @param {Object} row - Ligne de données
   * @param {Array} displayFields - Champs à afficher
   * @returns {string} - Titre de l'événement
   */
  static buildEventTitle(row, displayFields) {
    if (!displayFields || displayFields.length === 0) {
      return row.name || row.id || 'Sans titre';
    }

    const parts = displayFields.map(field => row[field]).filter(Boolean);
    return parts.join(' ') || row.id || 'Sans titre';
  }

  /**
   * Récupère les statistiques du calendrier
   * @param {Object} user - Utilisateur connecté
   * @returns {Object} - Statistiques
   */
  static async getCalendarStats(user) {
    const calendarTables = this.getCalendarTables();
    const stats = {
      totalTables: calendarTables.length,
      accessibleTables: 0,
      totalEvents: 0
    };

    for (const tableInfo of calendarTables) {
      const tableName = tableInfo.name;

      if (PermissionService.hasPermission(user, tableName, 'read')) {
        stats.accessibleTables++;
      }
    }

    // Compter le nombre total d'événements
    const events = await this.getCalendarEvents(user);
    stats.totalEvents = events.length;

    return stats;
  }
}

module.exports = CalendarService;
