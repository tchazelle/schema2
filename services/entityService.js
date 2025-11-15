/**
 * Service unifié pour l'accès aux entités (Row/Page/Section/etc)
 * Élimine la duplication entre canAccessRow(), canAccessPage() et canAccessSection()
 */

const { hasPermission, getUserAllRoles } = require('./permissionService');
const SchemaService = require('./schemaService');
const { GRANTED_VALUES, isPublishedRole, extractRoleFromGranted } = require('../constants/permissions');

class EntityService {
  /**
   * Vérifie si un utilisateur peut accéder à une entité selon son granted
   * FONCTION UNIFIÉE qui remplace :
   * - canAccessRow() dans utils/apiTables.js:87
   * - canAccessPage() dans routes/pages.js:776
   * - canAccessSection() dans routes/pages.js:808
   *
   * @param {Object} user - L'utilisateur
   * @param {string} tableName - Nom de la table de l'entité
   * @param {Object} entity - L'entité avec son champ granted (et éventuellement ownerId)
   * @returns {boolean} - true si accessible
   */
  static canAccessEntity(user, tableName, entity) {
    // Si pas de granted, l'entité est publique
    if (!entity.granted) {
      return true;
    }

    const userRoles = getUserAllRoles(user);

    // Si granted = 'draft', seul le propriétaire peut lire
    if (entity.granted === GRANTED_VALUES.DRAFT) {
      if (!user || entity.ownerId !== user.id) {
        return false;
      }
      return true;
    }

    // Si granted = 'shared', vérifier les permissions de la table
    if (entity.granted === GRANTED_VALUES.SHARED) {
      if (!hasPermission(user, tableName, 'read')) {
        return false;
      }
      return true;
    }

    // Si granted = 'published @role', vérifier le rôle
    if (isPublishedRole(entity.granted)) {
      const requiredRole = extractRoleFromGranted(entity.granted);
      if (!userRoles.includes(requiredRole)) {
        return false;
      }
      return true;
    }

    // Autres valeurs de granted : accessible par défaut
    return true;
  }

  /**
   * Filtre les champs d'une entité selon les permissions de l'utilisateur
   * Déplacé de apiTables.js:124
   *
   * @param {Object} user - L'utilisateur
   * @param {string} tableName - Nom de la table
   * @param {Object} entity - L'entité à filtrer
   * @returns {Object} - Entité filtrée
   */
  static filterEntityFields(user, tableName, entity) {
    const userRoles = getUserAllRoles(user);
    const tableConfig = SchemaService.getTableConfig(tableName);

    if (!tableConfig) {
      return entity;
    }

    const filteredEntity = {};

    for (const fieldName in entity) {
      const fieldConfig = tableConfig.fields[fieldName];

      // Si le champ n'est pas dans la config, il vient probablement de commonFields
      if (!fieldConfig) {
        filteredEntity[fieldName] = entity[fieldName];
        continue;
      }

      // Vérifier les permissions spécifiques au champ
      let fieldAccessible = true;
      if (fieldConfig.grant) {
        fieldAccessible = false;
        for (const role of userRoles) {
          if (fieldConfig.grant[role] && fieldConfig.grant[role].includes('read')) {
            fieldAccessible = true;
            break;
          }
        }
      }

      if (fieldAccessible) {
        filteredEntity[fieldName] = entity[fieldName];
      }
    }

    return filteredEntity;
  }

