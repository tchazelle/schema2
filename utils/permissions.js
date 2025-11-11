const schema = require('../schema.js');

/**
 * Récupère tous les rôles hérités pour un rôle donné
 * Utilise une approche récursive pour gérer l'héritage multiple
 * @param {string} role - Le rôle à analyser
 * @param {Set} inherited - Set des rôles déjà hérités (pour éviter les boucles)
 * @returns {Array} - Tableau de tous les rôles hérités (incluant le rôle lui-même)
 */
function getInheritedRoles(role, inherited = new Set()) {
  // Si le rôle n'existe pas dans le schéma, retourner un tableau vide
  if (!schema.roles[role]) {
    return [];
  }

  // Ajouter le rôle actuel au set
  inherited.add(role);

  // Récupérer les rôles dont celui-ci hérite
  const inheritsFrom = schema.roles[role].inherits || [];

  // Pour chaque rôle hérité, récursivement obtenir ses héritages
  for (const parentRole of inheritsFrom) {
    if (!inherited.has(parentRole)) {
      getInheritedRoles(parentRole, inherited);
    }
  }

  return Array.from(inherited);
}

/**
 * Extrait les rôles d'un utilisateur depuis le champ roles
 * Format attendu: "@admin @dev" ou "admin dev" ou ["admin", "dev"]
 * @param {string|Array} userRoles - Les rôles de l'utilisateur
 * @returns {Array} - Tableau de rôles
 */
function parseUserRoles(userRoles) {
  if (!userRoles) return [];

  if (Array.isArray(userRoles)) {
    return userRoles.map(r => r.replace('@', ''));
  }

  if (typeof userRoles === 'string') {
    return userRoles
      .split(/\s+/)
      .filter(r => r)
      .map(r => r.replace('@', ''));
  }

  return [];
}

/**
 * Récupère tous les rôles d'un utilisateur (incluant les héritages)
 * @param {Object} user - L'utilisateur avec son champ roles
 * @returns {Array} - Tableau de tous les rôles (avec héritage)
 */
function getUserAllRoles(user) {
  if (!user || !user.roles) {
    return ['public']; // Par défaut, tout le monde est public
  }

  const userRoles = parseUserRoles(user.roles);
  const allRoles = new Set(['public']); // Tout le monde hérite de public

  // Pour chaque rôle de l'utilisateur, obtenir ses héritages
  for (const role of userRoles) {
    const inherited = getInheritedRoles(role);
    inherited.forEach(r => allRoles.add(r));
  }

  return Array.from(allRoles);
}

/**
 * Vérifie si un utilisateur a une permission sur une table pour une action donnée
 * @param {Object} user - L'utilisateur
 * @param {string} tableName - Nom de la table
 * @param {string} action - Action à vérifier (read, create, update, delete, publish)
 * @returns {boolean} - true si l'utilisateur a la permission
 */
function hasPermission(user, tableName, action) {
  // Récupérer la configuration de la table
  const tableConfig = schema.tables[tableName];
  if (!tableConfig) {
    return false;
  }

  // Récupérer les permissions de la table (ou utiliser defaultConfigPage)
  const tableGrants = tableConfig.granted || schema.defaultConfigTable.granted;

  // Récupérer tous les rôles de l'utilisateur (avec héritage)
  const userRoles = getUserAllRoles(user);

  // Vérifier si l'utilisateur a la permission
  for (const role of userRoles) {
    if (tableGrants[role] && tableGrants[role].includes(action)) {
      return true;
    }
  }

  return false;
}

/**
 * Récupère toutes les permissions d'un utilisateur organisées par table et action
 * @param {Object} user - L'utilisateur
 * @returns {Object} - Object avec les permissions organisées
 */
function getAllPermissions(user) {
  const permissions = {};
  const userRoles = getUserAllRoles(user);

  // Pour chaque table
  for (const tableName in schema.tables) {
    const tableConfig = schema.tables[tableName];
    const tableGrants = tableConfig.granted || schema.defaultConfigTable.granted;

    permissions[tableName] = {
      read: false,
      create: false,
      update: false,
      delete: false,
      publish: false
    };

    // Pour chaque rôle de l'utilisateur
    for (const role of userRoles) {
      if (tableGrants[role]) {
        // Marquer les actions autorisées
        for (const action of tableGrants[role]) {
          permissions[tableName][action] = true;
        }
      }
    }
  }

  return permissions;
}

/**
 * Récupère les tables accessibles pour un utilisateur (avec au moins read)
 * @param {Object} user - L'utilisateur
 * @returns {Array} - Tableau des noms de tables accessibles
 */
function getAccessibleTables(user) {
  const tables = [];

  for (const tableName in schema.tables) {
    if (hasPermission(user, tableName, 'read')) {
      tables.push(tableName);
    }
  }

  return tables;
}

module.exports = {
  getInheritedRoles,
  parseUserRoles,
  getUserAllRoles,
  hasPermission,
  getAllPermissions,
  getAccessibleTables
};
