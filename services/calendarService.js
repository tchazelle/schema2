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

        console.log(`[CalendarService] SQL Query: ${query.trim()} [${queryParams.join(', ')}]`);
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
          // Formater les dates pour FullCalendar
          // MySQL retourne les dates au format 'YYYY-MM-DD HH:MM:SS'
          // On les convertit au format ISO 'YYYY-MM-DDTHH:MM:SS' pour que FullCalendar
          // les interprète correctement en heure locale avec timeZone: 'local'
          const formatDateForCalendar = (dateValue) => {
            if (!dateValue) return null;

            // Si c'est déjà un objet Date
            if (dateValue instanceof Date) {
              return dateValue.toISOString().slice(0, 19); // Format ISO sans 'Z'
            }

            // Si c'est une string MySQL (YYYY-MM-DD HH:MM:SS)
            const dateStr = String(dateValue);
            // Remplacer l'espace par 'T' pour obtenir le format ISO local
            return dateStr.replace(' ', 'T');
          };

          const event = {
            id: row.id,
            table: tableName,
            title: this.buildEventTitle(row, tableInfo.displayFields),
            start: formatDateForCalendar(row[startDateField]),
            end: formatDateForCalendar(row[endDateField] || row[startDateField]), // Si pas de endDate, utiliser startDate
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

  /**
   * Met à jour les dates d'un événement après un drag-and-drop
   * @param {Object} user - Utilisateur connecté
   * @param {string} tableName - Nom de la table
   * @param {number} eventId - ID de l'événement
   * @param {string} newStartDate - Nouvelle date de début (ISO format)
   * @param {string} newEndDate - Nouvelle date de fin (ISO format)
   * @returns {Object} - { success, error?, status? }
   */
  static async updateEventDates(user, tableName, eventId, newStartDate, newEndDate) {
    try {
      console.log(`[CalendarService] updateEventDates - Table: ${tableName}, ID: ${eventId}`);

      // Vérifier que la table existe et a une configuration calendar
      const tableConfig = SchemaService.getTableConfig(tableName);
      if (!tableConfig) {
        return { success: false, error: 'Table non trouvée', status: 404 };
      }

      if (!tableConfig.calendar) {
        return { success: false, error: 'Cette table n\'a pas de configuration calendrier', status: 400 };
      }

      // Vérifier les permissions de l'utilisateur sur cette table
      if (!PermissionService.hasPermission(user, tableName, 'update')) {
        return { success: false, error: 'Vous n\'avez pas la permission de modifier cette table', status: 403 };
      }

      // Récupérer l'événement existant
      const query = `SELECT * FROM ${tableName} WHERE id = ?`;
      console.log(`[CalendarService] SQL Query: ${query} [${eventId}]`);
      const [rows] = await pool.query(query, [eventId]);

      if (rows.length === 0) {
        return { success: false, error: 'Événement non trouvé', status: 404 };
      }

      const event = rows[0];

      // Vérifier les permissions au niveau de la row (row-level security)
      const canAccess = await EntityService.canAccessEntity(user, tableName, event);
      if (!canAccess) {
        return { success: false, error: 'Vous n\'avez pas accès à cet événement', status: 403 };
      }

      // Récupérer les noms des champs de date depuis la config calendar
      const calendarConfig = tableConfig.calendar;
      const startDateField = calendarConfig.startDate || 'startDate';
      const endDateField = calendarConfig.endDate || 'endDate';

      // Construire l'objet de mise à jour
      const updates = {};
      updates[startDateField] = newStartDate;
      if (newEndDate) {
        updates[endDateField] = newEndDate;
      }

      // Construire la requête UPDATE
      const setClause = Object.keys(updates).map(field => `${field} = ?`).join(', ');
      const values = Object.values(updates);
      values.push(eventId);

      const updateQuery = `UPDATE ${tableName} SET ${setClause} WHERE id = ?`;
      console.log(`[CalendarService] SQL Query: ${updateQuery} [${values.join(', ')}]`);

      await pool.query(updateQuery, values);

      console.log(`[CalendarService] Événement ${eventId} mis à jour avec succès`);

      return { success: true };

    } catch (error) {
      console.error('[CalendarService] Erreur lors de la mise à jour des dates:', error);
      return { success: false, error: error.message, status: 500 };
    }
  }
}

module.exports = CalendarService;
