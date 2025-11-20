const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { generateToken, setAuthCookie, clearAuthCookie } = require('../services/authService');
const schema = require('../schema.js');
const UIService = require('../services/uiService');

/**
 * POST /auth/login
 * Authentifie un utilisateur avec email et password
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json(UIService.jsonError('Email et mot de passe requis'));
    }

    // Récupérer l'utilisateur depuis la table Person
    const [users] = await pool.query(
      'SELECT * FROM Person WHERE email = ? AND isActive = 1',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json(UIService.jsonError('Email ou mot de passe incorrect'));
    }

    const user = users[0];

    // Vérifier le mot de passe (en clair pour le développement)
    // TODO: Utiliser bcrypt en production
    if (user.password !== password) {
      return res.status(401).json(UIService.jsonError('Email ou mot de passe incorrect'));
    }

    // Générer le token JWT
    const token = generateToken(user);

    // Définir le cookie
    setAuthCookie(res, token);

    // Retourner les informations de l'utilisateur (sans le mot de passe)
    const userResponse = {
      id: user.id,
      email: user.email,
      givenName: user.givenName,
      familyName: user.familyName,
      roles: user.roles
    };

    res.json(UIService.jsonSuccess({ user: userResponse }, 'Connexion réussie'));

  } catch (error) {
    console.error('Erreur lors de la connexion:', error);
    res.status(500).json(UIService.jsonError('Erreur serveur lors de la connexion'));
  }
});

/**
 * POST /auth/logout
 * Déconnecte l'utilisateur en supprimant le cookie
 */
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.json(UIService.jsonSuccess({}, 'Déconnexion réussie'));
});

/**
 * GET /auth/me
 * Retourne les informations de l'utilisateur connecté
 */
router.get('/me', (req, res) => {
  if (!req.user) {
    return res.status(401).json(UIService.jsonError('Non authentifié'));
  }

  res.json(UIService.jsonSuccess({ user: req.user }));
});

/**
 * PUT /auth/theme
 * Met à jour la préférence de thème de l'utilisateur
 */
router.put('/theme', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json(UIService.jsonError('Non authentifié'));
    }

    const { theme } = req.body;

    // Valider le thème
    if (!theme || !['light', 'dark'].includes(theme)) {
      return res.status(400).json(UIService.jsonError('Thème invalide. Utilisez "light" ou "dark"'));
    }

    // Mettre à jour la préférence dans la base de données
    await pool.query(
      'UPDATE Person SET theme = ? WHERE id = ?',
      [theme, req.user.id]
    );

    res.json(UIService.jsonSuccess({ theme }, 'Préférence de thème mise à jour'));

  } catch (error) {
    console.error('Erreur lors de la mise à jour du thème:', error);
    res.status(500).json(UIService.jsonError('Erreur serveur lors de la mise à jour du thème'));
  }
});

module.exports = router;
