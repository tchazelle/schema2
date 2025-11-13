/**
 * Service pour la gestion des pages et sections
 * Extrait la logique métier de routes/pages.js
 */

const pool = require('../config/database');
const { hasPermission } = require('./permissionService');
const EntityService = require('./entityService');

class PageService {
  /**
   * Charge une page par son slug
   * @param {string} slug - Le slug de la page
   * @param {Object} user - L'utilisateur
   * @returns {Promise<Object|null>} - La page ou null si non trouvée
   */
  static async getPageBySlug(slug, user) {
    const effectiveUser = user || { roles: 'public' };

    // Récupérer la page par son slug
    const [pages] = await pool.query(
      'SELECT * FROM Page WHERE slug = ?',
      [slug]
    );

    if (pages.length === 0) {
      return null;
    }

    const page = pages[0];

    // Vérifier si l'utilisateur peut accéder à la page
    if (!EntityService.canAccessEntity(effectiveUser, 'Page', page)) {
      return null;
    }

    return page;
  }

  /**
   * Charge les sections d'une page avec filtrage par permissions
   * @param {number} pageId - L'ID de la page
   * @param {Object} user - L'utilisateur
   * @returns {Promise<Array>} - Liste des sections accessibles
   */
  static async getPageSections(pageId, user) {
    const effectiveUser = user || { roles: 'public' };

    // Récupérer les sections de la page
    const [sections] = await pool.query(
      'SELECT * FROM Section WHERE idPage = ? ORDER BY position ASC',
      [pageId]
    );

    // Filtrer les sections selon les permissions
    const accessibleSections = [];

    for (const section of sections) {
      if (EntityService.canAccessEntity(effectiveUser, 'Section', section)) {
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

    return accessibleSections;
  }

  /**
   * Charge une page complète avec ses sections
   * @param {string} slug - Le slug de la page
   * @param {Object} user - L'utilisateur
   * @returns {Promise<Object|null>} - { page, sections } ou null
   */
  static async getPageWithSections(slug, user) {
    const page = await this.getPageBySlug(slug, user);

    if (!page) {
      return null;
    }

    const sections = await this.getPageSections(page.id, user);

    return {
      page,
      sections
    };
  }

  /**
   * Charge toutes les pages accessibles pour un utilisateur
   * @param {Object} user - L'utilisateur
   * @returns {Promise<Array>} - Liste des pages accessibles
   */
  static async getAccessiblePages(user) {
    const effectiveUser = user || { roles: 'public' };

    // Récupérer toutes les pages
    const [pages] = await pool.query('SELECT * FROM Page ORDER BY `order` ASC');

    // Filtrer selon les permissions
    return EntityService.filterAccessibleEntities(effectiveUser, 'Page', pages);
  }

  /**
   * Construit la réponse formatée pour une page
   * @param {Object} page - Les données de la page
   * @param {Array} sections - Les sections accessibles
   * @param {Object} user - L'utilisateur
   * @returns {Object} - Réponse formatée
   */
  static buildPageResponse(page, sections, user) {
    return {
      success: true,
      page: {
        id: page.id,
        slug: page.slug,
        name: page.name,
        description: page.description,
        granted: page.granted,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
        permissions: {
          canEdit: user && EntityService.canPerformAction(user, 'Page', 'update', page),
          canDelete: user && EntityService.canPerformAction(user, 'Page', 'delete', page),
          canAddSection: user && hasPermission(user, 'Section', 'create')
        }
      },
      sections: sections.map(section => ({
        ...section,
        permissions: {
          canEdit: user && EntityService.canPerformAction(user, 'Section', 'update', section),
          canDelete: user && EntityService.canPerformAction(user, 'Section', 'delete', section)
        }
      }))
    };
  }
}

module.exports = PageService;
