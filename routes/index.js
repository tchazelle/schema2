const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { getAccessibleTables, getUserAllRoles } = require('../utils/permissions');
const schema = require('../schema.js');

/**
 * GET /
 * Page d'accueil avec menu du site et menu utilisateur
 */
router.get('/', async (req, res) => {
  try {
    const user = req.user;

    // Déterminer si l'utilisateur est connecté
    const isAuthenticated = !!user;

    // Récupérer les informations complètes de l'utilisateur si connecté
    let fullUser = null;
    if (isAuthenticated) {
      const [users] = await pool.query(
        'SELECT * FROM Person WHERE id = ?',
        [user.id]
      );
      if (users.length > 0) {
        fullUser = users[0];
      }
    }

    // Récupérer les tables accessibles
    const accessibleTables = fullUser ? getAccessibleTables(fullUser) : [];

    // Récupérer les pages accessibles (selon granted)
    // Pour l'instant, on récupère toutes les pages publiques ou partagées
    const [pages] = await pool.query(
      'SELECT * FROM Page WHERE granted IN (?, ?) ORDER BY position ASC',
      ['published @public', 'shared']
    );

    // Récupérer tous les rôles de l'utilisateur
    const allRoles = fullUser ? getUserAllRoles(fullUser) : ['public'];

    // Générer le HTML
    const html = generateHomeHTML(fullUser, pages, accessibleTables, allRoles, isAuthenticated);
    res.send(html);

  } catch (error) {
    console.error('Erreur lors du chargement de la page d\'accueil:', error);
    res.status(500).send('<h1>Erreur serveur</h1>');
  }
});

/**
 * Génère le HTML de la page d'accueil
 */
function generateHomeHTML(user, pages, accessibleTables, allRoles, isAuthenticated) {
  const userName = user ? `${user.givenName || ''} ${user.familyName || ''}`.trim() || user.email : 'Invité';

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

    /* Menu hamburger */
    .menu-toggle {
      position: fixed;
      top: 20px;
      left: 20px;
      background: #007bff;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 18px;
      z-index: 1001;
    }
    .menu-toggle:hover { background: #0056b3; }

    .sidebar {
      position: fixed;
      top: 0;
      left: -300px;
      width: 300px;
      height: 100vh;
      background: white;
      box-shadow: 2px 0 8px rgba(0,0,0,0.1);
      transition: left 0.3s ease;
      z-index: 1000;
      overflow-y: auto;
    }

    .sidebar.open { left: 0; }

    .sidebar-header {
      padding: 20px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }

    .sidebar-header h2 {
      font-size: 18px;
      color: #333;
      margin-bottom: 5px;
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

  <!-- Menu hamburger -->
  <button class="menu-toggle" onclick="toggleMenu()">☰</button>

  <!-- Sidebar -->
  <nav class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <h2>${schema.appName}</h2>
      <p style="color: #666; font-size: 12px;">Version ${schema.version}</p>
    </div>

    <div class="sidebar-section">
      <h3>Pages</h3>
      <ul>
        ${pages.length > 0 ? pages.map(page => `
          <li><a href="/${page.slug}">${page.name}</a></li>
        `).join('') : '<li style="color: #999; padding: 8px 12px;">Aucune page disponible</li>'}
      </ul>
    </div>

    <div class="sidebar-section">
      <h3>Tables</h3>
      <ul>
        ${accessibleTables.length > 0 ? accessibleTables.map(table => `
          <li><a href="/_crud/${table}">${table}</a></li>
        `).join('') : '<li style="color: #999; padding: 8px 12px;">Aucune table accessible</li>'}
      </ul>
    </div>

    ${isAuthenticated ? `
    <div class="sidebar-section">
      <h3>Debug</h3>
      <ul>
        <li><a href="/_debug/user">Fiche utilisateur</a></li>
        <li><a href="/_debug/user/grant">Autorisations</a></li>
      </ul>
    </div>
    ` : ''}
  </nav>

  <!-- Header -->
  <header>
    <div class="logo">${schema.appName}</div>

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
  </header>

  <!-- Contenu principal -->
  <div class="container">
    <div class="welcome">
      <h1>Bienvenue${isAuthenticated ? ', ' + userName : ''}</h1>
      <p>${isAuthenticated ? 'Vous êtes connecté à votre espace' : 'Veuillez vous connecter pour accéder à votre espace'}</p>
    </div>

    ${!isAuthenticated ? `
    <div class="login-form">
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
    ` : `
    <div class="stats">
      <div class="stat-card">
        <h3>Tables accessibles</h3>
        <div class="number">${accessibleTables.length}</div>
      </div>
      <div class="stat-card">
        <h3>Pages disponibles</h3>
        <div class="number">${pages.length}</div>
      </div>
      <div class="stat-card">
        <h3>Rôles actifs</h3>
        <div class="number">${allRoles.length}</div>
      </div>
    </div>
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
</body>
</html>
  `;
}

module.exports = router;
