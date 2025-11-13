/**
 * Service pour la génération de templates HTML
 * Extrait les fonctions de génération HTML de routes/pages.js
 */

const schema = require('../../schema.js');

class TemplateService {
  /**
   * Génère le formulaire de connexion HTML
   * @returns {string} - HTML du formulaire de login
   */
  static generateLoginHTML() {
    return `<div class="login-form">
    <h2>Connexion</h2>
    <form id="loginForm" onsubmit="login(event)">
      <div class="form-group">
        <label for="email">Email</label>
        <input type="email" id="email" name="email" required>
      </div>
      <div class="form-group">
        <label for="password">Mot de passe</label>
        <input type="password" id="password" name="password" required>
      </div>
      <button type="submit" class="btn">Se connecter</button>
      <div class="error-message" id="errorMessage"></div>
    </form>
  </div>`;
  }

  /**
   * Génère le script client pour humaniser les dates
   * @returns {string} - HTML avec le script
   */
  static generateHumanizeScript() {
    return `<script>
    // Fonction pour humaniser les dates et durées
    function humanize() {
      const now = new Date();

      // Humaniser les dates
      document.querySelectorAll('[data-date]').forEach(el => {
        const date = new Date(el.getAttribute('data-date'));
        const diff = now - date;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (seconds < 60) {
          el.textContent = \`il y a \${seconds}s\`;
        } else if (minutes < 60) {
          el.textContent = \`il y a \${minutes}min\`;
        } else if (hours < 24) {
          el.textContent = \`il y a \${hours}h\`;
        } else if (days < 30) {
          el.textContent = \`il y a \${days}j\`;
        } else {
          el.textContent = date.toLocaleDateString('fr-FR');
        }
      });

      // Humaniser les durées
      document.querySelectorAll('[data-duration]').forEach(el => {
        const ms = parseInt(el.getAttribute('data-duration'));
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (hours > 0) {
          el.textContent = \`\${hours}h \${minutes % 60}min\`;
        } else if (minutes > 0) {
          el.textContent = \`\${minutes}min \${seconds % 60}s\`;
        } else {
          el.textContent = \`\${seconds}s\`;
        }
      });
    }

    // Appeler au chargement
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', humanize);
    } else {
      humanize();
    }

    // Rafraîchir toutes les minutes
    setInterval(humanize, 60000);
  </script>`;
  }

