/**
 * Service pour la génération de templates HTML
 * Extrait les fonctions de génération HTML de routes/pages.js
 */

const schema = require('../schema.js');
const mustache = require('mustache');
const CalendarService = require('./calendarService');
const SchemaService = require('./schemaService');

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
      <link rel="stylesheet" href="/css/variables.css">

      <link rel="stylesheet" href="/css/common.css">
      <link rel="stylesheet" href="/css/header.css">
      <link rel="stylesheet" href="/css/sidebar-menu.css">
      <link rel="stylesheet" href="/css/user-menu.css">
      <link rel="stylesheet" href="/css/login-form.css">
      <link rel="stylesheet" href="/css/pages-content.css">
      <link rel="stylesheet" href="/css/rows.css">
      <link rel="stylesheet" href="/css/generic.css">
      <link rel="stylesheet" href="/css/menu-dropdown.css">
    `
  }

  /**
   * Generate script tags for CRUD component dependencies
   * IMPORTANT: Order matters! Components must load in dependency order.
   * Based on: public/js/components/INTEGRATION.md
   */
  static htmlCrudComponentScripts() {
    return `
  <!-- 1. Utilities (no dependencies) -->
  <script src="/js/utils/crudListUtils.js"></script>
  <script src="/js/utils/dropdownPosition.js"></script>
  <script src="/js/autoExpandTextarea.js"></script>
  <script src="/js/toast.js"></script>

  <!-- Global React.createElement shorthand -->
  <script>
    // Define as global variable (not just window property) for direct access in components
    var e = React.createElement;
    window.e = e; // Also set on window for explicit access
  </script>

  <!-- 2. Field Components (foundational, no dependencies) -->
  <script src="/js/components/fields/FieldRenderer.js"></script>
  <script src="/js/components/fields/RelationRenderer.js"></script>

  <!-- 3. Date Components (no dependencies) -->
  <script src="/js/components/dates/CalendarDateRangeTool.js"></script>

  <!-- 4. Form Input Components (small, few dependencies) -->
  <script src="/js/components/forms/GrantedSelector.js"></script>
  <script src="/js/components/forms/RelationAutocomplete.js"></script>
  <script src="/js/components/forms/ImageFieldUploader.js"></script>

  <!-- 5. Search/Filter Components (no dependencies) -->
  <script src="/js/components/search/FieldSelectorModal.js"></script>
  <script src="/js/components/search/ThreeDotsMenu.js"></script>
  <script src="/js/components/search/AdvancedSearchModal.js"></script>
  <script src="/js/components/search/AdvancedSortModal.js"></script>

  <!-- 6. Dialog Components (no dependencies) -->
  <script src="/js/components/dialogs/RelationSelectorDialog.js"></script>
  <script src="/js/components/dialogs/NotifyModal.js"></script>
  <script src="/js/components/dialogs/ImageEditorModal.js"></script>
  <script src="/js/components/dialogs/ImageFieldEditorModal.js"></script>
  <script src="/js/components/dialogs/FullscreenTextEditor.js"></script>

  <!-- 7. Table Components -->
  <script src="/js/components/table/TableHeader.js"></script>
  <script src="/js/components/table/TableRow.js"></script>

  <!-- 8. Detail Components (depends on table, fields, forms) -->
  <script src="/js/components/details/AttachmentsTab.js"></script>
  <script src="/js/components/details/SubList.js"></script>
  <script src="/js/components/details/RowDetailView.js"></script>
  <script src="/js/components/details/RowDetailModal.js"></script>

  <!-- 9. Large Form Components (depends on many others) -->
  <script src="/js/components/forms/EditForm.js"></script>
  <script src="/js/components/forms/CreateFormModal.js"></script>

  <!-- 10. Main Application (depends on all components) -->
  <script src="/js/crudList.js"></script>
    `;
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
            <li><a href="/_crud">🔍 Recherche</a></li>
            ${accessibleTables.map(table => `<li><a href="/_crud/${table}">${table}</a></li>`).join('')}
          </ul>
        </div>`
      : ""
  }

  static htmlMenuCalendar(hasCalendarAccess) {
    return hasCalendarAccess
      ? `<div class="sidebar-section">
          <h3>Outils</h3>
          <ul>
            <li><a href="/_calendar">📅 Calendrier</a></li>
          </ul>
        </div>`
      : ""
  }

  static htmlMenu(pages, accessibleTables, hasCalendarAccess) {
    return this.htmlMenuPages(pages)
    + this.htmlMenuCalendar(hasCalendarAccess)
    + this.htmlMenuTable(accessibleTables)
  }
  
  static htmlSidebar(pages, accessibleTables, hasCalendarAccess = false) {
    return `<nav class="sidebar" id="sidebar">
      <button class="btn btn-close sidebar-close" onclick="closeMenu()" aria-label="Fermer le menu">✖️</button>
      ${this.htmlMenu(pages, accessibleTables, hasCalendarAccess)}
    </nav>` 
  }

  static htmlThemeToggle(user) {
    return `<div class="theme-toggle-header">
      <div class="theme-toggle-switch">
        <input type="checkbox" id="themeToggle" onchange="toggleTheme()" ${user.theme === 'dark' ? 'checked' : ''}>
        <span class="theme-toggle-slider">
          <span class="theme-icon sun">☀️</span>
          <span class="theme-icon moon">🌙</span>
        </span>
      </div>
    </div>`
  }
  static htmlUserMenu(user) {
  // Generate user avatar: use image if available, otherwise show initials
  const userAvatar = user.image
    ? `<img src="${user.image}" alt="${user.fullName}" class="user-avatar-image" />`
    : `<span class="user-avatar-initials">${user.abbreviation || '?'}</span>`;

  return `<div class="user-menu">

    <button class="btn user-button" onclick="toggleUserMenu()" aria-label="Menu utilisateur">
      ${userAvatar}
    </button>

    <div class="user-dropdown menu-dropdown" id="userDropdown" style="z-index: 200000;">
      ${user.isAuthenticated ? `
        <div class="user-info">
          <strong>${user.fullName || user.email}</strong><br>
          ${user.email}<br>
          <span style="font-size: 0.85em; color: var(--color-text-muted);">Rôles: ${user.allRoles.join(', ')}</span>
        </div>
        <div class="divider"></div>
        <div class="theme-toggle-container">
          <label class="theme-toggle-label">
            <span class="theme-label-text">Mode sombre</span>
            <div class="theme-toggle-switch">
              <input type="checkbox" id="themeToggle" onchange="toggleTheme()" ${user.theme === 'dark' ? 'checked' : ''}>
              <span class="theme-toggle-slider">
                <span class="theme-icon sun">☀️</span>
                <span class="theme-icon moon">🌙</span>
              </span>
            </div>
          </label>
        </div>
        <div class="divider"></div>
        <a class="menu-item"  href="/_debug/user">Mon profil</a>
        <a class="menu-item"  href="/_debug/user/grant">Mes autorisations</a>
        <div class="divider"></div>
        <button class="menu-item" onclick="logout()">Déconnexion</button>
      ` : `
        <div class="user-info">
          <strong>Non connecté</strong>
        </div>
        <div class="divider"></div>
        <div class="theme-toggle-container">
          <label class="theme-toggle-label">
            <span class="theme-label-text">Mode sombre</span>
            <div class="theme-toggle-switch">
              <input type="checkbox" id="themeToggle" onchange="toggleTheme()">
              <span class="theme-toggle-slider">
                <span class="theme-icon sun">☀️</span>
                <span class="theme-icon moon">🌙</span>
              </span>
            </div>
          </label>
        </div>
        <div class="divider"></div>
        <a class="menu-item"  href="#" onclick="showLoginForm(); return false;">Connexion</a>
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

    // Dark mode toggle (using cookies for non-authenticated users)
    function toggleTheme() {
      const checkbox = document.getElementById('themeToggle');
      const newTheme = checkbox.checked ? 'dark' : 'light';

      // Apply theme immediately
      document.documentElement.setAttribute('data-theme', newTheme);

      // Save to cookie (expires in 365 days)
      const expires = new Date();
      expires.setDate(expires.getDate() + 365);
      document.cookie = \`theme=\${newTheme}; path=/; expires=\${expires.toUTCString()}; SameSite=Lax\`;
    }

    // Initialize theme on page load
    (function initTheme() {
      // Get theme from cookie
      const getCookie = (name) => {
        const value = \`; \${document.cookie}\`;
        const parts = value.split(\`; \${name}=\`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
      };

      const savedTheme = getCookie('theme');
      const theme = savedTheme || 'light';

      document.documentElement.setAttribute('data-theme', theme);

      // Update checkbox state to match theme
      const checkbox = document.getElementById('themeToggle');
      if (checkbox) {
        checkbox.checked = (theme === 'dark');
      }
    })();
    </script>`
  }

  static htmlHeader(user, pages, accessibleTables, hasCalendarAccess = null) {
    // Calculer automatiquement hasCalendarAccess si non fourni
    if (hasCalendarAccess === null && user) {
      hasCalendarAccess = CalendarService.hasCalendarAccess(user);
    } else if (hasCalendarAccess === null) {
      hasCalendarAccess = false;
    }

    return `
    <header>

      <div class="logo">${schema.appName}</div>
      ${this.htmlSidebar(pages, accessibleTables, hasCalendarAccess)}
      <div class="overlay" id="overlay" onclick="closeMenu()"></div>
      <div class="header-right">
        ${this.htmlUserMenu(user)}
        </div>

        <!-- Menu hamburger -->
        <button class="btn menu-toggle" onclick="toggleMenu()">☰</button>
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

  <!-- Dropdown positioning utility for user menu -->
  <script src="/js/utils/dropdownPosition.js"></script>
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
  <link rel="stylesheet" href="/css/calendar-date-range.css">

  <!-- React from CDN (production) -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>

  <!-- Marked.js for markdown rendering -->
  <script src="https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js"></script>
</head>
<body>

  ${this.htmlHeader(user, pages, accessibleTables)}
  ${this.htmlLogin()}

  <div id="root"></div>

  ${this.htmlCrudComponentScripts()}

  <script>
    // Mount the React component
    const root = ReactDOM.createRoot(document.getElementById('root'));

    // Check if there's an 'open' parameter in the URL to auto-open a record
    const urlParams = new URLSearchParams(window.location.search);
    const openRecordId = urlParams.get('open');

    const props = { table: '${table}' };
    if (openRecordId) {
      props.initialRecordId = parseInt(openRecordId);
    }

    root.render(React.createElement(CrudList, props));
  </script>
</body>
</html>
    `;
  }

  /**
   * Génère une page de recherche multi-tables
   * @param {Object} options - Options de génération
   * @param {Object} options.user - L'utilisateur connecté
   * @param {Array} options.pages - Liste des pages du menu
   * @param {Array} options.accessibleTables - Tables accessibles à l'utilisateur
   * @param {Object} options.searchStats - Statistiques de recherche
   * @returns {string} - HTML complet de la page de recherche
   */
  static htmlSearchPage(options) {
    const {
      user,
      pages,
      accessibleTables,
      searchStats,
    } = options;

    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Recherche - ${schema.appName}</title>
  ${this.htmlCssFiles()}
  <link rel="stylesheet" href="/css/crud.css">
  <style>
    .search-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }

    .search-header {
      text-align: center;
      margin-bottom: 2rem;
    }

    .search-header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
      color: var(--color-text);
    }

    .search-header p {
      color: var(--color-text-secondary);
      font-size: 1rem;
    }

    .search-box {
      max-width: 600px;
      margin: 0 auto 2rem;
    }

    .search-input-group {
      display: flex;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }

    .search-input {
      flex: 1;
      padding: 0.75rem 1rem;
      border: 1px solid var(--color-border);
      border-radius: 4px;
      font-size: 1rem;
      background: var(--color: var(--color-primary)lor-text);
    }

    .search-input:focus {
      outline: none;
      border-color: var(--color-primary-text);
    }

    .search-button {
      padding: 0.75rem 2rem;
      background: var(--color-primary);
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 1rem;
      cursor: pointer;
      font-weight: 500;
    }

    .search-button:hover {
      background: var(--color-primary-dark, #357ae8);
    }

    .search-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .search-stats {
      text-align: center;
      font-size: 0.875rem;
      color: var(--color-text-secondary);
    }

    .search-results {
      margin-top: 2rem;
    }

    .search-summary {
      text-align: center;
      padding: 1rem;
      margin-bottom: 1rem;
      background: var(--color-bg-alt);
      border-radius: 4px;
      color: var(--color-text);
    }

    .table-results {
      margin-bottom: 2rem;
    }

    .table-results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem;
      background: var(--color-bg-alt);
      border-radius: 4px 4px 0 0;
      border-bottom: 2px solid var(--color-primary);
      cursor: pointer;
      user-select: none;
    }

    .table-results-header:hover {
      background: var(--color-bg);
    }

    .table-results-header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .table-results-header h3 {
      margin: 0;
      font-size: 1.25rem;
      color: var(--color-text);
    }

    .table-results-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 2rem;
      height: 1.5rem;
      padding: 0 0.5rem;
      background: var(--color-primary);
      color: white;
      font-size: 0.875rem;
      font-weight: 600;
      border-radius: 12px;
    }

    .table-results-toggle {
      font-size: 0.875rem;
      color: var(--color-text-secondary);
      transition: transform 0.2s;
    }

    .table-results-toggle.collapsed {
      transform: rotate(-90deg);
    }

    .table-results-count {
      color: var(--color-text-secondary);
      font-size: 0.875rem;
    }

    .results-list {
      border: 1px solid var(--color-border);
      border-top: none;
      border-radius: 0 0 4px 4px;
    }

    .result-item {
      padding: 1rem;
      border-bottom: 1px solid var(--color-border);
      background: var(--color-bg);
      transition: background 0.2s;
    }

    .result-item:last-child {
      border-bottom: none;
    }

    .result-item:hover {
      background: var(--color-bg);
    }

    .result-item-link {
      text-decoration: none;
      color: inherit;
      display: block;
    }

    .result-item-fields {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .result-field {
      font-size: 0.875rem;
    }

    .result-field-label {
      font-weight: 600;
      color: var(--color-text-secondary);
      margin-right: 0.25rem;
    }

    .result-field-value {
      color: var(--color-text);
    }

    .loading {
      text-align: center;
      padding: 2rem;
      color: var(--color-text-secondary);
    }

    .no-results {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--color-text-secondary);
    }

    .error-message {
      text-align: center;
      padding: 2rem;
      color: var(--color-error);
      background: var(--color-bg-error, #fee);
      border-radius: 4px;
      margin-top: 1rem;
    }
  </style>
</head>
<body>

  ${this.htmlHeader(user, pages, accessibleTables)}
  ${this.htmlLogin()}

  <div class="search-container">
    <div class="search-header">
      <h1>🔍 Recherche</h1>
      <p>Recherchez dans toutes vos tables accessibles</p>
    </div>

    <div class="search-box">
      <form id="searchForm" onsubmit="performSearch(event)">
        <div class="search-input-group">
          <input
            type="text"
            id="searchInput"
            class="search-input"
            placeholder="Rechercher..."
            autofocus
          />
          <button type="submit" class="search-button" id="searchButton">
            Rechercher
          </button>
        </div>
      </form>
      <div class="search-stats">
        ${searchStats.tables} tables • ${searchStats.totalTextFields} champs texte • ${searchStats.totalDateFields} champs date
      </div>
    </div>

    <div id="searchResults" class="search-results"></div>
  </div>

  <script>
    let currentSearchTerm = '';

    async function performSearch(event) {
      if (event) {
        event.preventDefault();
      }

      const searchInput = document.getElementById('searchInput');
      const searchButton = document.getElementById('searchButton');
      const resultsContainer = document.getElementById('searchResults');
      const searchTerm = searchInput.value.trim();

      if (!searchTerm) {
        resultsContainer.innerHTML = '';
        return;
      }

      // Disable search button during search
      searchButton.disabled = true;
      searchButton.textContent = 'Recherche...';

      // Show loading
      resultsContainer.innerHTML = '<div class="loading">⏳ Recherche en cours...</div>';

      try {
        const response = await fetch(\`/_crud/search?q=\${encodeURIComponent(searchTerm)}&limit=10\`);
        const data = await response.json();

        if (!data.success) {
          resultsContainer.innerHTML = \`<div class="error-message">❌ \${data.error || 'Erreur lors de la recherche'}</div>\`;
          return;
        }

        currentSearchTerm = searchTerm;
        renderResults(data);

      } catch (error) {
        console.error('Search error:', error);
        resultsContainer.innerHTML = '<div class="error-message">❌ Erreur lors de la recherche</div>';
      } finally {
        searchButton.disabled = false;
        searchButton.textContent = 'Rechercher';
      }
    }

    function renderResults(data) {
      const resultsContainer = document.getElementById('searchResults');

      if (data.totalResults === 0) {
        resultsContainer.innerHTML = \`
          <div class="no-results">
            <p style="font-size: 3rem; margin: 0;">🔍</p>
            <p style="font-size: 1.25rem; margin: 1rem 0 0.5rem;">Aucun résultat</p>
            <p>Aucun résultat trouvé pour "<strong>\${escapeHtml(data.searchTerm)}</strong>"</p>
          </div>
        \`;
        return;
      }

      let html = \`
        <div class="search-summary">
          <strong>\${data.totalResults}</strong> résultat\${data.totalResults > 1 ? 's' : ''} trouvé\${data.totalResults > 1 ? 's' : ''}
          dans <strong>\${Object.keys(data.results).length}</strong> table\${Object.keys(data.results).length > 1 ? 's' : ''}
          pour "<strong>\${escapeHtml(data.searchTerm)}</strong>"
        </div>
      \`;

      // Render results by table
      for (const [tableName, tableResults] of Object.entries(data.results)) {
        html += \`
          <div class="table-results" data-table="\${tableName}">
            <div class="table-results-header" onclick="toggleTableResults('\${tableName}')">
              <div class="table-results-header-left">
                <span class="table-results-toggle" id="toggle-\${tableName}">▼</span>
                <h3>\${tableName}</h3>
                <span class="table-results-badge">\${tableResults.count}</span>
              </div>
              <span class="table-results-count">
                \${tableResults.count} résultat\${tableResults.count > 1 ? 's' : ''}
                \${tableResults.hasMore ? \` (sur \${tableResults.total})\` : ''}
              </span>
            </div>
            <div class="results-list" id="results-\${tableName}">
        \`;

        for (const row of tableResults.rows) {
          html += \`
            <div class="result-item">
              <a href="/_crud/\${tableName}?open=\${row.id}" class="result-item-link">
                <div class="result-item-fields">
        \`;

          // Show important fields (limit to 6)
          const fields = Object.entries(row).filter(([key]) =>
            key !== 'id' && !key.startsWith('_') && key !== 'ownerId' && key !== 'granted'
          ).slice(0, 6);

          for (const [key, value] of fields) {
            if (value !== null && value !== undefined && value !== '') {
              const displayValue = formatValue(value);
              html += \`
                <div class="result-field">
                  <span class="result-field-label">\${key}:</span>
                  <span class="result-field-value">\${highlightMatch(displayValue, data.searchTerm)}</span>
                </div>
              \`;
            }
          }

          html += \`
                </div>
              </a>
            </div>
          \`;
        }

        html += \`
            </div>
          </div>
        \`;
      }

      resultsContainer.innerHTML = html;
    }

    function formatValue(value) {
      if (typeof value === 'string') {
        // Truncate long strings
        if (value.length > 100) {
          return escapeHtml(value.substring(0, 100)) + '...';
        }
        return escapeHtml(value);
      }
      if (value instanceof Date || (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value))) {
        // Format dates
        try {
          const date = new Date(value);
          return date.toLocaleDateString('fr-FR');
        } catch (e) {
          return escapeHtml(String(value));
        }
      }
      return escapeHtml(String(value));
    }

    function highlightMatch(text, searchTerm) {
      if (!searchTerm || !text) return text;

      const regex = new RegExp(\`(\${escapeRegex(searchTerm)})\`, 'gi');
      return text.replace(regex, '<mark style="background: yellow; padding: 0 2px;">$1</mark>');
    }

    function toggleTableResults(tableName) {
      const resultsDiv = document.getElementById(\`results-\${tableName}\`);
      const toggleIcon = document.getElementById(\`toggle-\${tableName}\`);

      if (resultsDiv.style.display === 'none') {
        resultsDiv.style.display = 'block';
        toggleIcon.textContent = '▼';
        toggleIcon.classList.remove('collapsed');
      } else {
        resultsDiv.style.display = 'none';
        toggleIcon.textContent = '▶';
        toggleIcon.classList.add('collapsed');
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function escapeRegex(text) {
      return text.replace(/[.*+?^\\$\\{\\}()|[\\\\]]/g, '\\\\\\\\$&');
    }

    // Enable search on Enter key
    document.getElementById('searchInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        performSearch(e);
      }
    });
  </script>

  <!-- Dropdown positioning utility for user menu -->
  <script src="/js/utils/dropdownPosition.js"></script>
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
  <link rel="stylesheet" href="/css/calendar-date-range.css">

  <!-- React from CDN (production) -->
  <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
  <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>

  <!-- Marked.js for markdown rendering -->
  <script src="https://cdn.jsdelivr.net/npm/marked@11.1.1/marked.min.js"></script>
</head>
<body>

  ${this.htmlHeader(user, pages, accessibleTables)}
  ${this.htmlLogin()}

  <div id="root"></div>

  ${this.htmlCrudComponentScripts()}

  <script>
    // Mount the React component with recordId to trigger fullscreen modal
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(CrudList, {
      table: '${table}',
      initialRecordId: ${recordId}
    }));
  </script>
</body>
</html>
    `;
  }

  /**
   * Génère la page HTML du calendrier avec tous les événements
   * @param {Object} user - L'utilisateur connecté
   * @param {Date} initialDate - Date initiale optionnelle pour le calendrier
   * @param {Array} pages - Liste des pages accessibles pour le menu
   * @param {Array} accessibleTables - Liste des tables accessibles pour le menu
   * @returns {string} - HTML complet de la page calendrier
   */
  static htmlCalendar(user, initialDate = null, pages = [], accessibleTables = []) {
    return `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Calendrier - ${schema.appName}</title>
  ${this.htmlCssFiles()}
  <link rel="stylesheet" href="/css/calendar.css">

  <!-- FullCalendar CSS -->
  <link href='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.css' rel='stylesheet' />
</head>
<body>

  ${this.htmlHeader(user, pages, accessibleTables)}
  ${this.htmlLogin()}

  <main class="calendar-container">
    <div class="calendar-header">
      <h1>Calendrier</h1>
      <div class="calendar-stats" id="calendarStats"></div>
    </div>
    <div id="calendar"></div>
  </main>

  <!-- Modale de sélection de table pour création d'événement -->
  <div class="calendar-modal-overlay" id="calendarModal">
    <div class="calendar-modal">
      <div class="calendar-modal-header">
        <h3>Créer un événement</h3>
        <button type="button" class="btn btn-close calendar-modal-close" id="closeModal">&times;</button>
      </div>
      <div class="calendar-modal-date" id="modalDate"></div>
      <div class="calendar-modal-body">
        <p>Sélectionnez le type d'événement à créer :</p>
        <ul class="calendar-table-list" id="tableList"></ul>
      </div>
    </div>
  </div>

  <!-- FullCalendar JS -->
  <script src='https://cdn.jsdelivr.net/npm/fullcalendar@6.1.10/index.global.min.js'></script>

  <script>
    document.addEventListener('DOMContentLoaded', function() {
      const calendarEl = document.getElementById('calendar');
      const modalOverlay = document.getElementById('calendarModal');
      const closeModalBtn = document.getElementById('closeModal');
      const modalDate = document.getElementById('modalDate');
      const tableList = document.getElementById('tableList');
      let selectedDate = null;
      let creatableTables = [];

      /**
       * Convertit un objet Date en format ISO local (sans conversion UTC)
       * Format: YYYY-MM-DDTHH:MM:SS (sans le 'Z')
       * Exemple: new Date('2025-11-16 14:00') -> '2025-11-16T14:00:00'
       */
      function dateToLocalISO(date) {
        if (!date) return null;

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');

        return year + '-' + month + '-' + day + 'T' + hours + ':' + minutes + ':' + seconds;
      }

      // Charger la liste des tables créables
      fetch('/_calendar/tables')
        .then(response => response.json())
        .then(data => {
          if (data.success && data.data) {
            creatableTables = data.data;
          }
        })
        .catch(error => console.error('Erreur lors du chargement des tables:', error));

      // Fonction pour ouvrir la modale
      function openModal(date) {
        selectedDate = date;

        // Formater la date pour l'affichage
        const dateObj = new Date(date);
        const dateStr = dateObj.toLocaleDateString('fr-FR', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        modalDate.innerHTML = '<strong>Date sélectionnée :</strong> ' + dateStr;
        const dateForCreate = dateObj.toISOString().slice(0,11)+"09:00" // ajouter par TC
        // Afficher la liste des tables
        if (creatableTables.length === 0) {
          tableList.innerHTML = '<li class="calendar-modal-empty">Aucune table disponible pour la création d\\'événements</li>';
        } else {
          tableList.innerHTML = creatableTables.map(table => {
            // Get bgColor from table's calendar config
            const bgColor = table.calendar && table.calendar.bgColor ? table.calendar.bgColor : '#007bff';
            const style = 'background-color: ' + bgColor + '; color: black;';

            return '<li class="calendar-table-item">' +
              '<button type="button" class="calendar-table-button" style="' + style + '" data-date="' + dateForCreate + '" data-table="' + table.name + '">' +
              table.name +  '</button></li>';
          }).join('');

          // Ajouter les événements sur les boutons
          const buttons = tableList.querySelectorAll('.calendar-table-button');
          buttons.forEach(btn => {
            btn.addEventListener('click', function(event) {
              event.preventDefault();
              event.stopPropagation();
              const tableName = this.getAttribute('data-table');
              const selectedDate = this.getAttribute('data-date'); // ajouté par Thierry Chazelle
              createEvent(tableName, selectedDate);
            });
          });
        }

        modalOverlay.classList.add('active');
      }

      // Fonction pour fermer la modale
      function closeModal() {
        modalOverlay.classList.remove('active');
        selectedDate = null;
      }

      // Fonction pour créer un événement
      function createEvent(tableName, date) {
        if (!date) {
          console.error('Erreur: Aucune date sélectionnée');
          alert('Erreur: Aucune date sélectionnée');
          return;
        }

        // Sauvegarder la vue actuelle pour le retour
        sessionStorage.setItem('calendarReturnView', calendar.view.type);
        sessionStorage.setItem('calendarReturnDate', date);
        //  sessionStorage.setItem('calendarReturnDate', calendar.getDate().toISOString());
        const url = '/_crud/' + tableName + '?startDate=' + encodeURIComponent(date); // modifié par TC
        window.location.href = url  // modifié par TC
        return 
        // Construire l'URL avec la date pré-remplie
        /*
        // Pour les champs datetime, on ajoute l'heure 09:00
        const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);

        if (match) {
          const [, year, month, day] = match;
          const dateTimeISO = year + '-' + month + '-' + day + 'T09:00';
          const url = '/_crud/' + tableName + '?startDate=' + encodeURIComponent(dateTimeISO);
          window.location.href = url;
        } else {
          // Fallback si vraiment impossible de parser la date
          console.error('Impossible de construire dateTimeISO, fallback sans date');
          alert('Erreur: Format de date invalide. Redirection sans date pré-remplie.');
          window.location.href = '/_crud/' + tableName;
        }
          */
      }

      // Événements de fermeture de la modale
      closeModalBtn.addEventListener('click', closeModal);
      modalOverlay.addEventListener('click', function(e) {
        if (e.target === modalOverlay) {
          closeModal();
        }
      });

      const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'fr',
        timeZone: 'local', // Interpréter les dates en heure locale (pas UTC)
        firstDay: 1, // Lundi comme premier jour de la semaine (1=lundi, 0=dimanche)
        ${initialDate ? `initialDate: '${initialDate.toISOString()}',` : ''}
        headerToolbar: {
          left: 'prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay,listMonth'
        },
        buttonText: {
          today: "Aujourd'hui",
          month: 'Mois',
          week: 'Semaine',
          day: 'Jour',
          list: 'Liste'
        },
        // Activer le drag-and-drop
        editable: true,
        eventStartEditable: true,
        eventDurationEditable: true,
        // Gestion du drag-and-drop
        eventDrop: function(info) {
          // Préparer les données pour l'API (en heure locale, pas UTC)
          const eventData = {
            startDate: dateToLocalISO(info.event.start),
            endDate: info.event.end ? dateToLocalISO(info.event.end) : dateToLocalISO(info.event.start)
          };

          // Envoyer la mise à jour au serveur
          fetch('/_calendar/events/' + info.event.extendedProps.table + '/' + info.event.id, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
          })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
            } else {
              console.error('[Calendar] Erreur lors de la mise à jour:', data.error);
              // Annuler le changement en cas d'erreur
              info.revert();
              alert('Erreur lors de la mise à jour de l\\'événement: ' + (data.error || 'Erreur inconnue'));
            }
          })
          .catch(error => {
            console.error('[Calendar] Erreur réseau:', error);
            // Annuler le changement en cas d'erreur
            info.revert();
            alert('Erreur lors de la mise à jour de l\\'événement');
          });
        },
        // Gestion du redimensionnement
        eventResize: function(info) {
          // Préparer les données pour l'API (en heure locale, pas UTC)
          const eventData = {
            startDate: dateToLocalISO(info.event.start),
            endDate: info.event.end ? dateToLocalISO(info.event.end) : dateToLocalISO(info.event.start)
          };

          // Envoyer la mise à jour au serveur
          fetch('/_calendar/events/' + info.event.extendedProps.table + '/' + info.event.id, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
          })
          .then(response => response.json())
          .then(data => {
            if (data.success) {
            } else {
              console.error('[Calendar] Erreur lors de la mise à jour:', data.error);
              // Annuler le changement en cas d'erreur
              info.revert();
              alert('Erreur lors de la mise à jour de l\\'événement: ' + (data.error || 'Erreur inconnue'));
            }
          })
          .catch(error => {
            console.error('[Calendar] Erreur réseau:', error);
            // Annuler le changement en cas d'erreur
            info.revert();
            alert('Erreur lors de la mise à jour de l\\'événement');
          });
        },
        dateClick: function(info) {
          openModal(info.dateStr);
        },
        events: function(info, successCallback, failureCallback) {
          // Charger les événements depuis l'API
          fetch('/_calendar/events?start=' + info.startStr + '&end=' + info.endStr)
            .then(response => response.json())
            .then(data => {
              successCallback(data);
            })
            .catch(error => {
              console.error('Erreur lors du chargement des événements:', error);
              failureCallback(error);
            });
        },
        eventClick: function(info) {
          // Sauvegarder la vue actuelle dans sessionStorage pour le retour
          sessionStorage.setItem('calendarReturnView', calendar.view.type);
          sessionStorage.setItem('calendarReturnDate', calendar.getDate().toISOString());

          // Rediriger vers la page de détail de l'événement
          if (info.event.url) {
            window.location.href = info.event.url;
            info.jsEvent.preventDefault();
          }
        },
        eventDidMount: function(info) {
          // Ajouter un tooltip avec les informations de l'événement
          info.el.title = info.event.title;

          // Appliquer la couleur de fond personnalisée
          if (info.event.backgroundColor) {
            info.el.style.backgroundColor = info.event.backgroundColor;
            info.el.style.borderColor = info.event.borderColor || info.event.backgroundColor;
          }
        },
        eventContent: function(arg) {
          // Format personnalisé: <heure début>-<heure fin> + titre
          const start = arg.event.start;
          const end = arg.event.end;
          const title = arg.event.title;

          let timeText = '';
          if (start) {
            const startTime = start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            timeText = startTime;
            if (end && end.getTime() !== start.getTime()) {
              const endTime = end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
              timeText += '-' + endTime;
            }
          }

          return {
            html: '<div class="t-main-frame">' +
                  '<div class="fc-event-time">' + timeText + '</div>' +
                  '<div class="fc-event-title-container">' +
                  '<div class="fc-event-title">' + title + '</div>' +
                  '</div></div>'
          };
        },
        // Fixer la hauteur des cellules pour éviter les changements
        height: 'auto',
        expandRows: false,
        dayMaxEventRows: true,
        dayMaxEvents: 3,
        moreLinkClick: 'popover'
      });

      // Restaurer la vue depuis sessionStorage si disponible
      const returnView = sessionStorage.getItem('calendarReturnView');
      const returnDate = sessionStorage.getItem('calendarReturnDate');
      if (returnView) {
        calendar.changeView(returnView);
      }
      if (returnDate) {
        calendar.gotoDate(new Date(returnDate));
        // Nettoyer le sessionStorage après utilisation
        sessionStorage.removeItem('calendarReturnView');
        sessionStorage.removeItem('calendarReturnDate');
      }

      calendar.render();

      // Charger les statistiques
      fetch('/_calendar/stats')
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            const statsEl = document.getElementById('calendarStats');
            // Stats are spread directly into the response object, not nested under data.data
            const totalEvents = data.totalEvents || 0;
            const accessibleTables = data.accessibleTables || 0;
            const totalTables = data.totalTables || 0;
            statsEl.innerHTML =
              '<span>' + totalEvents + ' événements</span>' +
              '<span>' + accessibleTables + ' / ' + totalTables + ' tables accessibles</span>';
          } else {
            console.warn('[Calendar] Stats response error:', data);
          }
        })
        .catch(error => console.error('Erreur lors du chargement des statistiques:', error));
    });
  </script>

  <!-- Dropdown positioning utility for user menu -->
  <script src="/js/utils/dropdownPosition.js"></script>
</body>
</html>
    `;
  }

  /**
   * Génère un template Mustache pour une table en se basant sur son schéma
   * Inclut les relations n:1, relations 1:n et relations n:1 imbriquées dans les 1:n
   *
   * @param {string} tableName - Nom de la table
   * @param {Object} user - Utilisateur (pour vérifier les permissions)
   * @param {Object} options - Options de génération
   * @param {boolean} options.includeWrapper - Inclure le wrapper article (default: true)
   * @param {boolean} options.includeSystemFields - Inclure les champs système (default: false)
   * @param {number} options.maxDepth - Profondeur maximale des relations (default: 2)
   * @param {string} options.oneToManyStyle - Style d'affichage des relations 1:n: 'cards' ou 'table' (default: 'cards')
   * @returns {string|null} - Template Mustache généré ou null si table non trouvée
   */
  static generateMustacheTemplate(tableName, user, options = {}) {
    const {
      includeWrapper = true,
      includeSystemFields = false,
      maxDepth = 2,
      oneToManyStyle = 'table', // 'cards' ou 'table'
    } = options;
    
    // Récupérer la configuration de la table
    const tableConfig = SchemaService.getTableConfig(tableName);
    if (!tableConfig) {
      return null;
    }

    // Récupérer les relations
    const { relationsN1, relations1N } = SchemaService.getTableRelations(user, tableName);

    // Construire le template
    let template = '';

    if (includeWrapper) {
      template += `<article class="row" data-table="${tableName}" data-id="{{id}}">\n`;
      template += `  <h2>{{${SchemaService.getDisplayFields(tableName)?.[0] || 'name'}}}</h2>\n\n`;
    }

    // Ajouter les champs de base (non-relations)
    const baseFieldsTemplate = TemplateService._generateBaseFieldsTemplate(
      tableConfig.fields,
      includeSystemFields,
      '  '
    );
    template += baseFieldsTemplate;

    // Ajouter les relations n:1
    if (Object.keys(relationsN1).length > 0) {
      template += '\n  <!-- Relations n:1 (Many-to-One) -->\n';
      for (const [fieldName, relationConfig] of Object.entries(relationsN1)) {
        const n1Template = TemplateService._generateN1RelationTemplate(
          fieldName,
          relationConfig,
          '  '
        );
        template += n1Template;
      }
    }

    // Ajouter les relations 1:n
    if (Object.keys(relations1N).length > 0) {
      template += '\n  <!-- Relations 1:n (One-to-Many) -->\n';
      for (const [arrayName, relationConfig] of Object.entries(relations1N)) {
        const oneNTemplate = TemplateService._generate1NRelationTemplate(
          arrayName,
          relationConfig,
          user,
          maxDepth - 1,
          oneToManyStyle,
          '  '
        );
        template += oneNTemplate;
      }
    }

    if (includeWrapper) {
      template += '</article>\n';
    }

    return template;
  }

  /**
   * Génère le template pour les champs de base (non-relations)
   * @private
   */
  static _generateBaseFieldsTemplate(fields, includeSystemFields, indent = '') {
    let template = '';
    const systemFields = ['ownerId', 'granted', 'createdAt', 'updatedAt'];

    for (const [fieldName, fieldConfig] of Object.entries(fields)) {
      // Ignorer les relations et les champs système si demandé
      if (fieldConfig.relation) continue;
      if (!includeSystemFields && systemFields.includes(fieldName)) continue;
      if (fieldConfig.isPrimary) continue; // Ignorer l'id (déjà dans data-id)

      const renderer = fieldConfig.renderer;

      if (renderer === 'image') {
        template += `${indent}<div class="field field-image ${fieldName}">\n`;
        template += `${indent}  <label>${TemplateService._humanizeFieldName(fieldName)}</label>\n`;
        template += `${indent}  {{#${fieldName}}}<img src="{{${fieldName}}}" alt="{{${fieldName}}}" class="image-preview" />{{/${fieldName}}}\n`;
        template += `${indent}</div>\n`;
      } else if (renderer === 'url') {
        template += `${indent}<div class="field field-url ${fieldName}">\n`;
        template += `${indent}  <label>${TemplateService._humanizeFieldName(fieldName)}</label>\n`;
        template += `${indent}  {{#${fieldName}}}<a href="{{${fieldName}}}" target="_blank" rel="noopener">{{${fieldName}}}</a>{{/${fieldName}}}\n`;
        template += `${indent}</div>\n`;
      } else if (renderer === 'email') {
        template += `${indent}<div class="field field-email ${fieldName}">\n`;
        template += `${indent}  <label>${TemplateService._humanizeFieldName(fieldName)}</label>\n`;
        template += `${indent}  {{#${fieldName}}}<a href="mailto:{{${fieldName}}}">{{${fieldName}}}</a>{{/${fieldName}}}\n`;
        template += `${indent}</div>\n`;
      } else if (renderer === 'telephone') {
        template += `${indent}<div class="field field-telephone ${fieldName}">\n`;
        template += `${indent}  <label>${TemplateService._humanizeFieldName(fieldName)}</label>\n`;
        template += `${indent}  {{#${fieldName}}}<a href="tel:{{${fieldName}}}">{{${fieldName}}}</a>{{/${fieldName}}}\n`;
        template += `${indent}</div>\n`;
      } else if (renderer === 'datetime' || renderer === 'date' || renderer === 'time') {
        template += `${indent}<div class="field field-${renderer} ${fieldName}">\n`;
        template += `${indent}  <label>${TemplateService._humanizeFieldName(fieldName)}</label>\n`;
        template += `${indent}  {{#${fieldName}}}<time datetime="{{${fieldName}}}">{{${fieldName}}}</time>{{/${fieldName}}}\n`;
        template += `${indent}</div>\n`;
      } else if (fieldConfig.type === 'text') {
        template += `${indent}<div class="field field-text ${fieldName}">\n`;
        template += `${indent}  <label>${TemplateService._humanizeFieldName(fieldName)}</label>\n`;
        template += `${indent}  {{#${fieldName}}}<div class="text-content">{{{${fieldName}}}}</div>{{/${fieldName}}}\n`;
        template += `${indent}</div>\n`;
      } else {
        // Champ simple (varchar, integer, etc.)
        template += `${indent}<div class="field field-simple ${fieldName}">\n`;
        template += `${indent}  <label>${TemplateService._humanizeFieldName(fieldName)}</label>\n`;
        template += `${indent}  <div class="value">{{${fieldName}}}</div>\n`;
        template += `${indent}</div>\n`;
      }
    }

    return template;
  }

  /**
   * Génère le template pour une relation n:1 (many-to-one)
   * @private
   */
  static _generateN1RelationTemplate(fieldName, relationConfig, indent = '') {
    const relatedTable = relationConfig.relatedTable;
    const relatedTableConfig = SchemaService.getTableConfig(relatedTable);
    const displayFields = SchemaService.getDisplayFields(relatedTable) || ['name'];

    let template = `${indent}{{#${fieldName}}}\n`;
    template += `${indent}<div class="relation relation-n1 ${fieldName}" data-table="${relatedTable}">\n`;
    template += `${indent}  <h3>${TemplateService._humanizeFieldName(fieldName)}</h3>\n`;

    // Afficher les champs d'affichage de la table liée
    for (const displayField of displayFields) {
      const fieldConfig = relatedTableConfig?.fields?.[displayField];

      if (fieldConfig?.renderer === 'image') {
        template += `${indent}  {{#${displayField}}}<img src="{{${displayField}}}" alt="{{${displayField}}}" class="relation-image" />{{/${displayField}}}\n`;
      } else {
        template += `${indent}  <div class="relation-value">{{${displayField}}}</div>\n`;
      }
    }

    // Ajouter description si elle existe
    if (relatedTableConfig?.fields?.description) {
      template += `${indent}  {{#description}}<div class="relation-description">{{description}}</div>{{/description}}\n`;
    }

    template += `${indent}</div>\n`;
    template += `${indent}{{/${fieldName}}}\n`;

    return template;
  }

  /**
   * Génère le template pour une relation 1:n (one-to-many)
   * Inclut les relations n:1 imbriquées si maxDepth > 0
   * @private
   */
  static _generate1NRelationTemplate(arrayName, relationConfig, user, maxDepth = 1, style = 'cards', indent = '') {
    // Si le style est 'table', utiliser la méthode spécifique
    if (style === 'table') {
      return TemplateService._generate1NRelationTableTemplate(arrayName, relationConfig, user, maxDepth, indent);
    }

    // Sinon, utiliser le rendu en cards (comportement par défaut)
    const relatedTable = relationConfig.relatedTable;
    const relatedTableConfig = SchemaService.getTableConfig(relatedTable);
    const parentFieldName = relationConfig.relationFieldName; // Le champ qui référence le parent

    let template = `${indent}{{#${arrayName}}}\n`;
    template += `${indent}<div class="relation relation-1n ${arrayName}">\n`;
    template += `${indent}  <h3>${TemplateService._humanizeFieldName(arrayName)}</h3>\n`;
    template += `${indent}  <div class="relation-items">\n`;

    // Afficher les champs de base de la relation
    const baseFieldsTemplate = TemplateService._generateBaseFieldsTemplate(
      relatedTableConfig.fields,
      false, // Ne pas inclure les champs système
      `${indent}    `
    );
    template += baseFieldsTemplate;

    // Si maxDepth > 0, ajouter les relations n:1 imbriquées
    // Mais exclure la relation n:1 vers le parent (déjà exprimée dans la relation 1:n master)
    if (maxDepth > 0) {
      const { relationsN1: nestedRelationsN1 } = SchemaService.getTableRelations(user, relatedTable);

      if (Object.keys(nestedRelationsN1).length > 0) {
        template += `${indent}    <!-- Relations n:1 imbriquées -->\n`;
        for (const [nestedFieldName, nestedRelationConfig] of Object.entries(nestedRelationsN1)) {
          // Ignorer le lien n:1 déjà exprimé dans le lien master
          // Ex: MusicAlbum -> track -> (ne pas citer idMusicAlbum)
          if (nestedFieldName === parentFieldName) {
            continue;
          }

          const nestedTemplate = TemplateService._generateN1RelationTemplate(
            nestedFieldName,
            nestedRelationConfig,
            `${indent}    `
          );
          template += nestedTemplate;
        }
      }
    }

    template += `${indent}  </div>\n`;
    template += `${indent}</div>\n`;
    template += `${indent}{{/${arrayName}}}\n`;

    return template;
  }

  /**
   * Génère le template pour une relation 1:n sous forme de table HTML
   * @private
   */
  static _generate1NRelationTableTemplate(arrayName, relationConfig, user, maxDepth = 1, indent = '') {
    const relatedTable = relationConfig.relatedTable;
    const relatedTableConfig = SchemaService.getTableConfig(relatedTable);
    const systemFields = ['ownerId', 'granted', 'createdAt', 'updatedAt'];
    const parentFieldName = relationConfig.relationFieldName; // Le champ qui référence le parent

    // Récupérer les champs à afficher (non-relations, non-système, non-id)
    const fields = Object.entries(relatedTableConfig.fields)
      .filter(([fieldName, fieldConfig]) => {
        if (fieldConfig.isPrimary) return false; // Exclure l'id
        if (fieldConfig.relation) return false; // Exclure les relations n:1 de la table
        if (systemFields.includes(fieldName)) return false; // Exclure les champs système
        return true;
      });

    // Récupérer aussi les relations n:1 si maxDepth > 0
    // Mais exclure la relation n:1 vers le parent (déjà exprimée dans la relation 1:n master)
    let nestedRelationsN1 = {};
    if (maxDepth > 0) {
      const relations = SchemaService.getTableRelations(user, relatedTable);
      nestedRelationsN1 = relations.relationsN1 || {};

      // Ignorer le lien n:1 déjà exprimé dans le lien master
      // Ex: MusicAlbum -> track -> (ne pas citer idMusicAlbum)
      if (parentFieldName && nestedRelationsN1[parentFieldName]) {
        delete nestedRelationsN1[parentFieldName];
      }
    }

    let template = `${indent}<div class="relation relation-1n relation-1n-table ${arrayName}">\n`;
    template += `${indent}  <h3>${TemplateService._humanizeFieldName(arrayName)}</h3>\n`;
    template += `${indent}  <table class="relation-table" data-table="${relatedTable}">\n`;

    // En-tête de table
    template += `${indent}    <thead>\n`;
    template += `${indent}      <tr>\n`;

    // Colonnes pour les champs de base
    for (const [fieldName, fieldConfig] of fields) {
      template += `${indent}        <th data-field="${fieldName}">${TemplateService._humanizeFieldName(fieldName)}</th>\n`;
    }

    // Colonnes pour les relations n:1
    for (const [fieldName, relationN1Config] of Object.entries(nestedRelationsN1)) {
      template += `${indent}        <th data-field="${fieldName}" data-relation="n1">${TemplateService._humanizeFieldName(fieldName)}</th>\n`;
    }

    template += `${indent}      </tr>\n`;
    template += `${indent}    </thead>\n`;

    // Corps de table
    template += `${indent}    <tbody>\n`;
    template += `${indent}      {{#${arrayName}}}\n`;
    template += `${indent}      <tr data-id="{{id}}">\n`;

    // Cellules pour les champs de base
    for (const [fieldName, fieldConfig] of fields) {
      const renderer = fieldConfig.renderer;

      template += `${indent}        <td data-field="${fieldName}" data-type="${fieldConfig.type || 'varchar'}">\n`;

      if (renderer === 'image') {
        template += `${indent}          {{#${fieldName}}}<img src="{{${fieldName}}}" alt="{{${fieldName}}}" class="table-image" style="max-width: 100px; max-height: 100px;" />{{/${fieldName}}}\n`;
      } else if (renderer === 'url') {
        template += `${indent}          {{#${fieldName}}}<a href="{{${fieldName}}}" target="_blank" rel="noopener">🔗</a>{{/${fieldName}}}\n`;
      } else if (renderer === 'email') {
        template += `${indent}          {{#${fieldName}}}<a href="mailto:{{${fieldName}}}">{{${fieldName}}}</a>{{/${fieldName}}}\n`;
      } else if (renderer === 'telephone') {
        template += `${indent}          {{#${fieldName}}}<a href="tel:{{${fieldName}}}">{{${fieldName}}}</a>{{/${fieldName}}}\n`;
      } else if (renderer === 'datetime' || renderer === 'date' || renderer === 'time') {
        template += `${indent}          {{#${fieldName}}}<time datetime="{{${fieldName}}}">{{${fieldName}}}</time>{{/${fieldName}}}\n`;
      } else if (fieldConfig.type === 'text') {
        template += `${indent}          {{#${fieldName}}}<div class="text-preview" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{{${fieldName}}}</div>{{/${fieldName}}}\n`;
      } else {
        template += `${indent}          {{${fieldName}}}\n`;
      }

      template += `${indent}        </td>\n`;
    }

    // Cellules pour les relations n:1
    for (const [fieldName, relationN1Config] of Object.entries(nestedRelationsN1)) {
      const relatedTable = relationN1Config.relatedTable;
      const displayFields = SchemaService.getDisplayFields(relatedTable) || ['name'];

      template += `${indent}        <td data-field="${fieldName}" data-relation="n1">\n`;
      template += `${indent}          {{#${fieldName}}}\n`;

      // Afficher les displayFields de la relation
      for (const displayField of displayFields) {
        template += `${indent}            {{${displayField}}}\n`;
      }

      template += `${indent}          {{/${fieldName}}}\n`;
      template += `${indent}        </td>\n`;
    }

    template += `${indent}      </tr>\n`;
    template += `${indent}      {{/${arrayName}}}\n`;
    template += `${indent}    </tbody>\n`;
    template += `${indent}  </table>\n`;
    template += `${indent}</div>\n`;

    return template;
  }

  /**
   * Convertit un nom de champ en format lisible
   * Ex: "byArtist" -> "By Artist", "recordLabel" -> "Record Label"
   * @private
   */
  static _humanizeFieldName(fieldName) {
    return fieldName
      // Séparer les mots par espaces (camelCase ou PascalCase)
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      // Capitaliser la première lettre
      .replace(/^./, str => str.toUpperCase());
  }

}
module.exports = TemplateService;
