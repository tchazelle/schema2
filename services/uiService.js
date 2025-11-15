/**
 * UIService - Service centralisé pour les éléments d'interface utilisateur
 * Consolide les icônes, boutons, messages et templates HTML
 */

class UIService {
  /**
   * =============================================================================
   * ICÔNES
   * =============================================================================
   */
  static icons = {
    // Status
    SUCCESS: '✅',
    ERROR: '❌',
    WARNING: '⚠️',
    INFO: 'ℹ️',
    LOADING: '⏳',

    // Actions
    EDIT: '✏️',
    DELETE: '🗑️',
    ADD: '➕',
    SAVE: '💾',
    CANCEL: '🚫',
    SEARCH: '🔍',
    FILTER: '🔽',
    REFRESH: '🔄',

    // Navigation
    BACK: '←',
    FORWARD: '→',
    UP: '↑',
    DOWN: '↓',
    HOME: '🏠',
    MENU: '☰',

    // Objects
    DOCUMENT: '📋',
    TABLE: '📊',
    FOLDER: '📁',
    FILE: '📄',
    IMAGE: '🖼️',
    USER: '👤',
    USERS: '👥',
    SETTINGS: '⚙️',
    TARGET: '🎯',

    // Other
    LOCK: '🔒',
    UNLOCK: '🔓',
    STAR: '⭐',
    FLAG: '🚩',
    TAG: '🏷️',
    CALENDAR: '📅',
    CLOCK: '🕐',
    LINK: '🔗'
  };

  /**
   * =============================================================================
   * MESSAGES
   * =============================================================================
   */
  static messages = {
    // Errors - General
    ERROR_SERVER: 'Erreur serveur',
    ERROR_UNKNOWN: 'Une erreur est survenue',
    ERROR_NETWORK: 'Erreur réseau',
    ERROR_TIMEOUT: 'La requête a expiré',

    // Errors - Permissions
    ACCESS_DENIED: 'Accès refusé',
    PERMISSION_DENIED: 'Vous n\'avez pas la permission d\'effectuer cette action',
    PERMISSION_READ_DENIED: 'Vous n\'avez pas la permission d\'accéder à cette table',
    PERMISSION_CREATE_DENIED: 'Vous n\'avez pas la permission de créer dans cette table',
    PERMISSION_UPDATE_DENIED: 'Vous n\'avez pas la permission de modifier cet enregistrement',
    PERMISSION_DELETE_DENIED: 'Vous n\'avez pas la permission de supprimer cet enregistrement',

    // Errors - Not Found
    NOT_FOUND: 'Non trouvé',
    TABLE_NOT_FOUND: 'Table non trouvée',
    RECORD_NOT_FOUND: 'Enregistrement non trouvé',
    PAGE_NOT_FOUND: 'Page non trouvée',
    USER_NOT_FOUND: 'Utilisateur non trouvé',

    // Errors - Validation
    VALIDATION_ERROR: 'Erreur de validation',
    REQUIRED_FIELD: 'Ce champ est requis',
    INVALID_FORMAT: 'Format invalide',
    INVALID_EMAIL: 'Adresse email invalide',
    INVALID_DATE: 'Date invalide',
    INVALID_NUMBER: 'Nombre invalide',

    // Errors - Data
    LOADING_ERROR: 'Erreur lors du chargement',
    SAVE_ERROR: 'Erreur lors de la sauvegarde',
    DELETE_ERROR: 'Erreur lors de la suppression',
    UPDATE_ERROR: 'Erreur lors de la mise à jour',
    CREATE_ERROR: 'Erreur lors de la création',

    // Success
    SUCCESS: 'Succès',
    SAVE_SUCCESS: 'Enregistrement sauvegardé avec succès',
    DELETE_SUCCESS: 'Enregistrement supprimé avec succès',
    UPDATE_SUCCESS: 'Enregistrement mis à jour avec succès',
    CREATE_SUCCESS: 'Enregistrement créé avec succès',

    // Actions
    CONFIRM_DELETE: 'Êtes-vous sûr de vouloir supprimer cet enregistrement ?',
    CONFIRM_CANCEL: 'Êtes-vous sûr de vouloir annuler ? Les modifications non sauvegardées seront perdues.',

    // Info
    LOADING: 'Chargement...',
    SAVING: 'Sauvegarde en cours...',
    DELETING: 'Suppression en cours...',
    NO_DATA: 'Aucune donnée disponible',
    NO_RESULTS: 'Aucun résultat trouvé'
  };

