const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const schema = require('../../schema.js');

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
          <li><a href="/_debug/api/section">Debug API Sections</a></li>
          <li><a href="/_debug/api/page">Debug API Pages</a></li>
          <li><a href="/_debug/json">Debug JSON Navigator</a></li>
        </ul>
      </div>

      <div class="section">
        <h2>🎨 Templates</h2>
        <ul>
          <li><a href="/_debug/template">Debug Templates Pages (data/template/render)</a></li>
          <li><a href="/_debug/table-template">Debug Templates Tables (sélecteur de table)</a></li>
        </ul>
      </div>

      <div class="section">
        <h2>⚡ Mustache Auto</h2>
        <ul>
          <li><a href="/_debug/mustache-auto/MusicAlbum">Templates automatiques (basé sur schema.js)</a></li>
          ${tables.map(table => `
            <li><a href="/_debug/mustache-auto/${table}">${table}</a></li>
          `).join('')}
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
 * Fonction utilitaire pour générer du HTML de debug
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

module.exports = router;
