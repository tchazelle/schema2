/**
 * Service pour la génération de templates HTML
 * Extrait les fonctions de génération HTML de routes/pages.js
 */

const schema = require('../schema.js');
const mustache = require('mustache');

class TemplateService {

  static htmlSection(section) {
    return `<section data-section="${section.slug}">
    ${section.mustache 
      ? mustache.render(section.mustache, section) 
      :`${section.css ? `<style>${section.css}</style>` :""}
        <h2>${section.name}</h2>
        <p>${section.description}</p>
        <main class="rows ${section.presentationType}" data-table="${section.tableName}">
        ${section.rows ? section.rows.map(TemplateService.htmlRow).join("\n") : "pas de réponse"}
        </main>
      `}
    </section>`
  }
  static htmlRow(row, level=0) { // [#TC] à rapprocher su schema poru plus de précision
    return `<article class="${("sub".repeat(level))+"row"} data-table="${row._table}" data-id="${row.id}">
      ${
        Object.entries(row).map(([key,val]) => {
          const type = Array.isArray(val) ? "oneToMany" : (typeof val == "object" ?  "manyToOne" :  "simple")
          return `<div ${type=="simple" ? `data-field="${key}"` : `data-relation="${type}"`}>
            <label class="label">${key}</label>
            <div class="value">
              ${
                type == "oneToMany" 
                  ? val.map(r => TemplateService.htmlRow(r, level+1)).join("\n") 
                  : ( type == "manyToOne" 
                      ? TemplateService.htmlRow(val, level+1) 
                      : val) 
              }
            </div>
          </div>`
        }).join("\n")
      }
    </article>`
  }
  

  static htmlDebugJSON(json) {
    return `<pre>${JSON.stringify(json, null, 4)}</pre>`
  }

  static htmlCssFiles() {
    return `
      <link rel="stylesheet" href="/css/common.css">
      <link rel="stylesheet" href="/css/header.css">
      <link rel="stylesheet" href="/css/sidebar-menu.css">
      <link rel="stylesheet" href="/css/user-menu.css">
      <link rel="stylesheet" href="/css/login-form.css">
      <link rel="stylesheet" href="/css/pages-content.css">
      <link rel="stylesheet" href="/css/rows.css">
    `
  }

  static htmlTitle() {`
      <div class="sidebar-header">
        <div class="sidebar-header-content">
          <h2>${schema.appName}</h2>
          <p style="color: #666; font-size: 12px;">Version ${schema.version}</p>
        </div>
        
      </div>`
  }

  static htmlMenuPages(pages) {
    return `
      <div class="sidebar-section">
        <ul>
        ${pages.length > 0 
          ? pages.map(page => `<li><a href="/${page.slug}">${page.name}</a></li>`).join('\n') 
          : '<li style="color: #999; padding: 8px 12px;">Aucune page disponible</li>'}
        </ul>
      </div>
    `
  }

  static htmlMenuTable(accessibleTables) {
    return accessibleTables?.length > 0 
      ? `<div class="sidebar-section">
          <h3>Tables</h3>
          <ul>
            ${accessibleTables.map(table => `<li><a href="/_crud/${table}">${table}</a></li>`).join('')} 
          </ul>
        </div>`
      : ""
  }
  static htmlMenu(pages, accessibleTables) { 
    return this.htmlMenuPages(pages) 
    +this.htmlMenuTable(accessibleTables)
  }
  
  static htmlSidebar(pages, accessibleTables) {
    return `<nav class="sidebar" id="sidebar">
      <button class="sidebar-close" onclick="closeMenu()" aria-label="Fermer le menu">✖️</button>
      ${this.htmlMenu(pages, accessibleTables)}
    </nav>`
  }b
  static htmlUserMenu(user) {
  return `<div class="user-menu">
  
    <button class="user-button" onclick="toggleUserMenu()">
      <span class="user-icon">${user.abbreviation}</span>
      <span>${user.fullName}</span>
    </button>

    <div class="user-dropdown" id="userDropdown">
      ${user.isAuthenticated ? `
        <div class="user-info">
          ${user.email}<br>
          <strong>Rôles:</strong> ${user.allRoles.join(', ')}
        </div>
        <a href="/_debug/user">Mon profil</a>
        <a href="/_debug/user/grant">Mes autorisations</a>
        <div class="divider"></div>
        <button onclick="logout()">Déconnexion</button>
      ` : `
        <a href="#" onclick="showLoginForm(); return false;">Connexion</a>
      `}
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
    </script>`
  }