  /**
   * =============================================================================
   * TEMPLATES HTML SIMPLES
   * =============================================================================
   */

  /**
   * Génère une page d'erreur HTML simple
   * @param {string} title - Titre de l'erreur
   * @param {string} message - Message d'erreur
   * @param {string} [backLink] - Lien de retour optionnel
   * @returns {string} - HTML de la page d'erreur
   */
  static errorPage(title, message, backLink = null) {
    const backButton = backLink
      ? `<p><a href="${backLink}" style="color: #0066cc; text-decoration: none;">${this.icons.BACK} Retour</a></p>`
      : '';

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <link rel="stylesheet" href="/css/common.css">
  <link rel="stylesheet" href="/css/error-pages.css">
</head>
<body>
  <div class="error-container">
    <h1>${this.icons.ERROR} ${title}</h1>
    <p class="error-message">${message}</p>
    ${backButton}
  </div>
</body>
</html>`;
  }

  /**
   * Génère une page d'erreur 404
   * @param {string} resourceType - Type de ressource (Table, Page, Enregistrement, etc.)
   * @param {string} resourceName - Nom de la ressource
   * @returns {string} - HTML de la page d'erreur
   */
  static error404Page(resourceType, resourceName) {
    return this.errorPage(
      `${resourceType} non trouvée`,
      `La ${resourceType.toLowerCase()} "${resourceName}" n'existe pas.`,
      '/'
    );
  }

  /**
   * Génère une page d'erreur 403
   * @param {string} [message] - Message personnalisé
   * @returns {string} - HTML de la page d'erreur
   */
  static error403Page(message = null) {
    return this.errorPage(
      this.messages.ACCESS_DENIED,
      message || this.messages.PERMISSION_READ_DENIED,
      '/'
    );
  }

  /**
   * Génère une page d'erreur 500
   * @param {Error|string} error - Erreur ou message d'erreur
   * @returns {string} - HTML de la page d'erreur
   */
  static error500Page(error) {
    const message = error instanceof Error ? error.message : error;
    return this.errorPage(
      this.messages.ERROR_SERVER,
      message,
      '/'
    );
  }

  /**
   * =============================================================================
   * RÉPONSES JSON
   * =============================================================================
   */

  /**
   * Génère une réponse JSON d'erreur standardisée
   * @param {string} message - Message d'erreur
   * @param {Object} [details] - Détails supplémentaires
   * @returns {Object} - Objet de réponse JSON
   */
  static jsonError(message, details = {}) {
    return {
      success: false,
      error: message,
      ...details
    };
  }

  /**
   * Génère une réponse JSON de succès standardisée
   * @param {Object} data - Données de la réponse
   * @param {string} [message] - Message de succès optionnel
   * @returns {Object} - Objet de réponse JSON
   */
  static jsonSuccess(data = {}, message = null) {
    const response = {
      success: true,
      ...data
    };
    if (message) {
      response.message = message;
    }
    return response;
  }

  /**
   * =============================================================================
   * BOUTONS ET LIENS
   * =============================================================================
   */

  /**
   * Génère un bouton HTML
   * @param {Object} options - Options du bouton
   * @param {string} options.label - Libellé du bouton
   * @param {string} [options.icon] - Icône du bouton
   * @param {string} [options.type='button'] - Type du bouton (button, submit, reset)
   * @param {string} [options.className=''] - Classes CSS
   * @param {string} [options.id] - ID du bouton
   * @param {string} [options.onclick] - Code JavaScript onclick
   * @param {boolean} [options.disabled=false] - Bouton désactivé
   * @returns {string} - HTML du bouton
   */
  static button({ label, icon = null, type = 'button', className = '', id = '', onclick = '', disabled = false }) {
    const iconHtml = icon ? `${icon} ` : '';
    const idAttr = id ? `id="${id}"` : '';
    const onclickAttr = onclick ? `onclick="${onclick}"` : '';
    const disabledAttr = disabled ? 'disabled' : '';

    return `<button type="${type}" class="${className}" ${idAttr} ${onclickAttr} ${disabledAttr}>
      ${iconHtml}${label}
    </button>`;
  }

  /**
   * Génère un lien HTML
   * @param {Object} options - Options du lien
   * @param {string} options.label - Libellé du lien
   * @param {string} options.href - URL du lien
   * @param {string} [options.icon] - Icône du lien
   * @param {string} [options.className=''] - Classes CSS
   * @param {string} [options.target] - Target du lien (_blank, _self, etc.)
   * @returns {string} - HTML du lien
   */
  static link({ label, href, icon = null, className = '', target = '' }) {
    const iconHtml = icon ? `${icon} ` : '';
    const targetAttr = target ? `target="${target}"` : '';

    return `<a href="${href}" class="${className}" ${targetAttr}>
      ${iconHtml}${label}
    </a>`;
  }

  /**
   * Génère un lien de retour
   * @param {string} href - URL de retour
   * @param {string} [label='Retour'] - Libellé du lien
   * @returns {string} - HTML du lien de retour
   */
  static backLink(href, label = 'Retour') {
    return this.link({
      label,
      href,
      icon: this.icons.BACK,
      className: 'back-link'
    });
  }

  /**
   * =============================================================================
   * ALERTES ET NOTIFICATIONS
   * =============================================================================
   */

  /**
   * Génère une alerte HTML
   * @param {string} type - Type d'alerte (success, error, warning, info)
   * @param {string} message - Message de l'alerte
   * @param {boolean} [dismissible=false] - Alerte fermable
   * @returns {string} - HTML de l'alerte
   */
  static alert(type, message, dismissible = false) {
    const icons = {
      success: this.icons.SUCCESS,
      error: this.icons.ERROR,
      warning: this.icons.WARNING,
      info: this.icons.INFO
    };

    const icon = icons[type] || this.icons.INFO;
    const dismissButton = dismissible
      ? `<button class="alert-dismiss" onclick="this.parentElement.remove()">&times;</button>`
      : '';

    return `<div class="alert alert-${type}">
      <span class="alert-icon">${icon}</span>
      <span class="alert-message">${message}</span>
      ${dismissButton}
    </div>`;
  }

  /**
   * Génère une alerte de succès
   * @param {string} message - Message
   * @param {boolean} [dismissible=true] - Alerte fermable
   * @returns {string} - HTML de l'alerte
   */
  static alertSuccess(message, dismissible = true) {
    return this.alert('success', message, dismissible);
  }

  /**
   * Génère une alerte d'erreur
   * @param {string} message - Message
   * @param {boolean} [dismissible=true] - Alerte fermable
   * @returns {string} - HTML de l'alerte
   */
  static alertError(message, dismissible = true) {
    return this.alert('error', message, dismissible);
  }

  /**
   * Génère une alerte d'avertissement
   * @param {string} message - Message
   * @param {boolean} [dismissible=true] - Alerte fermable
   * @returns {string} - HTML de l'alerte
   */
  static alertWarning(message, dismissible = true) {
    return this.alert('warning', message, dismissible);
  }

  /**
   * Génère une alerte d'information
   * @param {string} message - Message
   * @param {boolean} [dismissible=true] - Alerte fermable
   * @returns {string} - HTML de l'alerte
   */
  static alertInfo(message, dismissible = true) {
    return this.alert('info', message, dismissible);
  }

  /**
   * =============================================================================
   * HELPERS POUR MESSAGES CONTEXTUELS
   * =============================================================================
   */

  /**
   * Génère un message d'erreur pour une table non trouvée
   * @param {string} tableName - Nom de la table
   * @returns {string} - Message d'erreur
   */
  static tableNotFoundMessage(tableName) {
    return `La table "${tableName}" n'existe pas.`;
  }

  /**
   * Génère un message d'erreur pour un enregistrement non trouvé
   * @param {string} tableName - Nom de la table
   * @param {number|string} id - ID de l'enregistrement
   * @returns {string} - Message d'erreur
   */
  static recordNotFoundMessage(tableName, id) {
    return `L'enregistrement #${id} n'existe pas dans la table ${tableName}.`;
  }

  /**
   * Génère un message d'erreur pour un accès refusé à une table
   * @returns {string} - Message d'erreur
   */
  static accessDeniedMessage() {
    return this.messages.PERMISSION_READ_DENIED;
  }
}

module.exports = UIService;
