const jwt = require('jsonwebtoken');
const schema = require('../schema.js');
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

module.exports = {
  generateToken,
  verifyToken,
  authMiddleware,
  requireAuth,
  setAuthCookie,
  clearAuthCookie,
  COOKIE_MAX_AGE
};