  static htmlHeader(user, pages, accessibleTables) { return `
    <header>
    
      <div class="logo">${schema.appName}</div>
      ${this.htmlSidebar(pages, accessibleTables)}
      <div class="overlay" id="overlay" onclick="closeMenu()"></div>
      <div class="header-right">
        ${this.htmlUserMenu(user)}
        </div>
        
        <!-- Menu hamburger -->
        <button class="menu-toggle" onclick="toggleMenu()">☰</button>
      </div>
    </header>
  `}


  /**
   * Génère le formulaire de connexion HTML
   * @returns {string} - HTML du formulaire de login
   */
  static htmlLogin() {
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
  </div>
  <script>
    
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
      document.querySelector('.login-form')?.classList.add('open');
      document.getElementById('overlay').classList.add('open');
    
    }
  </script>`;
  }

  /**
   * Génère le script client pour humaniser les dates
   * @returns {string} - HTML avec le script
   */
  static scriptHumanize() {
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

  static htmlSitePage(options) {
    const {
      user,
      pages,
      pageName,
      main,
      accessibleTables,
    } = options;

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${schema.appName}</title>
  ${this.htmlCssFiles()}
</head>
<body>

  ${this.htmlHeader(user, pages, accessibleTables)}
  ${this.htmlLogin()}
  <main class="container">
    ${main}
  </main>
  ${this.scriptHumanize()}
</body>
</html>
    `;
  }

  /**
   * Génère une page CRUD avec le même header et menu que les pages du site
   * @param {Object} options - Options de génération
   * @param {Object} options.user - L'utilisateur connecté
   * @param {Array} options.pages - Liste des pages du menu
   * @param {string} options.table - Nom de la table CRUD
   * @param {Array} options.accessibleTables - Tables accessibles à l'utilisateur
   * @returns {string} - HTML complet de la page CRUD
   */
  static htmlCrudPage(options) {
    const {
      user,
      pages,
      table,
      accessibleTables,
    } = options;

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRUD - ${table} - ${schema.appName}</title>
  ${this.htmlCssFiles()}
  <link rel="stylesheet" href="/css/crud.css">

  <!-- React from CDN (production) -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
</head>
<body>

  ${this.htmlHeader(user, pages, accessibleTables)}
  ${this.htmlLogin()}

  <div id="root"></div>

  <!-- CRUD List Component -->
  <script src="/js/crudList.js"></script>

  <script>
    // Mount the React component
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(CrudList, { table: '${table}' }));
  </script>

  ${this.scriptHumanize()}
</body>
</html>
    `;
  }

  /**
   * Generate HTML page for CRUD detail view (single record in fullscreen)
   * Uses the same CrudList component but with recordId parameter to show fullscreen modal
   * @param {Object} options - Template options
   * @param {Object} options.user - Current user object
   * @param {Array} options.pages - Available pages for menu
   * @param {string} options.table - Table name
   * @param {number} options.recordId - Record ID to display
   * @param {Array} options.accessibleTables - Tables accessible to user
   * @returns {string} - HTML page
   */
  static htmlCrudDetailPage(options) {
    const {
      user,
      pages,
      table,
      recordId,
      accessibleTables,
    } = options;

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${table} #${recordId} - ${schema.appName}</title>
  ${this.htmlCssFiles()}
  <link rel="stylesheet" href="/css/crud.css">

  <!-- React from CDN (production) -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
</head>
<body>

  ${this.htmlHeader(user, pages, accessibleTables)}
  ${this.htmlLogin()}

  <div id="root"></div>

  <!-- CRUD List Component (reused for detail view) -->
  <script src="/js/crudList.js"></script>

  <script>
    // Mount the React component with recordId to trigger fullscreen modal
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(CrudList, {
      table: '${table}',
      initialRecordId: ${recordId}
    }));
  </script>

  ${this.scriptHumanize()}
</body>
</html>
    `;
  }
}
module.exports = TemplateService;
