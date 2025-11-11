const mysql = require('mysql2/promise');
require('dotenv').config();

// Création du pool de connexions MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'schema2',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: process.env.DB_TIMEZONE || '+00:00'
});

// Test de connexion au démarrage
pool.getConnection()
  .then(connection => {
    console.log('✓ Connexion MySQL établie avec succès');
    connection.release();
  })
  .catch(err => {
    console.error('✗ Erreur de connexion MySQL:', err.message);
  });

module.exports = pool;
