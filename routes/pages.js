const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { hasPermission, getUserAllRoles } = require('../utils/permissions');
const schema = require('../schema.js');

/**
 * Vérifie si un utilisateur peut accéder à une page selon son granted
 * @param {Object} user - L'utilisateur
 * @param {Object} page - La page avec son champ granted
 * @returns {boolean} - true si accessible
 */
function canAccessPage(user, page) {
  const userRoles = getUserAllRoles(user);

  // Si granted = draft, seul le propriétaire peut lire
  if (page.granted === 'draft') {
    if (!user || page.ownerId !== user.id) {
      return false;
    }
  }
  // Si granted = shared, vérifier les permissions de la table Page
  else if (page.granted === 'shared') {
    if (!hasPermission(user, 'Page', 'read')) {
      return false;
    }
  }
  // Si granted = published @role, vérifier le rôle
  else if (page.granted && page.granted.startsWith('published @')) {
    const requiredRole = page.granted.replace('published @', '');
    if (!userRoles.includes(requiredRole)) {
      return false;
    }
  }

  return true;
}

/**
 * Vérifie si un utilisateur peut accéder à une section selon son granted
 * @param {Object} user - L'utilisateur
 * @param {Object} section - La section avec son champ granted
 * @returns {boolean} - true si accessible
 */
function canAccessSection(user, section) {
  const userRoles = getUserAllRoles(user);

  // Si granted = draft, seul le propriétaire peut lire
  if (section.granted === 'draft') {
    if (!user || section.ownerId !== user.id) {
      return false;
    }
  }
  // Si granted = shared, vérifier les permissions de la table Section
  else if (section.granted === 'shared') {
    if (!hasPermission(user, 'Section', 'read')) {
      return false;
    }
  }
  // Si granted = published @role, vérifier le rôle
  else if (section.granted && section.granted.startsWith('published @')) {
    const requiredRole = section.granted.replace('published @', '');
    if (!userRoles.includes(requiredRole)) {
      return false;
    }
  }

  return true;
}

/**
 * GET /:page
 * Retourne le setup Page-Section de la page si autorisée
 * Inclut la page et ses sections avec toutes leurs configurations
 */
router.get('/:page', async (req, res) => {
  try {
    const { page: pageSlug } = req.params;
    const user = req.user;

    // Si l'utilisateur n'est pas connecté, utiliser un user par défaut avec rôle public
    const effectiveUser = user || { roles: 'public' };

    // Récupérer la page par son slug
    const [pages] = await pool.query(
      'SELECT * FROM Page WHERE slug = ?',
      [pageSlug]
    );

    if (pages.length === 0) {
      return res.status(404).json({
        error: 'Page non trouvée',
        slug: pageSlug
      });
    }

    const pageData = pages[0];

    // Vérifier si l'utilisateur peut accéder à la page
    if (!canAccessPage(effectiveUser, pageData)) {
      return res.status(403).json({
        error: 'Accès refusé à cette page',
        slug: pageSlug
      });
    }

    // Récupérer les sections de la page
    const [sections] = await pool.query(
      'SELECT * FROM Section WHERE idPage = ? ORDER BY position ASC',
      [pageData.id]
    );

    // Filtrer les sections selon les permissions
    const accessibleSections = [];
    for (const section of sections) {
      if (canAccessSection(effectiveUser, section)) {
        // Vérifier si l'utilisateur a accès à la table mentionnée dans la section
        if (section.tableName) {
          if (hasPermission(effectiveUser, section.tableName, 'read')) {
            // Parser relations si c'est une chaîne JSON
            let relations = null;
            if (section.relations) {
              try {
                relations = typeof section.relations === 'string'
                  ? JSON.parse(section.relations)
                  : section.relations;
              } catch (e) {
                console.warn('Erreur lors du parsing des relations:', e);
              }
            }

            accessibleSections.push({
              id: section.id,
              name: section.name,
              description: section.description,
              tableName: section.tableName,
              whereClause: section.whereClause,
              orderBy: section.orderBy,
              limit: section.limit,
              relations: relations,
              presentationType: section.presentationType,
              mustache: section.mustache,
              position: section.position,
              granted: section.granted,
              createdAt: section.createdAt,
              updatedAt: section.updatedAt
            });
          } else {
            // L'utilisateur n'a pas accès à la table de cette section
            // On peut soit ignorer la section, soit indiquer qu'elle n'est pas accessible
            accessibleSections.push({
              id: section.id,
              name: section.name,
              description: section.description,
              tableName: section.tableName,
              accessible: false,
              reason: 'Accès refusé à la table',
              position: section.position
            });
          }
        } else {
          // Section sans table (contenu statique par exemple)
          accessibleSections.push({
            id: section.id,
            name: section.name,
            description: section.description,
            mustache: section.mustache,
            position: section.position,
            granted: section.granted,
            createdAt: section.createdAt,
            updatedAt: section.updatedAt
          });
        }
      }
    }

    // Construire la réponse
    const response = {
      success: true,
      page: {
        id: pageData.id,
        slug: pageData.slug,
        name: pageData.name,
        description: pageData.description,
        mustache: pageData.mustache,
        css: pageData.css,
        position: pageData.position,
        granted: pageData.granted,
        createdAt: pageData.createdAt,
        updatedAt: pageData.updatedAt
      },
      sections: accessibleSections,
      permissions: {
        canEdit: user && hasPermission(effectiveUser, 'Page', 'update') && (pageData.ownerId === user.id || hasPermission(effectiveUser, 'Page', 'update')),
        canDelete: user && hasPermission(effectiveUser, 'Page', 'delete') && (pageData.ownerId === user.id || hasPermission(effectiveUser, 'Page', 'delete')),
        canAddSection: user && hasPermission(effectiveUser, 'Section', 'create')
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Erreur lors de la récupération de la page:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération de la page'
    });
  }
});

module.exports = router;