  /**
   * Génère la page HTML complète avec header, menu et contenu
   * [#TC] Dans la page index, créer un fichier CSS pour alléger le code
   *
   * @param {Object} options - Options de génération
   * @param {Object} options.user - L'utilisateur connecté
   * @param {Array} options.pages - Liste des pages du menu
   * @param {string} options.pageName - Nom de la page actuelle
   * @param {string} options.content - Contenu principal de la page
   * @param {Array} options.accessibleTables - Tables accessibles à l'utilisateur
   * @param {Array} options.allRoles - Tous les rôles de l'utilisateur
   * @param {boolean} options.isAuthenticated - Si l'utilisateur est authentifié
   * @returns {string} - HTML complet de la page
   */
  static generateHomeHTML(options) {
    const {
      user,
      pages,
      pageName,
      content,
      accessibleTables,
      allRoles,
      isAuthenticated
    } = options;

    const userName = user
      ? `${user.givenName || ''} ${user.familyName || ''}`.trim() || user.email
      : 'Invité';

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${schema.appName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #ffffff;
      min-height: 100vh;
    }

    /* Header */
    header {
      background: white;
      border-bottom: 1px solid #e0e0e0;
      padding: 15px 30px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .logo {
      font-size: 20px;
      font-weight: 600;
      color: #333;
    }

    .header-right {
      display: flex;
      align-items: center;
      gap: 15px;
    }

    /* Menu hamburger */
    .menu-toggle {
      background: #007bff;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 18px;
    }
    .menu-toggle:hover { background: #0056b3; }

    .sidebar {
      position: fixed;
      top: 0;
      right: -300px;
      width: 300px;
      height: 100vh;
      background: white;
      box-shadow: -2px 0 8px rgba(0,0,0,0.1);
      transition: right 0.3s ease;
      z-index: 1000;
      overflow-y: auto;
    }

    .sidebar.open { right: 0; }

    .sidebar-header {
      padding: 20px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .sidebar-header-content {
      flex: 1;
    }

    .sidebar-header h2 {
      font-size: 18px;
      color: #333;
      margin-bottom: 5px;
    }

    .sidebar-close {
      background: none;
      border: none;
      font-size: 24px;
      color: #666;
      cursor: pointer;
      padding: 5px 10px;
      line-height: 1;
      transition: color 0.2s;
    }

    .sidebar-close:hover {
      color: #000;
    }

    .sidebar-section {
      padding: 20px;
      border-bottom: 1px solid #e0e0e0;
    }

    .sidebar-section h3 {
      font-size: 14px;
      color: #666;
      text-transform: uppercase;
      margin-bottom: 10px;
      font-weight: 600;
    }

    .sidebar-section ul {
      list-style: none;
    }

    .sidebar-section li {
      margin-bottom: 8px;
    }

    .sidebar-section a {
      color: #007bff;
      text-decoration: none;
      display: block;
      padding: 8px 12px;
      border-radius: 4px;
      transition: background 0.2s;
    }

    .sidebar-section a:hover {
      background: #f0f0f0;
    }

    /* Menu utilisateur */
    .user-menu {
      position: relative;
    }

    .user-button {
      background: #f8f9fa;
      border: 1px solid #e0e0e0;
      padding: 8px 16px;
      border-radius: 20px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .user-button:hover { background: #e9ecef; }

    .user-icon {
      width: 24px;
      height: 24px;
      background: #007bff;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
    }

    .user-dropdown {
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 8px;
      background: white;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      min-width: 200px;
      z-index: 1000;
    }

    .user-dropdown.open { display: block; }

    .user-dropdown a, .user-dropdown button {
      display: block;
      padding: 12px 16px;
      color: #333;
      text-decoration: none;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
      cursor: pointer;
      font-size: 14px;
    }

    .user-dropdown a:hover, .user-dropdown button:hover {
      background: #f8f9fa;
    }

    .user-dropdown .divider {
      height: 1px;
      background: #e0e0e0;
      margin: 8px 0;
    }

    .user-info {
      padding: 12px 16px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 12px;
      color: #666;
    }

    /* Contenu principal */
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .welcome {
      text-align: center;
      margin-bottom: 40px;
    }

    .welcome h1 {
      font-size: 32px;
      color: #333;
      margin-bottom: 10px;
    }

    .welcome p {
      color: #666;
      font-size: 16px;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 40px;
    }

    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
      text-align: center;
    }

    .stat-card h3 {
      font-size: 14px;
      color: #666;
      margin-bottom: 10px;
      text-transform: uppercase;
    }

    .stat-card .number {
      font-size: 32px;
      color: #007bff;
      font-weight: 600;
    }

    /* Overlay pour fermer le menu */
    .overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 999;
    }

    .overlay.open { display: block; }

    /* Formulaire de connexion */
    .login-form {
      max-width: 400px;
      margin: 40px auto;
      background: white;
      padding: 30px;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
    }

    .login-form h2 {
      margin-bottom: 20px;
      color: #333;
    }

    .form-group {
      margin-bottom: 15px;
    }

    .form-group label {
      display: block;
      margin-bottom: 5px;
      color: #555;
      font-size: 14px;
    }

    .form-group input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
    }

    .btn {
      width: 100%;
      padding: 12px;
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
    }

    .btn:hover { background: #0056b3; }

    .error-message {
      color: #dc3545;
      font-size: 14px;
      margin-top: 10px;
      display: none;
    }
  </style>
</head>
<body>
  <!-- Overlay -->
  <div class="overlay" id="overlay" onclick="closeMenu()"></div>

  <!-- Sidebar -->
  <nav class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-header-content">
        <h2>${schema.appName}</h2>
        <p style="color: #666; font-size: 12px;">Version ${schema.version}</p>
      </div>
      <button class="sidebar-close" onclick="closeMenu()" aria-label="Fermer le menu">×</button>
    </div>

    <div class="sidebar-section">
      <ul>
        ${pages.length > 0 ? pages.map(page => `
          <li><a href="/${page.slug}">${page.name}</a></li>
        `).join('') : '<li style="color: #999; padding: 8px 12px;">Aucune page disponible</li>'}
      </ul>
    </div>

    ${accessibleTables.length > 0 ? `
    <div class="sidebar-section">
      <h3>Tables</h3>
      <ul>
        ${accessibleTables.map(table => `
          <li><a href="/_crud/${table}">${table}</a></li>
        `).join('')}
      </ul>
    </div>
    ` : ''}

  </nav>

  <!-- Header -->
  <header>
    <div class="logo">${schema.appName}</div>

    <div class="header-right">
      <!-- Menu utilisateur -->
      <div class="user-menu">
        <button class="user-button" onclick="toggleUserMenu()">
          <span class="user-icon">${userName.charAt(0).toUpperCase()}</span>
          <span>${userName}</span>
        </button>

        <div class="user-dropdown" id="userDropdown">
          ${isAuthenticated ? `
            <div class="user-info">
              ${user.email}<br>
              <strong>Rôles:</strong> ${allRoles.join(', ')}
            </div>
            <a href="/_debug/user">Mon profil</a>
            <a href="/_debug/user/grant">Mes autorisations</a>
            <div class="divider"></div>
            <button onclick="logout()">Déconnexion</button>
          ` : `
            <a href="#" onclick="showLoginForm(); return false;">Connexion</a>
          `}
        </div>
      </div>

      <!-- Menu hamburger -->
      <button class="menu-toggle" onclick="toggleMenu()">☰</button>
    </div>
  </header>

  <!-- Contenu principal -->
  <div class="container">
    ${content}
    <br>
    <hr>
    ${this.generateLoginHTML()}
  </div>

  <script>
    // Toggle menu hamburger
    function toggleMenu() {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('overlay');
      sidebar.classList.toggle('open');
      overlay.classList.toggle('open');
    }

    function closeMenu() {
      const sidebar = document.getElementById('sidebar');
      const overlay = document.getElementById('overlay');
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    }

    // Toggle user menu
    function toggleUserMenu() {
      const dropdown = document.getElementById('userDropdown');
      dropdown.classList.toggle('open');
    }

    // Fermer le menu utilisateur si on clique ailleurs
    document.addEventListener('click', function(event) {
      const userMenu = document.querySelector('.user-menu');
      const dropdown = document.getElementById('userDropdown');
      if (!userMenu.contains(event.target)) {
        dropdown.classList.remove('open');
      }
    });

    // Login
    async function login(event) {
      event.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const errorMessage = document.getElementById('errorMessage');

      try {
        const response = await fetch('/_user/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok) {
          window.location.reload();
        } else {
          errorMessage.textContent = data.error || 'Erreur de connexion';
          errorMessage.style.display = 'block';
        }
      } catch (error) {
        errorMessage.textContent = 'Erreur de connexion au serveur';
        errorMessage.style.display = 'block';
      }
    }

    // Logout
    async function logout() {
      try {
        await fetch('/_user/logout', { method: 'POST' });
        window.location.reload();
      } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
      }
    }

    function showLoginForm() {
      // Fermer le dropdown
      document.getElementById('userDropdown').classList.remove('open');
      // Scroller vers le formulaire
      document.querySelector('.login-form')?.scrollIntoView({ behavior: 'smooth' });
    }
  </script>
  ${this.generateHumanizeScript()}
</body>
</html>
    `;
  }
}

module.exports = TemplateService;
