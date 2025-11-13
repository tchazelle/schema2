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
  <link rel="stylesheet" href="/css/common.css">
  <link rel="stylesheet" href="/css/header.css">
  <link rel="stylesheet" href="/css/sidebar-menu.css">
  <link rel="stylesheet" href="/css/user-menu.css">
  <link rel="stylesheet" href="/css/login-form.css">
  <link rel="stylesheet" href="/css/pages-content.css">
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
