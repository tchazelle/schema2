const schema = require('../schema.js');

/**
 * Formate une plage de dates (startDate → endDate) de manière compacte
 * selon les propriétés calendar définies dans le schema pour une table
 *
 * @param {string} tableName - Nom de la table
 * @param {Object} row - La ligne de données contenant les dates
 * @returns {string} - Chaîne formatée de la plage de dates
 *
 * Exemples de sorties:
 * - Même jour: "15 janv. 2024 14:30→18:00"
 * - Jours différents: "15 janv. 2024 14:30→16 janv. 2024 10:00"
 */
function formatDateRange(tableName, row) {
  // Vérifier si la table a une configuration calendar
  const tableSchema = schema.tables[tableName];
  if (!tableSchema || !tableSchema.calendar) {
    return null;
  }

  // Récupérer les noms des champs de date depuis la config calendar
  const startDateField = tableSchema.calendar.startDate || 'startDate';
  const endDateField = tableSchema.calendar.endDate || 'endDate';

  // Récupérer les valeurs des dates
  const startDate = row[startDateField];
  const endDate = row[endDateField];

  // Si les dates sont absentes, retourner null
  if (!startDate || !endDate) {
    return null;
  }

  // Convertir en objets Date WITHOUT timezone conversion
  // Parse "YYYY-MM-DD HH:MM:SS" or "YYYY-MM-DDTHH:MM:SS" as LOCAL time
  // IMPORTANT: Using new Date(string) can cause timezone issues
  // We parse the string manually to create a Date in local timezone
  const parseLocalDate = (dateStr) => {
    if (!dateStr) return null;

    // Handle Date objects directly (MySQL2 may return Date objects)
    if (dateStr instanceof Date) {
      return dateStr;
    }

    // Parse string dates
    const dateString = String(dateStr);
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
    if (!match) return null;

    const [, year, month, day, hours, minutes, seconds] = match;
    // Month is 0-indexed in JavaScript Date constructor
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day),
                    parseInt(hours), parseInt(minutes), parseInt(seconds));
  };

  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);

  // Vérifier si les dates sont valides
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
    return null;
  }

  // Récupérer le format local basé sur schema.country
  const locale = getLocaleFromCountry(schema.country);

  // Options de formatage pour la date (sans l'heure)
  const dateOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  };

  // Options de formatage pour l'heure (sans les secondes)
  const timeOptions = {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };

  // Formater les dates et heures
  const startDateStr = start.toLocaleDateString(locale, dateOptions);
  const startTimeStr = start.toLocaleTimeString(locale, timeOptions);
  const endDateStr = end.toLocaleDateString(locale, dateOptions);
  const endTimeStr = end.toLocaleTimeString(locale, timeOptions);

  // Comparer les dates (sans l'heure)
  const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDateOnly = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  // Cas 1: Même jour → "date heure1→heure2"
  if (startDateOnly.getTime() === endDateOnly.getTime()) {
    return `${startDateStr} ${startTimeStr}→${endTimeStr}`;
  }

  // Cas 2: Jours différents → "date1 heure1→date2 heure2"
  return `${startDateStr} ${startTimeStr}→${endDateStr} ${endTimeStr}`;
}

/**
 * Convertit un code pays en locale pour Intl
 * @param {string} country - Code pays (ex: "FR", "US", "DE")
 * @returns {string} - Locale (ex: "fr-FR", "en-US", "de-DE")
 */
function getLocaleFromCountry(country) {
  const localeMap = {
    'FR': 'fr-FR',
    'US': 'en-US',
    'GB': 'en-GB',
    'DE': 'de-DE',
    'ES': 'es-ES',
    'IT': 'it-IT',
    'PT': 'pt-PT',
    'NL': 'nl-NL',
    'BE': 'fr-BE',
    'CH': 'fr-CH',
    'CA': 'fr-CA'
  };

  return localeMap[country?.toUpperCase()] || 'fr-FR'; // Default to French
}

/**
 * Vérifie si une table possède une configuration calendar
 * @param {string} tableName - Nom de la table
 * @returns {boolean} - true si la table a un calendar
 */
function hasCalendar(tableName) {
  const tableSchema = schema.tables[tableName];
  return !!(tableSchema && tableSchema.calendar);
}

/**
 * Récupère la configuration calendar d'une table
 * @param {string} tableName - Nom de la table
 * @returns {Object|null} - Configuration calendar ou null
 */
function getCalendarConfig(tableName) {
  const tableSchema = schema.tables[tableName];
  return tableSchema?.calendar || null;
}

/**
 * Ajoute un champ calculé _dateRange à une row si la table a un calendar
 * @param {string} tableName - Nom de la table
 * @param {Object} row - La ligne de données
 * @returns {Object} - La row enrichie avec _dateRange
 */
function enrichRowWithDateRange(tableName, row) {
  if (!hasCalendar(tableName)) {
    return row;
  }

  const dateRange = formatDateRange(tableName, row);
  if (dateRange) {
    row._dateRange = dateRange;
  }

  return row;
}

module.exports = {
  formatDateRange,
  getLocaleFromCountry,
  hasCalendar,
  getCalendarConfig,
  enrichRowWithDateRange
};
