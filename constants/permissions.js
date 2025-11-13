/**
 * Constantes pour le système de permissions
 * Centralise toutes les valeurs utilisées dans l'application
 */

/**
 * Actions CRUD disponibles dans l'application
 * @type {Array<string>}
 */
const PERMISSION_ACTIONS = ['read', 'create', 'update', 'delete', 'publish'];

/**
 * Valeurs possibles pour le champ granted
 * @type {Object}
 */
const GRANTED_VALUES = {
  DRAFT: 'draft',
  SHARED: 'shared',
  PUBLISHED_PREFIX: 'published @',
  EMPTY: '',
  NULL: null
};

/**
 * Rôle par défaut pour les utilisateurs non authentifiés
 * @type {string}
 */
const DEFAULT_PUBLIC_ROLE = 'public';

/**
 * Vérifie si une valeur granted est de type "published @role"
 * @param {string} grantedValue - La valeur du champ granted
 * @returns {boolean} - true si c'est un granted de type "published @role"
 */
function isPublishedRole(grantedValue) {
  return grantedValue && grantedValue.startsWith(GRANTED_VALUES.PUBLISHED_PREFIX);
}

/**
 * Extrait le rôle d'une valeur granted "published @role"
 * @param {string} grantedValue - La valeur du champ granted
 * @returns {string|null} - Le nom du rôle ou null
 */
function extractRoleFromGranted(grantedValue) {
  if (!isPublishedRole(grantedValue)) {
    return null;
  }
  return grantedValue.replace(GRANTED_VALUES.PUBLISHED_PREFIX, '');
}

module.exports = {
  PERMISSION_ACTIONS,
  GRANTED_VALUES,
  DEFAULT_PUBLIC_ROLE,
  isPublishedRole,
  extractRoleFromGranted
};
