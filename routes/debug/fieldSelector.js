const express = require('express');
const router = express.Router();
const schema = require('../../schema.js');
const { generateDebugHTML } = require('./utils');

/**
 * GET /_debug/fieldSelector/:table
 * Page de sélection de champs avec interface interactive
 */
router.get('/:table', async (req, res) => {
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

module.exports = router;
