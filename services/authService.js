const jwt = require('jsonwebtoken');
const schema = require('../schema.js');
const { getUserAllRoles, parseUserRoles } = require('./permissionService');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';
const COOKIE_MAX_AGE = schema.users.cookieMaxAge || 34646400; // secondes (400 jours par défaut)

/**
 * Génère un token JWT pour un utilisateur
 * @param {Object} user - L'utilisateur
 * @returns {string} - Le token JWT
 */
function generateToken(user) {
  const payload = {
    id: user.id,
    email: user.email,
    roles: user.roles,
    givenName: user.givenName,
    familyName: user.familyName
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: COOKIE_MAX_AGE
  });
}

/**
 * Vérifie et décode un token JWT
 * @param {string} token - Le token à vérifier
 * @returns {Object|null} - Les données du token ou null si invalide
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Middleware pour extraire l'utilisateur du cookie JWT
 * Ajoute req.user si le token est valide
 */
function authMiddleware(req, res, next) {
  const token = req.cookies.auth_token;

  if (token) {
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }

  // Toujours appeler next(), même sans utilisateur (pour routes publiques)
  next();
}

/**
 * Middleware pour protéger une route (nécessite authentification)
 */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentification requise' });
  }
  next();
}

/**
 * Crée un cookie d'authentification
 * @param {Object} res - Response object d'Express
 * @param {string} token - Le token JWT
 */
function setAuthCookie(res, token) {
  res.cookie('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: COOKIE_MAX_AGE * 1000, // convertir en millisecondes
    sameSite: 'lax'
  });
}

/**
 * Supprime le cookie d'authentification
 * @param {Object} res - Response object d'Express
 */
function clearAuthCookie(res) {
  res.clearCookie('auth_token');
}

/**
 * Enrichit les données utilisateur avec des informations supplémentaires
 * @param {Object|null} user - L'utilisateur à enrichir (ou null)
 * @returns {Object} - L'utilisateur enrichi avec toutes les informations nécessaires
 */
function userEnrich(user) {
  // Si pas d'utilisateur, créer un utilisateur public par défaut
  if (!user) {
    return {
      id: null,
      email: null,
      roles: 'public',
      allRoles: ['public'],
      givenName: null,
      familyName: null,
      fullName: 'Visiteur',
      abbreviation: 'V',
      isAuthenticated: false,
      effectiveRole: 'public'
    };
  }

  // Obtenir tous les rôles (avec héritage)
  const allRoles = getUserAllRoles(user);

  // Créer l'abréviation (première lettre du prénom + première lettre du nom)
  const abbreviation = (
    (user.givenName ? user.givenName[0].toUpperCase() : '') +
    (user.familyName ? user.familyName[0].toUpperCase() : '')
  ) || 'U'; // 'U' pour User par défaut

  // Créer le nom complet
  const fullName = [user.givenName, user.familyName]
    .filter(Boolean)
    .join(' ') || user.email || 'Utilisateur';

  // Obtenir le rôle principal (le plus élevé dans la hiérarchie)
  const userRolesList = parseUserRoles(user.roles);
  const primaryRole = userRolesList.length > 0 ? userRolesList[0] : 'public';

  // Retourner l'utilisateur enrichi
  return {
    // Données originales
    id: user.id,
    email: user.email,
    roles: user.roles, // Format original "@admin @dev"
    givenName: user.givenName,
    familyName: user.familyName,
    image: user.image, // Photo de profil
    theme: user.theme, // Préférence de thème

    // Données enrichies
    allRoles: allRoles, // Array de tous les rôles avec héritage
    fullName: fullName, // "Jean Dupont"
    abbreviation: abbreviation, // "JD"
    isAuthenticated: true,
    primaryRole: primaryRole, // Le premier rôle de l'utilisateur
    effectiveRole: primaryRole, // Alias pour compatibilité avec l'ancien code

    // Métadonnées utiles
    roleCount: allRoles.length,
    hasAdminAccess: allRoles.includes('admin') || allRoles.includes('dir') || allRoles.includes('dev')
  };
}

/**
 * Middleware pour enrichir req.user avec des informations supplémentaires
 * Doit être utilisé après authMiddleware
 */
function userEnrichMiddleware(req, res, next) {
  // Enrichir l'utilisateur (qu'il soit authentifié ou non)
  req.user = userEnrich(req.user);
  next();
}

module.exports = {
  generateToken,
  verifyToken,
  authMiddleware,
  requireAuth,
  setAuthCookie,
  clearAuthCookie,
  userEnrich,
  userEnrichMiddleware,
  COOKIE_MAX_AGE
};
