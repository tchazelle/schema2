const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const schema = require('../../schema.js');
const { mustacheAuto } = require('../../utils/mustacheAuto');

// Fonction utilitaire pour générer le HTML de debug
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
 * GET /_debug/template
 * Page de debug des templates Mustache pour les pages : data / template / render
 */
router.get('/template', async (req, res) => {
  try {
    const user = req.user || { roles: 'public' };

    // Récupérer toutes les pages accessibles
    const [pages] = await pool.query('SELECT id, slug, name FROM Page ORDER BY position ASC');

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Debug Templates - Mustache</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
    }
    .container { max-width: 1800px; margin: 0 auto; }
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
    .control-group select {
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
    .results {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
    }
    .result-panel {
      background: #252526;
      border-radius: 4px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
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
      overflow-y: auto;
      max-height: 80vh;
      flex: 1;
    }
    .result-content.render {
      background: white;
      color: #333;
    }
    pre {
      margin: 0;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #d4d4d4;
      white-space: pre-wrap;
      word-wrap: break-word;
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
    <h1>Debug Templates Mustache</h1>
    <div class="subtitle">Visualisation : Data / Template / Render</div>

    <div class="nav">
      <a href="/">← Accueil</a>
      <a href="/_debug/">Debug Index</a>
      <a href="/_debug/api">Debug API</a>
    </div>

    <div class="controls">
      <h2>Sélection de la page</h2>

      <div class="control-group">
        <label for="page-select">Page:</label>
        <select id="page-select">
          <option value="">-- Sélectionner une page --</option>
          ${pages.map(page => `<option value="${page.slug || page.id}">${page.name || page.slug || 'Page ' + page.id}</option>`).join('')}
        </select>
      </div>

      <div class="control-group">
        <label></label>
        <button onclick="loadPageTemplate()">Charger la page</button>
        <button onclick="generateAutoTemplate()">Générer template automatique</button>
      </div>
    </div>

    <div class="results" id="results-container">
      <div class="result-panel">
        <div class="result-header">
          <h3>Data (via dataForMustache)</h3>
        </div>
        <div class="result-content" id="data-content">
          <div class="loading">Aucune donnée chargée</div>
        </div>
      </div>

      <div class="result-panel">
        <div class="result-header">
          <h3>Template Mustache</h3>
        </div>
        <div class="result-content" id="template-content">
          <div class="loading">Aucun template chargé</div>
        </div>
      </div>

      <div class="result-panel">
        <div class="result-header">
          <h3>Render HTML</h3>
        </div>
        <div class="result-content render" id="render-content">
          <div class="loading">Aucun rendu disponible</div>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/mustache@4.2.0/mustache.min.js"></script>
  <script>
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

    // Reproduction de la logique du proxy dataForMustache côté client
    function applyDataForMustacheProxy(data) {
      if (Array.isArray(data)) {
        return data.map(item => applyDataForMustacheProxy(item));
      }

      if (!data || typeof data !== 'object') {
        return data;
      }

      const result = {};

      // Copier toutes les propriétés sauf "_relations"
      for (const key in data) {
        if (key === '_relations') continue;

        if (data[key] && typeof data[key] === 'object') {
          result[key] = applyDataForMustacheProxy(data[key]);
        } else {
          result[key] = data[key];
        }
      }

      // Ajouter les relations comme propriétés directes
      if (data._relations) {
        for (const relKey in data._relations) {
          if (Array.isArray(data._relations[relKey])) {
            result[relKey] = data._relations[relKey].map(item => applyDataForMustacheProxy(item));
          } else if (data._relations[relKey] && typeof data._relations[relKey] === 'object') {
            result[relKey] = applyDataForMustacheProxy(data._relations[relKey]);
          } else {
            result[relKey] = data._relations[relKey];
          }
        }
      }

      return result;
    }

    async function loadPageTemplate() {
      const page = document.getElementById('page-select').value;

      if (!page) {
        alert('Veuillez sélectionner une page');
        return;
      }

      const dataContent = document.getElementById('data-content');
      const templateContent = document.getElementById('template-content');
      const renderContent = document.getElementById('render-content');

      dataContent.innerHTML = '<div class="loading">Chargement...</div>';
      templateContent.innerHTML = '<div class="loading">Chargement...</div>';
      renderContent.innerHTML = '<div class="loading">Chargement...</div>';

      try {
        // Charger les données de la page
        const response = await fetch('/_api/_page/' + page);
        const apiData = await response.json();

        // Appliquer le proxy dataForMustache
        const mustacheData = applyDataForMustacheProxy(apiData.page);

        // Afficher les données
        dataContent.innerHTML = '<pre>' + syntaxHighlight(mustacheData) + '</pre>';

        // Utiliser le template de la page ou un template par défaut
        let template = apiData.page.mustache || '<div>Pas de template défini pour cette page</div>';

        // Afficher le template
        templateContent.innerHTML = '<pre>' + template.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';

        // Render le template avec Mustache
        try {
          const rendered = Mustache.render(template, mustacheData);
          renderContent.innerHTML = rendered;
        } catch (err) {
          renderContent.innerHTML = '<div class="error">Erreur de rendu: ' + err.message + '</div>';
        }

      } catch (error) {
        dataContent.innerHTML = '<div class="error">Erreur: ' + error.message + '</div>';
        templateContent.innerHTML = '<div class="error">Erreur: ' + error.message + '</div>';
        renderContent.innerHTML = '<div class="error">Erreur: ' + error.message + '</div>';
      }
    }

    async function generateAutoTemplate() {
      const page = document.getElementById('page-select').value;

      if (!page) {
        alert('Veuillez sélectionner une page');
        return;
      }

      const dataContent = document.getElementById('data-content');
      const templateContent = document.getElementById('template-content');
      const renderContent = document.getElementById('render-content');

      dataContent.innerHTML = '<div class="loading">Chargement...</div>';
      templateContent.innerHTML = '<div class="loading">Génération du template...</div>';
      renderContent.innerHTML = '<div class="loading">Chargement...</div>';

      try {
        // Charger les données de la page
        const response = await fetch('/_api/_page/' + page);
        const apiData = await response.json();

        // Appliquer le proxy dataForMustache
        const mustacheData = applyDataForMustacheProxy(apiData.page);

        // Afficher les données
        dataContent.innerHTML = '<pre>' + syntaxHighlight(mustacheData) + '</pre>';

        // Générer automatiquement le template
        const templateResponse = await fetch('/_debug/template/generate/' + page);
        const templateData = await templateResponse.json();

        const template = templateData.template;

        // Afficher le template
        templateContent.innerHTML = '<pre>' + template.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';

        // Render le template avec Mustache
        try {
          const rendered = Mustache.render(template, mustacheData);
          renderContent.innerHTML = rendered;
        } catch (err) {
          renderContent.innerHTML = '<div class="error">Erreur de rendu: ' + err.message + '</div>';
        }

      } catch (error) {
        dataContent.innerHTML = '<div class="error">Erreur: ' + error.message + '</div>';
        templateContent.innerHTML = '<div class="error">Erreur: ' + error.message + '</div>';
        renderContent.innerHTML = '<div class="error">Erreur: ' + error.message + '</div>';
      }
    }
  </script>
</body>
</html>
    `;

    res.send(html);

  } catch (error) {
    console.error('Erreur lors de la génération de la page debug templates:', error);
    res.status(500).send(generateDebugHTML('Erreur', {
      error: 'Erreur serveur lors de la génération de la page debug templates'
    }));
  }
});

/**
 * GET /_debug/template/generate/:page
 * Génère automatiquement un template Mustache pour une page
 */
router.get('/template/generate/:page', async (req, res) => {
  try {
    const { page } = req.params;

    // Faire un appel interne à l'API pour récupérer les vraies données avec relations
    const apiUrl = `http://localhost:${process.env.PORT || 3000}/_api/_page/${page}`;
    const apiResponse = await fetch(apiUrl, {
      headers: {
        'Cookie': req.headers.cookie || '' // Transmettre les cookies pour l'auth
      }
    });

    if (!apiResponse.ok) {
      return res.status(apiResponse.status).json({
        error: 'Erreur lors de la récupération des données de la page'
      });
    }

    const apiData = await apiResponse.json();

    // Note: Génération automatique de templates de pages désactivée
    // Utiliser mustacheAuto pour générer des templates de tables individuelles
    const template = '<div>Génération automatique de templates de pages non supportée. Utilisez mustacheAuto pour les tables.</div>';

    res.json({
      success: true,
      page: page,
      template: template,
      data: apiData // Inclure aussi les données pour le debug
    });

  } catch (error) {
    console.error('Erreur lors de la génération du template:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la génération du template',
      details: error.message
    });
  }
});

