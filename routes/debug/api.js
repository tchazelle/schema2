const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const schema = require('../../schema.js');
const { generateDebugHTML } = require('./utils');

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
        <label>Options:</label>
        <div style="display: flex; gap: 15px; align-items: center;">
          <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; min-width: auto;">
            <input type="checkbox" id="schema-checkbox" style="cursor: pointer; min-width: auto;">
            <span>schema</span>
          </label>
          <label style="display: flex; align-items: center; gap: 5px; cursor: pointer; min-width: auto;">
            <input type="checkbox" id="compact-checkbox" style="cursor: pointer; min-width: auto;">
            <span>compact</span>
          </label>
        </div>
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
      const includeSchema = document.getElementById('schema-checkbox').checked;
      const useCompact = document.getElementById('compact-checkbox').checked;

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

        // Construire les query params
        const params = [];
        if (relation) {
          params.push('relation=' + encodeURIComponent(relation));
        }
        if (includeSchema) {
          params.push('schema=1');
        }
        if (useCompact) {
          params.push('compact=1');
        }

        if (params.length > 0) {
          url += '?' + params.join('&');
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

/**
 * GET /_debug/api/section
 * Page de test pour l'API des sections avec et sans proxy dataForMustache
 */
router.get('/api/section', async (req, res) => {
  try {
    const user = req.user || { roles: 'public' };

    // Récupérer toutes les sections accessibles
    const [sections] = await pool.query('SELECT id, slug, name FROM Section ORDER BY idPage, position ASC');

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Debug API - Sections</title>
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
    <h1>🔬 Debug API - Sections</h1>
    <div class="subtitle">Test de l'API des sections avec et sans proxy dataForMustache</div>

    <div class="nav">
      <a href="/">← Accueil</a>
      <a href="/_debug/">Debug Index</a>
      <a href="/_debug/api">Debug API Tables</a>
      <a href="/_debug/api/page">Debug API Pages</a>
    </div>

    <div class="controls">
      <h2>Paramètres de requête</h2>

      <div class="control-group">
        <label for="section-select">Section:</label>
        <select id="section-select">
          <option value="">-- Sélectionner une section --</option>
          ${sections.map(section => `<option value="${section.slug || section.id}">${section.name || section.slug || 'Section ' + section.id}</option>`).join('')}
        </select>
      </div>

      <div class="control-group">
        <label for="query-input">Query params:</label>
        <input type="text" id="query-input" placeholder="ex: limit=10&status=active">
      </div>

      <div class="control-group">
        <label></label>
        <button onclick="loadSectionData()">🔄 Charger les données</button>
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

    async function loadSectionData() {
      const section = document.getElementById('section-select').value;
      const queryInput = document.getElementById('query-input').value.trim();

      if (!section) {
        alert('Veuillez sélectionner une section');
        return;
      }

      const rawContent = document.getElementById('raw-content');
      const proxyContent = document.getElementById('proxy-content');

      rawContent.innerHTML = '<div class="loading">⏳ Chargement...</div>';
      proxyContent.innerHTML = '<div class="loading">⏳ Chargement...</div>';

      try {
        // Construire l'URL
        let url = '/_api/_section/' + section;

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
    console.error('Erreur lors de la génération de la page debug API sections:', error);
    res.status(500).send(generateDebugHTML('Erreur', {
      error: 'Erreur serveur lors de la génération de la page debug API sections'
    }));
  }
});

module.exports = router;
