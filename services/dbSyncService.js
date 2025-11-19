const pool = require('../config/database');
const schema = require('../schema.js');

/**
 * Convertit un type de champ du schéma en type MySQL
 * @param {Object} fieldDef - Définition du champ
 * @returns {string} - Type MySQL
 */
function getSQLType(fieldDef) {
  const typeMap = {
    'integer': 'INT',
    'varchar': 'VARCHAR(255)',
    'text': 'TEXT',
    'datetime': 'DATETIME',
    'date': 'DATE',
    'enum': fieldDef.values ? `ENUM(${fieldDef.values.map(v => `'${v}'`).join(', ')})` : 'VARCHAR(50)'
  };

  return typeMap[fieldDef.type] || 'VARCHAR(255)';
}

/**
 * Génère la définition SQL d'un champ
 * @param {string} fieldName - Nom du champ (camelCase)
 * @param {Object} fieldDef - Définition du champ
 * @returns {string} - Définition SQL du champ (avec nom en camelCase)
 */
function buildSQLFieldDefinition(fieldName, fieldDef) {
  let sql = `\`${fieldName}\` ${getSQLType(fieldDef)}`;

  // Auto increment
  if (fieldDef.autoIncrement) {
    sql += ' AUTO_INCREMENT';
  }

  // NOT NULL - Uniquement pour les clés primaires
  // Tous les autres champs peuvent être NULL
  if (fieldDef.isPrimary) {
    sql += ' NOT NULL';
  }

  // Default value
  if (fieldDef.default !== undefined) {
    if (typeof fieldDef.default === 'string' && (fieldDef.default === 'CURRENT_TIMESTAMP' || fieldDef.default.includes('CURRENT_TIMESTAMP'))) {
      sql += ` DEFAULT ${fieldDef.default}`;
    } else if (typeof fieldDef.default === 'string') {
      sql += ` DEFAULT '${fieldDef.default}'`;
    } else {
      sql += ` DEFAULT ${fieldDef.default}`;
    }
  }

  return sql;
}

/**
 * Vérifie si une table existe
 * @param {string} tableName - Nom de la table
 * @returns {Promise<boolean>} - true si la table existe
 */
async function tableExists(tableName) {
  try {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?',
      [process.env.DB_NAME || 'schema2', tableName]
    );
    return rows[0].count > 0;
  } catch (error) {
    console.error(`Erreur lors de la vérification de la table ${tableName}:`, error.message);
    return false;
  }
}

/**
 * Vérifie si un champ existe dans une table
 * @param {string} tableName - Nom de la table
 * @param {string} fieldName - Nom du champ
 * @returns {Promise<boolean>} - true si le champ existe
 */
async function fieldExists(tableName, fieldName) {
  try {
    const [rows] = await pool.query(
      'SELECT COUNT(*) as count FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [process.env.DB_NAME || 'schema2', tableName, fieldName]
    );
    return rows[0].count > 0;
  } catch (error) {
    console.error(`Erreur lors de la vérification du champ ${tableName}.${fieldName}:`, error.message);
    return false;
  }
}

/**
 * Crée une table à partir de sa définition dans le schéma
 * @param {string} tableName - Nom de la table
 * @param {Object} tableDef - Définition de la table
 */
async function createTable(tableName, tableDef) {
  try {
    const fields = [];
    let primaryKey = null;

    // Parcourir les champs de la table
    for (const [fieldName, fieldDef] of Object.entries(tableDef.fields)) {
      // Ignorer les champs calculés (calculate) et les champs virtuels (as)
      if (fieldDef.calculate || fieldDef.as) {
        continue;
      }

      fields.push(buildSQLFieldDefinition(fieldName, fieldDef));

      if (fieldDef.isPrimary) {
        primaryKey = fieldName;
      }
    }

    // Ajouter les champs communs (commonFields)
    for (const [fieldName, fieldDef] of Object.entries(schema.commonFields)) {
      fields.push(buildSQLFieldDefinition(fieldName, fieldDef));
    }

    // Ajouter la clé primaire
    if (primaryKey) {
      fields.push(`PRIMARY KEY (\`${primaryKey}\`)`);
    }

    const createTableSQL = `CREATE TABLE IF NOT EXISTS \`${tableName}\` (
      ${fields.join(',\n  ')}
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`;

    await pool.query(createTableSQL);
    console.log(`  ✓ Table ${tableName} créée avec succès`);
  } catch (error) {
    console.error(`  ✗ Erreur lors de la création de la table ${tableName}:`, error.message);
  }
}

/**
 * Ajoute un champ manquant dans une table existante
 * @param {string} tableName - Nom de la table
 * @param {string} fieldName - Nom du champ
 * @param {Object} fieldDef - Définition du champ
 */
async function addField(tableName, fieldName, fieldDef) {
  try {
    // Ignorer les champs calculés (calculate) et les champs virtuels (as)
    if (fieldDef.calculate || fieldDef.as) {
      return;
    }

    const alterSQL = `ALTER TABLE \`${tableName}\` ADD COLUMN ${buildSQLFieldDefinition(fieldName, fieldDef)}`;
    await pool.query(alterSQL);
    console.log(`  ✓ Champ ${tableName}.${fieldName} ajouté avec succès`);
  } catch (error) {
    console.error(`  ✗ Erreur lors de l'ajout du champ ${tableName}.${fieldName}:`, error.message);
  }
}

/**
 * Synchronise la structure de la base de données avec le schéma
 */
async function syncDatabase() {
  console.log('\n════════════════════════════════════════════════════════');
  console.log('Vérification de la structure de la base de données...');
  console.log('════════════════════════════════════════════════════════\n');

  try {
    // Parcourir toutes les tables du schéma
    for (const [tableName, tableDef] of Object.entries(schema.tables)) {
      console.log(`Vérification de la table: ${tableName}`);

      const exists = await tableExists(tableName);

      if (!exists) {
        console.log(`  → Table ${tableName} n'existe pas, création...`);
        await createTable(tableName, tableDef);
      } else {
        console.log(`  → Table ${tableName} existe déjà`);

        // Vérifier les champs
        for (const [fieldName, fieldDef] of Object.entries(tableDef.fields)) {
          // Ignorer les champs calculés (calculate) et les champs virtuels (as)
          if (fieldDef.calculate || fieldDef.as) {
            continue;
          }

          const fieldExist = await fieldExists(tableName, fieldName);
          if (!fieldExist) {
            console.log(`  → Champ ${fieldName} manquant, ajout...`);
            await addField(tableName, fieldName, fieldDef);
          }
        }

        // Vérifier les champs communs
        for (const [fieldName, fieldDef] of Object.entries(schema.commonFields)) {
          const fieldExist = await fieldExists(tableName, fieldName);
          if (!fieldExist) {
            console.log(`  → Champ commun ${fieldName} manquant, ajout...`);
            await addField(tableName, fieldName, fieldDef);
          }
        }
      }
    }

    console.log('\n════════════════════════════════════════════════════════');
    console.log('✓ Vérification de la base de données terminée');
    console.log('════════════════════════════════════════════════════════\n');

  } catch (error) {
    console.error('\n✗ Erreur lors de la synchronisation de la base de données:', error.message);
  }
}

module.exports = { syncDatabase };
