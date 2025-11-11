const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { getUserAllRoles, getAllPermissions, getInheritedRoles } = require('../utils/permissions');
const schema = require('../schema.js');

/**
 * GET /debug/user
 * Affiche la fiche complète de l'utilisateur connecté
 */
router.get('/user', async (req, res) => {
  try {
    // Vérifier si l'utilisateur est connecté
    if (!req.user) {
      return res.send(generateDebugHTML('Utilisateur non connecté', {
        message: 'Aucun utilisateur connecté',
        info: 'Veuillez vous connecter pour voir votre fiche utilisateur'
      }));
    }

    // Récupérer les informations complètes de l'utilisateur depuis la base de données
    const [users] = await pool.query(
      'SELECT * FROM Person WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).send(generateDebugHTML('Utilisateur introuvable', {
        error: 'Utilisateur introuvable dans la base de données'
      }));
    }

    const user = users[0];
    const allRoles = getUserAllRoles(user);

    // Masquer le mot de passe pour l'affichage
    const userDisplay = { ...user };
    if (userDisplay.password) {
      userDisplay.password = '********';
    }

    const data = {
      'ID': user.id,
      'Prénom': user.givenName || '-',
      'Nom': user.familyName || '-',
      'Email': user.email || '-',
      'Téléphone': user.telephone || '-',
      'Rôles directs': user.roles || 'public',
      'Tous les rôles (avec héritage)': allRoles.join(', '),
      'Actif': user.isActive ? 'Oui' : 'Non',
      'Créé le': user.createdAt || '-',
      'Mis à jour le': user.updatedAt || '-',
      'Propriétaire ID': user.ownerId || '-',
      'Granted': user.granted || '-'
    };

    res.send(generateDebugHTML('Fiche Utilisateur', data));

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    res.status(500).send(generateDebugHTML('Erreur', {
      error: 'Erreur serveur lors de la récupération des données utilisateur'
    }));
  }
});

/**
 * GET /debug/user/grant
 * Affiche toutes les autorisations héritées de l'utilisateur
 */
