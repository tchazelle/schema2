/**
 * Service de repository pour centraliser toutes les requêtes SQL
 * Pattern Repository pour faciliter les tests et la maintenance
 */

const pool = require('../config/database');

class RepositoryService {
  /**
   * Récupère un enregistrement par ID
   * @param {string} tableName - Nom de la table
   * @param {number} id - ID de l'enregistrement
   * @returns {Promise<Object|null>} - L'enregistrement ou null
   */
  static async findById(tableName, id) {
    const [rows] = await pool.query(
      `SELECT * FROM \`${tableName}\` WHERE id = ?`,
      [id]
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Récupère plusieurs enregistrements par IDs
   * @param {string} tableName - Nom de la table
   * @param {Array<number>} ids - Liste des IDs
   * @returns {Promise<Array>} - Liste des enregistrements
   */
  static async findByIds(tableName, ids) {
    if (!ids || ids.length === 0) return [];

    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.query(
      `SELECT * FROM \`${tableName}\` WHERE id IN (${placeholders})`,
      ids
    );
    return rows;
  }

  /**
   * Récupère tous les enregistrements d'une table
   * @param {string} tableName - Nom de la table
   * @param {Object} options - Options de requête
   * @param {string} [options.where] - Clause WHERE
   * @param {Array} [options.params] - Paramètres pour la clause WHERE
   * @param {string} [options.orderBy] - Champ de tri
   * @param {string} [options.order] - Direction (ASC/DESC)
   * @param {number} [options.limit] - Limite de résultats
   * @param {number} [options.offset] - Décalage
   * @returns {Promise<Array>} - Liste des enregistrements
   */
  static async findAll(tableName, options = {}) {
    const {
      where = '1=1',
      params = [],
      orderBy,
      order = 'ASC',
      limit,
      offset
    } = options;

    let query = `SELECT * FROM \`${tableName}\` WHERE ${where}`;

    if (orderBy) {
      const orderDirection = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY ${orderBy} ${orderDirection}`;
    }

    if (limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(limit));
    }

    if (offset) {
      query += ` OFFSET ?`;
      params.push(parseInt(offset));
    }

    const [rows] = await pool.query(query, params);
    return rows;
  }

  /**
   * Récupère un seul enregistrement selon une condition
   * @param {string} tableName - Nom de la table
   * @param {string} where - Clause WHERE
   * @param {Array} params - Paramètres
   * @returns {Promise<Object|null>} - L'enregistrement ou null
   */
  static async findOne(tableName, where, params = []) {
    const [rows] = await pool.query(
      `SELECT * FROM \`${tableName}\` WHERE ${where} LIMIT 1`,
      params
    );
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Compte le nombre d'enregistrements
   * @param {string} tableName - Nom de la table
   * @param {string} [where='1=1'] - Clause WHERE
   * @param {Array} [params=[]] - Paramètres
   * @returns {Promise<number>} - Nombre d'enregistrements
   */
  static async count(tableName, where = '1=1', params = []) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) as total FROM \`${tableName}\` WHERE ${where}`,
      params
    );
    return rows[0].total;
  }

  /**
   * Crée un nouvel enregistrement
   * @param {string} tableName - Nom de la table
   * @param {Object} data - Données à insérer
   * @returns {Promise<Object>} - { insertId, affectedRows }
   */
  static async create(tableName, data) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const placeholders = fields.map(() => '?').join(',');

    const [result] = await pool.query(
      `INSERT INTO \`${tableName}\` (${fields.join(',')}) VALUES (${placeholders})`,
      values
    );

