/**
 * Utilitaires pour les routes de debug
 */

/**
 * Génère une page HTML de debug avec un template simple
 * @param {string} title - Titre de la page
 * @param {Object} data - Données à afficher
 * @returns {string} HTML généré
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

module.exports = { generateDebugHTML };
