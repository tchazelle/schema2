const pool = require('../config/database');
const SchemaService = require('./schemaService');
const PermissionService = require('./permissionService');

/**
 * Service pour gérer la réorganisation (drag & drop) des relations 1:N ordonnables
 */
class ReorderService {
  /**
   * Vérifie si une relation est ordonnée (a la propriété orderable)
   * @param {string} tableName - Nom de la table
   * @param {string} relationField - Nom du champ de relation
   * @returns {object|null} - Retourne la config du champ si orderable, sinon null
   */
  static getOrderableConfig(tableName, relationField) {
    const schema = SchemaService.getTableConfig(tableName);
    if (!schema) return null;

    const field = schema.fields[relationField];
    if (!field || !field.relation || !field.orderable) return null;

    return {
      orderField: field.orderable,
      parentTable: schema.name,
      childTable: tableName,
      relationField: relationField,
      arrayName: field.arrayName
    };
  }

  /**
   * Réordonne une liste d'éléments en mettant à jour le champ de position
   * @param {string} tableName - Table contenant les éléments à réordonner
   * @param {string} relationField - Champ de relation (ex: 'idPage', 'idMusicAlbum')
   * @param {number} parentId - ID de l'entité parente
   * @param {Array<number>} orderedIds - Liste des IDs dans le nouvel ordre
   * @param {object} user - Utilisateur effectuant l'action
   * @returns {object} - Résultat de l'opération
   */
  static async reorderItems(tableName, relationField, parentId, orderedIds, user) {
    const connection = await pool.getConnection();

    try {
      // 1. Vérifier que la relation est ordonnée
      const config = this.getOrderableConfig(tableName, relationField);
      if (!config) {
        throw new Error(`La relation ${relationField} de la table ${tableName} n'est pas ordonnée (pas de propriété orderable)`);
      }

      const { orderField } = config;

      // 2. Vérifier les permissions de mise à jour
      const canUpdate = PermissionService.hasPermission(user, tableName, 'update');
      if (!canUpdate) {
        throw new Error(`Vous n'avez pas la permission de modifier la table ${tableName}`);
      }

      // 3. Démarrer une transaction
      await connection.beginTransaction();

      // 4. Vérifier que tous les IDs appartiennent bien au parent
      const [existingRows] = await connection.query(
        `SELECT id FROM ${tableName} WHERE ${relationField} = ?`,
        [parentId]
      );

      const existingIds = existingRows.map(row => row.id);
      const invalidIds = orderedIds.filter(id => !existingIds.includes(id));

      if (invalidIds.length > 0) {
        throw new Error(`IDs invalides détectés: ${invalidIds.join(', ')}`);
      }

      // 5. Mettre à jour les positions
      const updates = orderedIds.map((id, index) => {
        return connection.query(
          `UPDATE ${tableName} SET ${orderField} = ? WHERE id = ?`,
          [index, id]
        );
      });

      await Promise.all(updates);

      // 6. Commit de la transaction
      await connection.commit();

      return {
        success: true,
        message: `${orderedIds.length} éléments réordonnés avec succès`,
        updatedCount: orderedIds.length
      };

    } catch (error) {
      // Rollback en cas d'erreur
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Récupère la liste des relations ordonnées pour une table donnée
   * @param {string} tableName - Nom de la table
   * @returns {Array} - Liste des champs ordonnés
   */
  static getOrderableRelations(tableName) {
    const schema = SchemaService.getTableConfig(tableName);
    if (!schema) return [];

    const orderableFields = [];

    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      if (fieldDef.relation && fieldDef.orderable) {
        orderableFields.push({
          field: fieldName,
          relation: fieldDef.relation,
          arrayName: fieldDef.arrayName,
          orderField: fieldDef.orderable
        });
      }
    }

    return orderableFields;
  }

  /**
   * Insère un nouvel élément avec une position automatique (à la fin)
   * @param {string} tableName - Table où insérer
   * @param {string} relationField - Champ de relation
   * @param {number} parentId - ID du parent
   * @param {object} data - Données de l'élément à insérer
   * @returns {object} - Résultat avec l'ID et la position assignée
   */
  static async insertWithPosition(tableName, relationField, parentId, data) {
    const config = this.getOrderableConfig(tableName, relationField);
    if (!config) {
      throw new Error(`La relation ${relationField} n'est pas ordonnée`);
    }

    const { orderField } = config;

    // Récupérer la position maximale actuelle
    const [maxResult] = await pool.query(
      `SELECT MAX(${orderField}) as maxPosition FROM ${tableName} WHERE ${relationField} = ?`,
      [parentId]
    );

    const nextPosition = (maxResult[0].maxPosition || -1) + 1;

    // Insérer avec la nouvelle position
    const insertData = {
      ...data,
      [relationField]: parentId,
      [orderField]: nextPosition
    };

    const [result] = await pool.query(
      `INSERT INTO ${tableName} SET ?`,
      [insertData]
    );

    return {
      id: result.insertId,
      position: nextPosition
    };
  }
}

module.exports = ReorderService;