    return {
      insertId: result.insertId,
      affectedRows: result.affectedRows
    };
  }

  /**
   * Met à jour un enregistrement
   * @param {string} tableName - Nom de la table
   * @param {number} id - ID de l'enregistrement
   * @param {Object} data - Données à mettre à jour
   * @returns {Promise<Object>} - { affectedRows, changedRows }
   */
  static async update(tableName, id, data) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const setClause = fields.map(field => `${field} = ?`).join(', ');

    const [result] = await pool.query(
      `UPDATE \`${tableName}\` SET ${setClause} WHERE id = ?`,
      [...values, id]
    );

    return {
      affectedRows: result.affectedRows,
      changedRows: result.changedRows
    };
  }

  /**
   * Met à jour des enregistrements selon une condition
   * @param {string} tableName - Nom de la table
   * @param {Object} data - Données à mettre à jour
   * @param {string} where - Clause WHERE
   * @param {Array} whereParams - Paramètres de la clause WHERE
   * @returns {Promise<Object>} - { affectedRows, changedRows }
   */
  static async updateWhere(tableName, data, where, whereParams = []) {
    const fields = Object.keys(data);
    const values = Object.values(data);
    const setClause = fields.map(field => `${field} = ?`).join(', ');

    const [result] = await pool.query(
      `UPDATE \`${tableName}\` SET ${setClause} WHERE ${where}`,
      [...values, ...whereParams]
    );

    return {
      affectedRows: result.affectedRows,
      changedRows: result.changedRows
    };
  }

  /**
   * Supprime un enregistrement
   * @param {string} tableName - Nom de la table
   * @param {number} id - ID de l'enregistrement
   * @returns {Promise<number>} - Nombre d'enregistrements supprimés
   */
  static async delete(tableName, id) {
    const [result] = await pool.query(
      `DELETE FROM \`${tableName}\` WHERE id = ?`,
      [id]
    );
    return result.affectedRows;
  }

  /**
   * Supprime des enregistrements selon une condition
   * @param {string} tableName - Nom de la table
   * @param {string} where - Clause WHERE
   * @param {Array} params - Paramètres
   * @returns {Promise<number>} - Nombre d'enregistrements supprimés
   */
  static async deleteWhere(tableName, where, params = []) {
    const [result] = await pool.query(
      `DELETE FROM \`${tableName}\` WHERE ${where}`,
      params
    );
    return result.affectedRows;
  }

  /**
   * Récupère des enregistrements liés par clé étrangère
   * @param {string} tableName - Nom de la table
   * @param {string} foreignKey - Nom du champ FK
   * @param {number} foreignValue - Valeur de la FK
   * @param {Object} options - Options (orderBy, order, limit)
   * @returns {Promise<Array>} - Liste des enregistrements
   */
  static async findByForeignKey(tableName, foreignKey, foreignValue, options = {}) {
    const { orderBy, order = 'ASC', limit } = options;

    let query = `SELECT * FROM \`${tableName}\` WHERE ${foreignKey} = ?`;
    const params = [foreignValue];

    if (orderBy) {
      const orderDirection = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
      query += ` ORDER BY ${orderBy} ${orderDirection}`;
    }

    if (limit) {
      query += ` LIMIT ?`;
      params.push(parseInt(limit));
    }

    const [rows] = await pool.query(query, params);
    return rows;
  }

  /**
   * Exécute une requête SQL brute (à utiliser avec précaution)
   * @param {string} query - Requête SQL
   * @param {Array} params - Paramètres
   * @returns {Promise<Array>} - Résultats
   */
  static async raw(query, params = []) {
    const [rows] = await pool.query(query, params);
    return rows;
  }

  /**
   * Vérifie si un enregistrement existe
   * @param {string} tableName - Nom de la table
   * @param {number} id - ID de l'enregistrement
   * @returns {Promise<boolean>} - true si existe
   */
  static async exists(tableName, id) {
    const [rows] = await pool.query(
      `SELECT 1 FROM \`${tableName}\` WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows.length > 0;
  }

  /**
   * Exécute une transaction
   * @param {Function} callback - Fonction async contenant les opérations
   * @returns {Promise<any>} - Résultat du callback
   */
  static async transaction(callback) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = RepositoryService;