/**
 * GET /_debug/table-template
 * Page de debug des templates Mustache pour les tables : data / template / render
 */
router.get('/table-template', async (req, res) => {
  try {
    // Récupérer toutes les tables du schéma
    const tables = Object.keys(schema.tables).sort();

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Debug Templates Tables - Mustache</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, monospace;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
    }
    .container { max-width: 1800px; margin: 0 auto; }
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
    .control-group select {
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
    .results {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 20px;
    }
    .result-panel {
      background: #252526;
      border-radius: 4px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
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
      overflow-y: auto;
      max-height: 80vh;
      flex: 1;
    }
    .result-content.render {
      background: white;
      color: #333;
    }
    pre {
      margin: 0;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #d4d4d4;
      white-space: pre-wrap;
      word-wrap: break-word;
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
    <h1>Debug Templates Mustache - Tables</h1>
    <div class="subtitle">Visualisation : Data / Template / Render (Template Simple)</div>

    <div class="nav">
      <a href="/">← Accueil</a>
      <a href="/_debug/">Debug Index</a>
      <a href="/_debug/template">Debug Templates Pages</a>
      <a href="/_debug/api">Debug API</a>
    </div>

    <div class="controls">
      <h2>Sélection de la table</h2>

      <div class="control-group">
        <label for="table-select">Table:</label>
        <select id="table-select">
          <option value="">-- Sélectionner une table --</option>
          ${tables.map(table => `<option value="${table}">${table}</option>`).join('')}
        </select>
      </div>

      <div class="control-group">
        <label></label>
        <button onclick="loadTableTemplate()">Charger les données et template</button>
      </div>
    </div>

    <div class="results" id="results-container">
      <div class="result-panel">
        <div class="result-header">
          <h3>Data (premières lignes)</h3>
        </div>
        <div class="result-content" id="data-content">
          <div class="loading">Aucune donnée chargée</div>
        </div>
      </div>

      <div class="result-panel">
        <div class="result-header">
          <h3>Template Mustache Simple</h3>
        </div>
        <div class="result-content" id="template-content">
          <div class="loading">Aucun template chargé</div>
        </div>
      </div>

      <div class="result-panel">
        <div class="result-header">
          <h3>Render HTML</h3>
        </div>
        <div class="result-content render" id="render-content">
          <div class="loading">Aucun rendu disponible</div>
        </div>
      </div>
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/mustache@4.2.0/mustache.min.js"></script>
  <script>
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

    async function loadTableTemplate() {
      const table = document.getElementById('table-select').value;

      if (!table) {
        alert('Veuillez sélectionner une table');
        return;
      }

      const dataContent = document.getElementById('data-content');
      const templateContent = document.getElementById('template-content');
      const renderContent = document.getElementById('render-content');

      dataContent.innerHTML = '<div class="loading">Chargement...</div>';
      templateContent.innerHTML = '<div class="loading">Chargement...</div>';
      renderContent.innerHTML = '<div class="loading">Chargement...</div>';

      try {
        // Charger les données de la table et le template
        const response = await fetch('/_debug/table-template/data/' + table);
        const result = await response.json();

        if (result.error) {
          throw new Error(result.error);
        }

        // Afficher les données
        const dataForDisplay = { rows: result.data };
        dataContent.innerHTML = '<pre>' + syntaxHighlight(dataForDisplay) + '</pre>';

        // Afficher le template
        const template = result.template;
        templateContent.innerHTML = '<pre>' + template.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</pre>';

        // Render le template avec Mustache
        try {
          const rendered = Mustache.render(template, dataForDisplay);
          renderContent.innerHTML = rendered;
        } catch (err) {
          renderContent.innerHTML = '<div class="error">Erreur de rendu: ' + err.message + '</div>';
        }

      } catch (error) {
        dataContent.innerHTML = '<div class="error">Erreur: ' + error.message + '</div>';
        templateContent.innerHTML = '<div class="error">Erreur: ' + error.message + '</div>';
        renderContent.innerHTML = '<div class="error">Erreur: ' + error.message + '</div>';
      }
    }
  </script>
</body>
</html>
    `;

    res.send(html);

  } catch (error) {
    console.error('Erreur lors de la génération de la page debug table-template:', error);
    res.status(500).send(generateDebugHTML('Erreur', {
      error: 'Erreur serveur lors de la génération de la page debug table-template'
    }));
  }
});

/**
 * GET /_debug/table-template/data/:table
 * Récupère les données d'une table et génère son template simple
 */
router.get('/table-template/data/:table', async (req, res) => {
  try {
    const { table } = req.params;

    // Vérifier que la table existe dans le schéma
    if (!schema.tables[table]) {
      return res.status(404).json({
        error: `Table ${table} introuvable dans le schéma`
      });
    }

    // Récupérer les premières lignes de la table (limité à 10 pour le debug)
    const [rows] = await pool.query(`SELECT * FROM ${table} LIMIT 10`);

    // Générer le template avec mustacheAuto
    const template = mustacheAuto(table);

    res.json({
      success: true,
      table: table,
      template: template,
      data: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des données de la table:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération des données',
      details: error.message
    });
  }
});

/**
 * GET /_debug/api/page
 * Page de test pour l'API des pages avec et sans proxy dataForMustache
 */
router.get('/api/page', async (req, res) => {
  try {
    const user = req.user || { roles: 'public' };

    // Récupérer toutes les pages accessibles
    const [pages] = await pool.query('SELECT id, slug, name FROM Page ORDER BY position ASC');

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Debug API - Pages</title>
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
    <h1>Debug API - Pages</h1>
    <div class="subtitle">Test de l'API des pages avec et sans proxy dataForMustache</div>

    <div class="nav">
      <a href="/">← Accueil</a>
      <a href="/_debug/">Debug Index</a>
      <a href="/_debug/api">Debug API Tables</a>
      <a href="/_debug/api/section">Debug API Sections</a>
    </div>

    <div class="controls">
      <h2>Paramètres de requête</h2>

      <div class="control-group">
        <label for="page-select">Page:</label>
        <select id="page-select">
          <option value="">-- Sélectionner une page --</option>
          ${pages.map(page => `<option value="${page.slug || page.id}">${page.name || page.slug || 'Page ' + page.id}</option>`).join('')}
        </select>
      </div>

      <div class="control-group">
        <label for="query-input">Query params:</label>
        <input type="text" id="query-input" placeholder="ex: limit=10&status=active">
      </div>

      <div class="control-group">
        <label></label>
        <button onclick="loadPageData()">Charger les données</button>
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
          <h3>Retour brut de l'API</h3>
        </div>
        <div class="result-content" id="raw-content">
          <div class="loading">Aucune donnée chargée</div>
        </div>
      </div>

      <div class="result-panel" id="proxy-panel">
        <div class="result-header">
          <h3>Retour via proxy dataForMustache</h3>
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

    async function loadPageData() {
      const page = document.getElementById('page-select').value;
      const queryInput = document.getElementById('query-input').value.trim();

      if (!page) {
        alert('Veuillez sélectionner une page');
        return;
      }

      const rawContent = document.getElementById('raw-content');
      const proxyContent = document.getElementById('proxy-content');

      rawContent.innerHTML = '<div class="loading">Chargement...</div>';
      proxyContent.innerHTML = '<div class="loading">Chargement...</div>';

      try {
        // Construire l'URL
        let url = '/_api/_page/' + page;

        if (queryInput) {
          url += '?' + queryInput;
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
        rawContent.innerHTML = '<div class="error">Erreur: ' + error.message + '</div>';
        proxyContent.innerHTML = '<div class="error">Erreur: ' + error.message + '</div>';
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

      // Copier toutes les propriétés sauf "_relations"
      for (const key in data) {
        if (key === '_relations') continue;

        if (data[key] && typeof data[key] === 'object') {
          result[key] = applyDataForMustacheProxy(data[key]);
        } else {
          result[key] = data[key];
        }
      }

      // Ajouter les relations comme propriétés directes
      if (data._relations) {
        for (const relKey in data._relations) {
          if (Array.isArray(data._relations[relKey])) {
            // Relation 1:n - proxifier chaque élément
            result[relKey] = data._relations[relKey].map(item => applyDataForMustacheProxy(item));
          } else if (data._relations[relKey] && typeof data._relations[relKey] === 'object') {
            // Relation n:1 - proxifier l'objet
            result[relKey] = applyDataForMustacheProxy(data._relations[relKey]);
          } else {
            result[relKey] = data._relations[relKey];
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
    console.error('Erreur lors de la génération de la page debug API pages:', error);
    res.status(500).send(generateDebugHTML('Erreur', {
      error: 'Erreur serveur lors de la génération de la page debug API pages'
    }));
  }
});

/**
 * GET /_debug/mustache-auto/:table
 * Génère un template Mustache automatique pour une table donnée
 * en se basant exclusivement sur schema.js
 */
router.get('/mustache-auto/:table', async (req, res) => {
  try {
    const table = req.params.table;

    // Vérifier que la table existe dans le schéma
    if (!schema.tables[table]) {
      return res.status(404).send(generateDebugHTML('Table introuvable', {
        error: `La table "${table}" n'existe pas dans le schéma`
      }));
    }

    // Générer le template automatique
    const template = mustacheAuto(table);

    // Créer l'interface HTML pour afficher le template
    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mustache Auto - ${table}</title>
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
    .section {
      background: #252526;
      padding: 20px;
      border-radius: 4px;
      margin-bottom: 20px;
    }
    .section h2 {
      color: #4ec9b0;
      font-size: 18px;
      margin-bottom: 15px;
    }
    .template-display {
      background: #1e1e1e;
      border: 1px solid #3c3c3c;
      border-radius: 4px;
      padding: 20px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      line-height: 1.6;
      overflow-x: auto;
      white-space: pre;
      color: #d4d4d4;
    }
    .copy-btn {
      margin-top: 15px;
      padding: 10px 20px;
      background: #0e639c;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      transition: background 0.2s;
    }
    .copy-btn:hover {
      background: #1177bb;
    }
    .info {
      background: #264f78;
      color: #9cdcfe;
      padding: 15px;
      border-radius: 4px;
      margin-bottom: 20px;
      font-size: 14px;
    }
    .table-selector {
      margin-bottom: 20px;
    }
    .table-selector select {
      padding: 10px 15px;
      background: #3c3c3c;
      color: #d4d4d4;
      border: 1px solid #555;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      min-width: 250px;
    }
    .table-selector select:focus {
      outline: none;
      border-color: #0e639c;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Template Mustache Auto - ${table}</h1>
    <div class="subtitle">Généré automatiquement depuis schema.js</div>

    <div class="nav">
      <a href="/">← Accueil</a>
      <a href="/_debug/">Debug Index</a>
      <a href="/_debug/template">Templates Pages</a>
      <a href="/_debug/table-template">Templates Tables</a>
    </div>

    <div class="info">
      Ce template a été généré automatiquement à partir de la définition de la table dans <strong>schema.js</strong>.
      Il inclut tous les champs, les relations n:1 (manyToOne) et les relations 1:n (oneToMany).
    </div>

    <div class="table-selector">
      <label for="tableSelect" style="color: #9cdcfe; margin-right: 10px;">Changer de table :</label>
      <select id="tableSelect" onchange="window.location.href = '/_debug/mustache-auto/' + this.value">
        ${Object.keys(schema.tables).map(t =>
          `<option value="${t}" ${t === table ? 'selected' : ''}>${t}</option>`
        ).join('\n        ')}
      </select>
    </div>

    <div class="section">
      <h2>Template généré</h2>
      <div class="template-display" id="templateDisplay">${escapeHtml(template)}</div>
      <button class="copy-btn" onclick="copyTemplate()">📋 Copier le template</button>
    </div>

    <div class="section">
      <h2>Structure de la table ${table}</h2>
      <div class="template-display">${escapeHtml(JSON.stringify(schema.tables[table], null, 2))}</div>
    </div>
  </div>

  <script>
    function escapeHtml(text) {
      return text;
    }

    function copyTemplate() {
      const templateText = document.getElementById('templateDisplay').textContent;
      navigator.clipboard.writeText(templateText).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = '✓ Copié !';
        btn.style.background = '#28a745';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = '#0e639c';
        }, 2000);
      }).catch(err => {
        alert('Erreur lors de la copie: ' + err);
      });
    }
  </script>
</body>
</html>
    `;

    res.send(html);

  } catch (error) {
    console.error('Erreur lors de la génération du template automatique:', error);
    res.status(500).send(generateDebugHTML('Erreur', {
      error: 'Erreur serveur lors de la génération du template automatique: ' + error.message
    }));
  }
});

// Fonction helper pour échapper le HTML
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

module.exports = router;