router.get('/user/grant', async (req, res) => {
  try {
    // Vérifier si l'utilisateur est connecté
    if (!req.user) {
      return res.send(generateDebugHTML('Utilisateur non connecté', {
        message: 'Aucun utilisateur connecté',
        info: 'Veuillez vous connecter pour voir vos autorisations'
      }));
    }

    // Récupérer les informations de l'utilisateur depuis la base de données
    const [users] = await pool.query(
      'SELECT * FROM Person WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).send(generateDebugHTML('Utilisateur introuvable', {
        error: 'Utilisateur introuvable dans la base de données'
      }));
    }

    const user = users[0];
    const allRoles = getUserAllRoles(user);
    const permissions = getAllPermissions(user);

    // Créer le HTML pour l'affichage des permissions
    let html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Autorisations - ${user.givenName || ''} ${user.familyName || ''}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
    .subtitle { color: #666; margin-bottom: 30px; }
    .nav { margin-bottom: 30px; }
    .nav a {
      display: inline-block;
      margin-right: 15px;
      padding: 8px 16px;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 14px;
    }
    .nav a:hover { background: #0056b3; }
    .section { margin-bottom: 30px; }
    .section h2 { color: #555; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #007bff; padding-bottom: 8px; }
    .roles-list { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
    .role-badge {
      padding: 6px 12px;
      background: #e3f2fd;
      color: #1976d2;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
    }
    .permissions-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .permissions-table th {
      background: #f8f9fa;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #dee2e6;
      color: #495057;
    }
    .permissions-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #dee2e6;
    }
    .permissions-table tbody tr:hover { background: #f8f9fa; }
    .permission-cell { text-align: center; }
    .permission-yes { color: #28a745; font-weight: bold; }
    .permission-no { color: #dc3545; }
    .role-inheritance { margin-top: 30px; }
    .inheritance-item {
      margin-bottom: 15px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 4px;
    }
    .inheritance-item h3 {
      color: #333;
      font-size: 16px;
      margin-bottom: 8px;
    }
    .inheritance-item p {
      color: #666;
      font-size: 14px;
    }
    .inheritance-chain {
      margin-top: 8px;
      font-size: 14px;
      color: #007bff;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Autorisations héritées</h1>
    <div class="subtitle">Utilisateur: ${user.givenName || ''} ${user.familyName || ''} (${user.email})</div>

    <div class="nav">
      <a href="/">← Accueil</a>
      <a href="/_debug/">Debug Index</a>
      <a href="/_debug/user">Fiche utilisateur</a>
    </div>

    <div class="section">
      <h2>Rôles de l'utilisateur</h2>
      <div class="roles-list">
        ${allRoles.map(role => `<span class="role-badge">${role}</span>`).join('')}
      </div>
    </div>

    <div class="section">
      <h2>Permissions par table</h2>
      <table class="permissions-table">
        <thead>
          <tr>
            <th>Table</th>
            <th class="permission-cell">Read</th>
            <th class="permission-cell">Create</th>
            <th class="permission-cell">Update</th>
            <th class="permission-cell">Delete</th>
            <th class="permission-cell">Publish</th>
          </tr>
        </thead>
        <tbody>
    `;

    // Ajouter les permissions pour chaque table
    for (const tableName in permissions) {
      const tablePerms = permissions[tableName];
      html += `
          <tr>
            <td><strong>${tableName}</strong></td>
            <td class="permission-cell ${tablePerms.read ? 'permission-yes' : 'permission-no'}">
              ${tablePerms.read ? '✓' : '✗'}
            </td>
            <td class="permission-cell ${tablePerms.create ? 'permission-yes' : 'permission-no'}">
              ${tablePerms.create ? '✓' : '✗'}
            </td>
            <td class="permission-cell ${tablePerms.update ? 'permission-yes' : 'permission-no'}">
              ${tablePerms.update ? '✓' : '✗'}
            </td>
            <td class="permission-cell ${tablePerms.delete ? 'permission-yes' : 'permission-no'}">
              ${tablePerms.delete ? '✓' : '✗'}
            </td>
            <td class="permission-cell ${tablePerms.publish ? 'permission-yes' : 'permission-no'}">
              ${tablePerms.publish ? '✓' : '✗'}
            </td>
          </tr>
      `;
    }

    html += `
        </tbody>
      </table>
    </div>

    <div class="section role-inheritance">
      <h2>Héritage des rôles</h2>
    `;

    // Afficher l'héritage pour chaque rôle
    for (const role of allRoles) {
      if (schema.roles[role]) {
        const inherited = getInheritedRoles(role);
        html += `
      <div class="inheritance-item">
        <h3>${role}</h3>
        <p>${schema.roles[role].description}</p>
        <div class="inheritance-chain">
          Hérite de: ${schema.roles[role].inherits.length > 0 ? schema.roles[role].inherits.join(', ') : 'aucun'}
        </div>
        <div class="inheritance-chain">
          Tous les rôles hérités: ${inherited.join(' → ')}
        </div>
      </div>
        `;
      }
    }

    html += `
    </div>
  </div>
</body>
</html>
    `;

    res.send(html);

  } catch (error) {
    console.error('Erreur lors de la récupération des autorisations:', error);
    res.status(500).send(generateDebugHTML('Erreur', {
      error: 'Erreur serveur lors de la récupération des autorisations'
    }));
  }
});

/**
 * Fonction utilitaire pour générer le HTML de debug
 */
function generateDebugHTML(title, data) {
  let html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-bottom: 30px; font-size: 24px; }
    .nav { margin-bottom: 30px; }
    .nav a {
      display: inline-block;
      margin-right: 15px;
      padding: 8px 16px;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 14px;
    }
    .nav a:hover { background: #0056b3; }
    table { width: 100%; border-collapse: collapse; }
    tr { border-bottom: 1px solid #eee; }
    td { padding: 12px 8px; }
    td:first-child { font-weight: 600; color: #555; width: 40%; }
    td:last-child { color: #333; }
    .error { color: #dc3545; padding: 20px; background: #f8d7da; border-radius: 4px; }
    .info { color: #0c5460; padding: 20px; background: #d1ecf1; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${title}</h1>
    <div class="nav">
      <a href="/">← Accueil</a>
      <a href="/_debug/">Debug Index</a>
      <a href="/_debug/user">Fiche utilisateur</a>
      <a href="/_debug/user/grant">Autorisations</a>
    </div>
  `;

  if (data.error) {
    html += `<div class="error">${data.error}</div>`;
  } else if (data.message) {
    html += `<div class="info">${data.message}</div>`;
    if (data.info) {
      html += `<div class="info" style="margin-top: 10px;">${data.info}</div>`;
    }
  } else {
    html += '<table>';
    for (const [key, value] of Object.entries(data)) {
      html += `<tr><td>${key}</td><td>${value}</td></tr>`;
    }
    html += '</table>';
  }

  html += `
  </div>
</body>
</html>
  `;

  return html;
}

/**
 * GET /_debug/
 * Page d'index des routes de debug
 */
router.get('/', async (req, res) => {
  try {
    const user = req.user || { roles: 'public' };
    const isAuthenticated = !!req.user;

    // Récupérer toutes les tables du schéma
    const tables = Object.keys(schema.tables);

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Debug - Index</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container { max-width: 1000px; margin: 0 auto; }
    h1 { color: #333; margin-bottom: 10px; font-size: 28px; }
    .subtitle { color: #666; margin-bottom: 30px; font-size: 14px; }
    .nav {
      margin-bottom: 30px;
      padding: 15px;
      background: white;
      border-radius: 8px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .nav a {
      padding: 8px 16px;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 14px;
      transition: background 0.2s;
    }
    .nav a:hover { background: #0056b3; }
    .section {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .section h2 {
      color: #333;
      font-size: 18px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #007bff;
    }
    .section ul {
      list-style: none;
    }
    .section li {
      margin-bottom: 8px;
    }
    .section a {
      color: #007bff;
      text-decoration: none;
      display: block;
      padding: 8px 12px;
      border-radius: 4px;
      transition: background 0.2s;
    }
    .section a:hover {
      background: #f0f0f0;
    }
    .section a::before {
      content: '›';
      margin-right: 8px;
      color: #adb5bd;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔧 Debug - Index</h1>
    <div class="subtitle">Outils de développement et débogage</div>

    <div class="nav">
      <a href="/">← Accueil</a>
    </div>

    <div class="grid">
      ${isAuthenticated ? `
      <div class="section">
        <h2>👤 Utilisateur</h2>
        <ul>
          <li><a href="/_debug/user">Fiche utilisateur</a></li>
          <li><a href="/_debug/user/grant">Autorisations</a></li>
        </ul>
      </div>
      ` : ''}

      <div class="section">
        <h2>🔍 Données</h2>
        <ul>
          <li><a href="/_debug/api">Debug API avec proxy Mustache</a></li>
          <li><a href="/_debug/json">Debug JSON Navigator</a></li>
        </ul>
      </div>

      <div class="section">
        <h2>🧩 Field Selector UI</h2>
        <ul>
          ${tables.map(table => `
            <li><a href="/_debug/fieldSelector/${table}">${table}</a></li>
          `).join('')}
        </ul>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    res.send(html);

  } catch (error) {
    console.error('Erreur lors de la génération de la page debug index:', error);
    res.status(500).send(generateDebugHTML('Erreur', {
      error: 'Erreur serveur lors de la génération de la page debug index'
    }));
  }
});

/**
 * GET /_debug/fieldSelector/:table
 * Page de test pour le composant fieldSelectorUI
 */
router.get('/fieldSelector/:table', async (req, res) => {
  try {
    const { table } = req.params;
    const user = req.user || { roles: 'public' };

    // Vérifier si la table existe
    if (!schema.tables[table]) {
      return res.status(404).send(generateDebugHTML('Table non trouvée', {
        error: `La table "${table}" n'existe pas dans le schéma`
      }));
    }

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Field Selector - ${table}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container { max-width: 1000px; margin: 0 auto; }
    h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
    .subtitle { color: #666; margin-bottom: 20px; font-size: 14px; }
    .nav {
      margin-bottom: 20px;
      padding: 15px;
      background: white;
      border-radius: 8px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .nav a {
      padding: 8px 16px;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 14px;
      transition: background 0.2s;
    }
    .nav a:hover { background: #0056b3; }
    .demo-section {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .demo-section h2 {
      color: #333;
      font-size: 18px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #007bff;
    }
    .output-section {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .output-section h2 {
      color: #333;
      font-size: 18px;
      margin-bottom: 15px;
    }
    .output-content {
      background: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 14px;
      color: #333;
      min-height: 60px;
    }
    .output-label {
      font-weight: 600;
      color: #495057;
      margin-bottom: 5px;
    }
    .output-value {
      color: #007bff;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Field Selector UI - Test</h1>
    <div class="subtitle">Table: ${table}</div>

    <div class="nav">
      <a href="/">← Accueil</a>
      <a href="/_debug/">Debug Index</a>
      <a href="/_debug/json">Debug JSON</a>
      <a href="/_debug/user">Fiche utilisateur</a>
    </div>

    <div class="demo-section">
      <h2>Démo du composant</h2>
      <div id="field-selector-container"></div>
    </div>

    <div class="output-section">
      <h2>Sortie de sélection</h2>
      <div class="output-content">
        <div class="output-label">Chemin sélectionné :</div>
        <div class="output-value" id="output-path">Aucun champ sélectionné</div>
        <br>
        <div class="output-label">Détails du champ :</div>
        <div class="output-value" id="output-details">-</div>
      </div>
    </div>
  </div>

  <script src="/js/fieldSelectorUI.js"></script>
  <script>
    // Initialiser le field selector
    let fieldSelectorInstance;

    document.addEventListener('DOMContentLoaded', async () => {
      const container = document.getElementById('field-selector-container');

      fieldSelectorInstance = new FieldSelectorUI({
        table: '${table}',
        container: container,
        showSystemFields: false,
        onFieldSelect: (path, field) => {
          document.getElementById('output-path').textContent = path;
          document.getElementById('output-details').textContent = JSON.stringify(field, null, 2);
        }
      });

      try {
        await fieldSelectorInstance.init();
      } catch (error) {
        container.innerHTML = '<div style="color: red; padding: 20px;">Erreur lors du chargement: ' + error.message + '</div>';
      }
    });
  </script>
</body>
</html>
    `;

    res.send(html);

  } catch (error) {
    console.error('Erreur lors de la génération de la page field selector:', error);
    res.status(500).send(generateDebugHTML('Erreur', {
      error: 'Erreur serveur lors de la génération de la page field selector'
    }));
  }
});

/**
 * GET /_debug/api
 * Page de test pour l'API avec et sans proxy dataForMustache
 */
router.get('/api', async (req, res) => {
  try {
    const user = req.user || { roles: 'public' };

    // Récupérer toutes les tables du schéma
    const tables = Object.keys(schema.tables);

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Debug API - Test</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
    }
    .container { max-width: 1600px; margin: 0 auto; }
    h1 { color: #4ec9b0; margin-bottom: 10px; font-size: 24px; }
    .subtitle { color: #9cdcfe; margin-bottom: 20px; font-size: 14px; }
    .nav {
      margin-bottom: 20px;
      padding: 15px;
      background: #252526;
      border-radius: 4px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .nav a {
      padding: 8px 16px;
      background: #0e639c;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 14px;
      transition: background 0.2s;
    }
    .nav a:hover { background: #1177bb; }
    .controls {
      background: #252526;
      padding: 20px;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    .controls h2 {
      color: #4ec9b0;
      font-size: 16px;
      margin-bottom: 15px;
    }
    .control-group {
      display: flex;
      gap: 15px;
      align-items: center;
      margin-bottom: 15px;
      flex-wrap: wrap;
    }
    .control-group label {
      color: #9cdcfe;
      font-size: 14px;
      min-width: 80px;
    }
    .control-group select,
    .control-group input {
      padding: 8px 12px;
      background: #3c3c3c;
      color: #d4d4d4;
      border: 1px solid #555;
      border-radius: 4px;
      font-size: 14px;
      min-width: 200px;
    }
    .control-group button {
      padding: 8px 20px;
      background: #0e639c;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .control-group button:hover {
      background: #1177bb;
    }
    .toggle-buttons {
      display: flex;
      gap: 0;
      background: #3c3c3c;
      border-radius: 4px;
      overflow: hidden;
    }
    .toggle-buttons button {
      padding: 10px 20px;
      background: #3c3c3c;
      color: #d4d4d4;
      border: none;
      cursor: pointer;
      transition: all 0.2s;
      font-size: 14px;
    }
    .toggle-buttons button.active {
      background: #0e639c;
      color: white;
    }
    .toggle-buttons button:hover:not(.active) {
      background: #4a4a4a;
    }
    .results {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    .result-panel {
      background: #252526;
      border-radius: 4px;
      overflow: hidden;
    }
    .result-panel.hidden {
      display: none;
    }
    .result-panel.full-width {
      grid-column: 1 / -1;
    }
    .result-header {
      background: #2d2d30;
      padding: 15px 20px;
      border-bottom: 1px solid #3e3e42;
    }
    .result-header h3 {
      color: #4ec9b0;
      font-size: 16px;
    }
    .result-content {
      padding: 20px;
      overflow-x: auto;
      max-height: 80vh;
    }
    pre {
      margin: 0;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #d4d4d4;
    }
    .json-key { color: #9cdcfe; }
    .json-string { color: #ce9178; }
    .json-number { color: #b5cea8; }
    .json-boolean { color: #569cd6; }
    .json-null { color: #569cd6; }
    .loading {
      text-align: center;
      padding: 40px;
      color: #858585;
    }
    .error {
      color: #f48771;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔬 Debug API</h1>
    <div class="subtitle">Test de l'API avec et sans proxy dataForMustache</div>

    <div class="nav">
      <a href="/">← Accueil</a>
      <a href="/_debug/">Debug Index</a>
      <a href="/_debug/json">Debug JSON</a>
    </div>

    <div class="controls">
      <h2>Paramètres de requête</h2>

      <div class="control-group">
        <label for="table-select">Table:</label>
        <select id="table-select">
          <option value="">-- Sélectionner une table --</option>
          ${tables.map(table => `<option value="${table}">${table}</option>`).join('')}
        </select>
      </div>

      <div class="control-group">
        <label for="id-input">ID (optionnel):</label>
        <input type="text" id="id-input" placeholder="Laisser vide pour liste complète">
      </div>

      <div class="control-group">
        <label for="relation-input">Relations:</label>
        <input type="text" id="relation-input" placeholder="ex: member,album ou 'all'" value="all">
      </div>

      <div class="control-group">
        <label></label>
        <button onclick="loadApiData()">🔄 Charger les données</button>
      </div>

      <div class="control-group">
        <label>Affichage:</label>
        <div class="toggle-buttons">
          <button id="toggle-both" class="active" onclick="setViewMode('both')">Les deux</button>
          <button id="toggle-raw" onclick="setViewMode('raw')">Brut uniquement</button>
          <button id="toggle-proxy" onclick="setViewMode('proxy')">Proxy uniquement</button>
        </div>
      </div>
    </div>

    <div class="results" id="results-container">
      <div class="result-panel" id="raw-panel">
        <div class="result-header">
          <h3>📄 Retour brut de l'API</h3>
        </div>
        <div class="result-content" id="raw-content">
          <div class="loading">Aucune donnée chargée</div>
        </div>
      </div>

      <div class="result-panel" id="proxy-panel">
        <div class="result-header">
          <h3>✨ Retour via proxy dataForMustache</h3>
        </div>
        <div class="result-content" id="proxy-content">
          <div class="loading">Aucune donnée chargée</div>
        </div>
      </div>
    </div>
  </div>

  <script>
    let currentViewMode = 'both';

    function syntaxHighlight(json) {
      if (typeof json !== 'string') {
        json = JSON.stringify(json, null, 2);
      }
      json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return json.replace(/("(\\\\u[a-zA-Z0-9]{4}|\\\\[^u]|[^\\\\"])*"(\\s*:)?|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?)/g, function (match) {
        var cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      });
    }

    function setViewMode(mode) {
      currentViewMode = mode;

      // Update button states
      document.querySelectorAll('.toggle-buttons button').forEach(btn => btn.classList.remove('active'));
      document.getElementById('toggle-' + mode).classList.add('active');

      // Update panel visibility
      const rawPanel = document.getElementById('raw-panel');
      const proxyPanel = document.getElementById('proxy-panel');

      if (mode === 'both') {
        rawPanel.classList.remove('hidden', 'full-width');
        proxyPanel.classList.remove('hidden', 'full-width');
      } else if (mode === 'raw') {
        rawPanel.classList.remove('hidden');
        rawPanel.classList.add('full-width');
        proxyPanel.classList.add('hidden');
      } else if (mode === 'proxy') {
        rawPanel.classList.add('hidden');
        proxyPanel.classList.remove('hidden');
        proxyPanel.classList.add('full-width');
      }
    }

    async function loadApiData() {
      const table = document.getElementById('table-select').value;
      const id = document.getElementById('id-input').value.trim();
      const relation = document.getElementById('relation-input').value.trim();

      if (!table) {
        alert('Veuillez sélectionner une table');
        return;
      }

      const rawContent = document.getElementById('raw-content');
      const proxyContent = document.getElementById('proxy-content');

      rawContent.innerHTML = '<div class="loading">⏳ Chargement...</div>';
      proxyContent.innerHTML = '<div class="loading">⏳ Chargement...</div>';

      try {
        // Construire l'URL
        let url = '/_api/' + table;
        if (id) {
          url += '/' + id;
        }
        if (relation) {
          url += '?relation=' + encodeURIComponent(relation);
        }

        // Charger les données brutes
        const response = await fetch(url);
        const rawData = await response.json();

        // Afficher les données brutes
        rawContent.innerHTML = '<pre>' + syntaxHighlight(rawData) + '</pre>';

        // Appliquer le proxy et afficher
        const proxiedData = applyDataForMustacheProxy(rawData);
        proxyContent.innerHTML = '<pre>' + syntaxHighlight(proxiedData) + '</pre>';

      } catch (error) {
        rawContent.innerHTML = '<div class="error">❌ Erreur: ' + error.message + '</div>';
        proxyContent.innerHTML = '<div class="error">❌ Erreur: ' + error.message + '</div>';
      }
    }

    // Reproduction de la logique du proxy dataForMustache côté client
    function applyDataForMustacheProxy(data) {
      if (Array.isArray(data)) {
        return data.map(item => applyDataForMustacheProxy(item));
      }

      if (!data || typeof data !== 'object') {
        return data;
      }

      const result = {};

      // Copier toutes les propriétés sauf "relations"
      for (const key in data) {
        if (key === 'relations') continue;

        if (data[key] && typeof data[key] === 'object') {
          result[key] = applyDataForMustacheProxy(data[key]);
        } else {
          result[key] = data[key];
        }
      }

      // Ajouter les relations comme propriétés directes
      if (data.relations) {
        for (const relKey in data.relations) {
          if (Array.isArray(data.relations[relKey])) {
            // Relation 1:n - proxifier chaque élément
            result[relKey] = data.relations[relKey].map(item => applyDataForMustacheProxy(item));
          } else if (data.relations[relKey] && typeof data.relations[relKey] === 'object') {
            // Relation n:1 - proxifier l'objet
            result[relKey] = applyDataForMustacheProxy(data.relations[relKey]);
          } else {
            result[relKey] = data.relations[relKey];
          }
        }
      }

      return result;
    }
  </script>
</body>
</html>
    `;

    res.send(html);

  } catch (error) {
    console.error('Erreur lors de la génération de la page debug API:', error);
    res.status(500).send(generateDebugHTML('Erreur', {
      error: 'Erreur serveur lors de la génération de la page debug API'
    }));
  }
});

/**
 * GET /_debug/json
 * Affiche une page avec menu pour naviguer les JSON des routes /:page et /_crud/:table
 */
router.get('/json', async (req, res) => {
  try {
    const user = req.user || { roles: 'public' };

    // Récupérer toutes les pages accessibles
    const [pages] = await pool.query('SELECT slug, name FROM Page ORDER BY position ASC');

    // Récupérer toutes les tables du schéma
    const tables = Object.keys(schema.tables);

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Debug JSON - Navigation</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
    }
    .container { max-width: 1400px; margin: 0 auto; }
    h1 { color: #4ec9b0; margin-bottom: 10px; font-size: 24px; }
    .subtitle { color: #9cdcfe; margin-bottom: 20px; font-size: 14px; }
    .nav {
      margin-bottom: 20px;
      padding: 15px;
      background: #252526;
      border-radius: 4px;
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .nav a {
      padding: 8px 16px;
      background: #0e639c;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-size: 14px;
      transition: background 0.2s;
    }
    .nav a:hover { background: #1177bb; }
    .main-content {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: 20px;
    }
    .sidebar {
      background: #252526;
      border-radius: 4px;
      padding: 20px;
      height: fit-content;
      position: sticky;
      top: 20px;
    }
    .sidebar h2 {
      color: #4ec9b0;
      font-size: 16px;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #3e3e42;
    }
    .sidebar-section { margin-bottom: 25px; }
    .sidebar-list {
      list-style: none;
    }
    .sidebar-list li {
      margin-bottom: 8px;
    }
    .sidebar-list a {
      color: #9cdcfe;
      text-decoration: none;
      font-size: 14px;
      display: block;
      padding: 6px 10px;
      border-radius: 3px;
      transition: background 0.2s;
    }
    .sidebar-list a:hover {
      background: #2d2d30;
      color: #4fc1ff;
    }
    .content {
      background: #1e1e1e;
      border-radius: 4px;
      overflow: hidden;
    }
    .content-header {
      background: #252526;
      padding: 15px 20px;
      border-bottom: 1px solid #3e3e42;
    }
    .content-header h3 {
      color: #4ec9b0;
      font-size: 18px;
    }
    .json-display {
      padding: 20px;
      background: #1e1e1e;
      overflow-x: auto;
    }
    pre {
      margin: 0;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #d4d4d4;
    }
    .json-key { color: #9cdcfe; }
    .json-string { color: #ce9178; }
    .json-number { color: #b5cea8; }
    .json-boolean { color: #569cd6; }
    .json-null { color: #569cd6; }
    .loading {
      text-align: center;
      padding: 40px;
      color: #858585;
    }
    @media (max-width: 768px) {
      .main-content {
        grid-template-columns: 1fr;
      }
      .sidebar {
        position: relative;
        top: 0;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 Debug JSON Navigator</h1>
    <div class="subtitle">Exploration des structures de données</div>

    <div class="nav">
      <a href="/">← Accueil</a>
      <a href="/_debug/">Debug Index</a>
      <a href="/_debug/user">Fiche utilisateur</a>
      <a href="/_debug/user/grant">Autorisations</a>
    </div>

    <div class="main-content">
      <div class="sidebar">
        <div class="sidebar-section">
          <h2>📄 Pages</h2>
          <ul class="sidebar-list">
            ${pages.map(page => `
              <li><a href="#" onclick="loadPageJson('${page.slug}'); return false;">/${page.slug} - ${page.name}</a></li>
            `).join('')}
          </ul>
        </div>

        <div class="sidebar-section">
          <h2>🗄️ Tables CRUD</h2>
          <ul class="sidebar-list">
            ${tables.map(table => `
              <li><a href="#" onclick="loadCrudJson('${table}'); return false;">${table}</a></li>
            `).join('')}
          </ul>
        </div>
      </div>

      <div class="content">
        <div class="content-header">
          <h3 id="content-title">Sélectionnez une page ou une table</h3>
        </div>
        <div class="json-display" id="json-content">
          <div class="loading">
            👈 Utilisez le menu de gauche pour charger les données JSON
          </div>
        </div>
      </div>
    </div>
  </div>

  <script>
    function syntaxHighlight(json) {
      if (typeof json !== 'string') {
        json = JSON.stringify(json, null, 2);
      }
      json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\\s*:)?|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?)/g, function (match) {
        var cls = 'json-number';
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = 'json-key';
          } else {
            cls = 'json-string';
          }
        } else if (/true|false/.test(match)) {
          cls = 'json-boolean';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return '<span class="' + cls + '">' + match + '</span>';
      });
    }

    async function loadPageJson(slug) {
      const contentTitle = document.getElementById('content-title');
      const jsonContent = document.getElementById('json-content');

      contentTitle.textContent = 'Chargement...';
      jsonContent.innerHTML = '<div class="loading">⏳ Chargement des données...</div>';

      try {
        const response = await fetch('/' + slug);
        const data = await response.json();

        contentTitle.textContent = 'Route: /' + slug;
        jsonContent.innerHTML = '<pre>' + syntaxHighlight(data) + '</pre>';
      } catch (error) {
        contentTitle.textContent = 'Erreur';
        jsonContent.innerHTML = '<div class="loading" style="color: #f48771;">❌ Erreur: ' + error.message + '</div>';
      }
    }

    async function loadCrudJson(table) {
      const contentTitle = document.getElementById('content-title');
      const jsonContent = document.getElementById('json-content');

      contentTitle.textContent = 'Chargement...';
      jsonContent.innerHTML = '<div class="loading">⏳ Chargement des données...</div>';

      try {
        const response = await fetch('/_crud/' + table);
        const data = await response.json();

        contentTitle.textContent = 'Route: /_crud/' + table;
        jsonContent.innerHTML = '<pre>' + syntaxHighlight(data) + '</pre>';
      } catch (error) {
        contentTitle.textContent = 'Erreur';
        jsonContent.innerHTML = '<div class="loading" style="color: #f48771;">❌ Erreur: ' + error.message + '</div>';
      }
    }
  </script>
</body>
</html>
    `;

    res.send(html);

  } catch (error) {
    console.error('Erreur lors de la génération de la page debug JSON:', error);
    res.status(500).send(generateDebugHTML('Erreur', {
      error: 'Erreur serveur lors de la génération de la page debug JSON'
    }));
  }
});

module.exports = router;
