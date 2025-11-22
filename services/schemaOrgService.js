/**
 * Service pour charger et accéder aux données Schema.org
 * Charge les fichiers CSV de traduction française et les transforme en objets pour accès rapide
 */

const fs = require('fs');
const path = require('path');

class SchemaOrgService {
  static properties = new Map(); // Map<id, {label, comment}>
  static types = new Map(); // Map<id, {label, comment}>
  static isInitialized = false;

  /**
   * Initialise le service en chargeant les fichiers CSV
   * Cette méthode doit être appelée au démarrage de l'application
   */
  static async initialize() {
    if (this.isInitialized) {
      console.log('[SchemaOrgService] Already initialized, skipping...');
      return;
    }

    console.log('[SchemaOrgService] Initializing...');

    try {
      // Charger les propriétés
      const propertiesPath = path.join(__dirname, '../schemaorg/schemaorg-properties_fr.csv');
      await this._loadCSV(propertiesPath, this.properties, 'properties');

      // Charger les types
      const typesPath = path.join(__dirname, '../schemaorg/schemaorg-types_fr.csv');
      await this._loadCSV(typesPath, this.types, 'types');

      this.isInitialized = true;
      console.log(`[SchemaOrgService] Initialized successfully: ${this.properties.size} properties, ${this.types.size} types`);
    } catch (error) {
      console.error('[SchemaOrgService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Charge un fichier CSV et remplit une Map
   * Format CSV: id,label,comment
   * @private
   */
  static async _loadCSV(filePath, targetMap, type) {
    return new Promise((resolve, reject) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Ignorer la première ligne (header)
      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Parser la ligne CSV avec la fonction robuste
        const parts = this._parseCSVLine(line);
        if (parts.length >= 3) {
          const id = parts[0];
          const label = parts[1];
          const comment = parts[2];

          // Extraire le nom simple de l'ID (ex: http://schema.org/about -> about)
          const simpleName = id.split('/').pop();

          targetMap.set(simpleName, {
            id,
            label,
            comment
          });
          count++;
        }
      }

      console.log(`[SchemaOrgService] Loaded ${count} ${type} from ${path.basename(filePath)}`);
      resolve();
    });
  }

  /**
   * Parse une ligne CSV en gérant les guillemets et virgules dans les valeurs
   * @private
   */
  static _parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    // Ajouter le dernier champ
    if (current) {
      result.push(current.trim());
    }

    return result;
  }

  /**
   * Récupère les informations d'une propriété Schema.org
   * @param {string} propertyName - Nom de la propriété (ex: "about", "datePublished")
   * @returns {Object|null} - {id, label, comment} ou null si non trouvé
   */
  static getProperty(propertyName) {
    if (!this.isInitialized) {
      console.warn('[SchemaOrgService] Not initialized, cannot get property:', propertyName);
      return null;
    }
    return this.properties.get(propertyName) || null;
  }

  /**
   * Récupère les informations d'un type Schema.org
   * @param {string} typeName - Nom du type (ex: "Person", "MusicAlbum")
   * @returns {Object|null} - {id, label, comment} ou null si non trouvé
   */
  static getType(typeName) {
    if (!this.isInitialized) {
      console.warn('[SchemaOrgService] Not initialized, cannot get type:', typeName);
      return null;
    }
    return this.types.get(typeName) || null;
  }

  /**
   * Vérifie si une propriété existe dans Schema.org
   * @param {string} propertyName - Nom de la propriété
   * @returns {boolean}
   */
  static hasProperty(propertyName) {
    return this.isInitialized && this.properties.has(propertyName);
  }

  /**
   * Vérifie si un type existe dans Schema.org
   * @param {string} typeName - Nom du type
   * @returns {boolean}
   */
  static hasType(typeName) {
    return this.isInitialized && this.types.has(typeName);
  }

  /**
   * Récupère toutes les propriétés (pour debug)
   * @returns {Map}
   */
  static getAllProperties() {
    return this.properties;
  }

  /**
   * Récupère tous les types (pour debug)
   * @returns {Map}
   */
  static getAllTypes() {
    return this.types;
  }
}

module.exports = SchemaOrgService;