  /**
   * Construit la clause WHERE pour filtrer selon granted et les conditions utilisateur
   * Déplacé de apiTables.js:36
   *
   * @param {Object} user - L'utilisateur
   * @param {string} baseWhere - Clause WHERE de base (optionnelle)
   * @param {Array} baseParams - Paramètres pour la clause WHERE de base (optionnelle)
   * @param {string} tableName - Nom de la table (optionnel, pour préfixer les colonnes en cas de JOIN)
   * @returns {Object} - { where: string, params: Array }
   */
  static buildWhereClause(user, baseWhere = null, baseParams = [], tableName = null) {
    const userRoles = getUserAllRoles(user);
    const conditions = [];
    const params = [];

    // Préfixe pour les colonnes granted et ownerId (utilisé si tableName est fourni pour éviter ambiguïté en cas de JOIN)
    const grantedCol = tableName ? `${tableName}.granted` : 'granted';
    const ownerIdCol = tableName ? `${tableName}.ownerId` : 'ownerId';

    // Ajouter la clause WHERE de base si fournie
    if (baseWhere) {
      conditions.push(`(${baseWhere})`);
      // Ajouter les paramètres de base en premier
      params.push(...baseParams);
    }

    // Conditions pour granted
    const grantedConditions = [];

    // 1. Draft accessible uniquement par le propriétaire
    if (user) {
      grantedConditions.push(`(${grantedCol} = ? AND ${ownerIdCol} = ?)`);
      params.push(GRANTED_VALUES.DRAFT, user.id);
    }

    // 2. Shared accessible selon les permissions de la table (déjà vérifié)
    grantedConditions.push(`${grantedCol} = ?`);
    params.push(GRANTED_VALUES.SHARED);

    // 3. Published @role accessible selon les rôles
    for (const role of userRoles) {
      grantedConditions.push(`${grantedCol} = ?`);
      params.push(`${GRANTED_VALUES.PUBLISHED_PREFIX}${role}`);
    }

    // 4. Rows sans granted (NULL ou vide)
    grantedConditions.push(`${grantedCol} IS NULL`);
    grantedConditions.push(`${grantedCol} = ?`);
    params.push(GRANTED_VALUES.EMPTY);

    if (grantedConditions.length > 0) {
      conditions.push(`(${grantedConditions.join(' OR ')})`);
    }

    const where = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

    return { where, params };
  }

  /**
   * Réduit une relation n:1 à sa version compacte selon les displayFields du schéma
   * Déplacé de apiTables.js:214
   *
   * @param {Object} relatedEntity - L'entité de la relation
   * @param {string} relatedTable - Nom de la table de la relation
   * @returns {Object} - Version compacte de la relation
   */
  static compactRelation(relatedEntity, relatedTable) {
    const displayFields = SchemaService.getDisplayFields(relatedTable);
    if (!displayFields || displayFields.length === 0) {
      return relatedEntity;
    }

    const compactedEntity = {};

    // Toujours inclure l'id
    if (relatedEntity.id !== undefined) {
      compactedEntity.id = relatedEntity.id;
    }

    // Inclure les displayFields
    for (const field of displayFields) {
      if (relatedEntity[field] !== undefined) {
        compactedEntity[field] = relatedEntity[field];
      }
    }

    return compactedEntity;
  }

  /**
   * Vérifie si un utilisateur peut effectuer une action CRUD sur une entité
   *
   * @param {Object} user - L'utilisateur
   * @param {string} tableName - Nom de la table
   * @param {string} action - L'action ('create', 'read', 'update', 'delete', 'publish')
   * @param {Object} entity - L'entité (optionnel, pour vérifier la propriété)
   * @returns {boolean} - true si l'action est autorisée
   */
  static canPerformAction(user, tableName, action, entity = null) {
    // Vérifier la permission au niveau table
    if (!hasPermission(user, tableName, action)) {
      return false;
    }

    // Pour update et delete, vérifier si l'utilisateur est propriétaire
    // si l'entité est en draft
    if (entity && (action === 'update' || action === 'delete')) {
      if (entity.granted === GRANTED_VALUES.DRAFT && entity.ownerId !== user?.id) {
        return false;
      }
    }

    return true;
  }

  /**
   * Obtient les entités accessibles depuis une liste complète
   * Filtre selon les permissions granted
   *
   * @param {Object} user - L'utilisateur
   * @param {string} tableName - Nom de la table
   * @param {Array<Object>} entities - Liste des entités
   * @returns {Array<Object>} - Liste filtrée
   */
  static filterAccessibleEntities(user, tableName, entities) {
    return entities.filter(entity =>
      this.canAccessEntity(user, tableName, entity)
    );
  }
}

module.exports = EntityService;
