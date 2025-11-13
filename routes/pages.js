const express = require('express');
const mustache = require('mustache');
const router = express.Router();
const pool = require('../config/database');
const { getAccessibleTables, getUserAllRoles, hasPermission } = require('../utils/permissions');
const schema = require('../schema.js');
const { getTableData } = require('../utils/apiTables');
const { mustacheAuto } = require('../utils/mustacheAuto');
const EntityService = require('../utils/services/entityService');


function generateLoginHTML() { 
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
  </div>`
}

async function generateHomeHTML(user, pages, pageName, content, accessibleTables, allRoles, isAuthenticated) {
  const userName = user ? `${user.givenName || ''} ${user.familyName || ''}`.trim() || user.email : 'Invité';
  // [#TC] dans la page index, créer un fichier css pour alleger le code



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
    ${generateLoginHTML()}
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
  ${humanize()}
</body>
</html>
  `;
}


/**
 * GET /
 * Page d'accueil avec menu du site et menu utilisateur
 */
router.get('/:slug?', async (req, res) => {

  try {
    slug = req.params.slug ? req.params.slug : "index"
    console.log("PAGE "+slug)
    const user = req.user;
    // Déterminer si l'utilisateur est connecté
    const isAuthenticated = !!user;

    // Récupérer les informations complètes de l'utilisateur si connecté

    // [#TC] Est-ce sécurisé ? 
    // [#TC]  n'importe qui peut ajouter un cookie avec user.id = 1 ou c'est impossible ?

    let fullUser = null;
    if (isAuthenticated) {
      const [users] = await pool.query(
        'SELECT * FROM Person WHERE id = ?', // [#TC] IMPRECISION n'utilise pas les infos schema.user
        [user.id]
      );
      if (users.length > 0) {
        fullUser = users[0];
      }
    }
    // Récupérer tous les rôles de l'utilisateur
    const allRoles = fullUser ? getUserAllRoles(fullUser) : ['public'];

    // Récupérer les tables accessibles
    const accessibleTables = fullUser ? getAccessibleTables(fullUser) : [];
    
    // chargement des pages
    const pagesFormTablePage = await getTableData({ user, tableName: schema.menu.page, useProxy:1 })
    const pages = pagesFormTablePage.rows

    // page sélectionnée
    const targetPage = pages.find(page=>page.slug == slug)

    // concertion des champs table Section pour getTableData
    const translateTableDataOptions = {
        tableName:"sqlTable",
        limit: "sqlLimit",
        orderBy : "sqlOrderBy",
        customWhere : "sqlWhere",
        relation: "apiRelations",
        compact: "apiCompact",
        includeSchema : "apiSchema"
    } 
    // contruction des sections
    if(targetPage.sections) {
      const newSections = Object.fromEntries(targetPage.sections.map(section =>{
      const {id, slug, name,description} = section 
      let tableDataOptions = Object.fromEntries(
        Object.entries(translateTableDataOptions).filter(([newKey,oldKey])=>section[oldKey]).map(([newKey,oldKey])=>[newKey,section[oldKey]]) 
      )
      tableDataOptions = {user, ...tableDataOptions, useProxy:1}
        return [section.slug, {id, slug, name, description, tableDataOptions}]
      }))

      // chargement des rows 
      const data = await Promise.all(
        Object.values(newSections).map(section => getTableData(section.tableDataOptions))
      )

      // report des rows dans les sections
      const newSectionsWithRows = Object.fromEntries(
        Object.entries(newSections).map(([slug, section],i)=>{
          const sectionWithRows= Object.assign(section, data[i])
          return [slug, sectionWithRows]
        })
      )
      targetPage.sections = newSectionsWithRows
    } else newSections={}

    // rendu de la page
    let content = `
    <h1>${targetPage.name}</h1>
    <p>${targetPage.description}</p>
    <pre>${JSON.stringify(targetPage, null,2)}</pre>
    `
    // [#TC] templates automatiques des sections : ATTENTION intégrer les template de la bdd si non nuls
    const templateSections = Object.entries(targetPage.sections).map(([slug,section])=>{
      const sectionMustache = `{{#${slug}}}<section class="section ${slug}"><h3 class="name">{{name}}</h3><p class="description"></p>${mustacheAuto(section.tableDataOptions.tableName)} </section>{{/${slug}}}`
    return sectionMustache
    }).join("\n")

    const templatePage = mustacheAuto("Page") // [#TC] approximatif, c'est en attendant
    const style = `
    .rows { border: solid 1px purple; margin: 3px; padding :0.5rem}
    .row { border: solid 1px grey; margin: 3px; padding :0.5rem }
    .sub-row { border: dotted 1px grey; margin: 3px; padding :0.5rem }
    .oneToMany { border: dotted 6px grey; margin: 3px; padding :0.5rem }
  
    [data-relation=track] {  border: dotted 2px blue; color: red }
    .label {font-size:0.8rem; color: grey }
    `

    let templatePagewithNewSections = templatePage.replace(
      /{{#sections}}[\s\S]*?{{\/sections}}/g, 
      `<style>${style}</style>{{#sections}}\n${templateSections}\n{{/sections}}`
    );

    content = mustache.render(templatePagewithNewSections, {rows:targetPage})

    const html = await generateHomeHTML(user, pages, slug, content, accessibleTables, allRoles, isAuthenticated)
    res.send(html)
    return 
  
    

    

  



    const template =  `
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Albums — {{table}}</title>
  <style>
    :root { font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial; color: #222; }
    body { margin: 0; padding: 1.5rem; background:#fafafa; }
    .container { max-width: 980px; margin: 0 auto; }
    header { display:flex; align-items:baseline; gap:1rem; margin-bottom: 1.5rem; }
    header h1 { margin:0; font-size:1.5rem; }
    .album { display: grid; grid-template-columns: 180px 1fr; gap: 1rem; background: #fff; border-radius: 10px; padding: 1rem; box-shadow: 0 1px 6px rgba(0,0,0,0.04); margin-bottom: 1rem; }
    .album img { width: 100%; height: auto; border-radius:6px; object-fit:cover; }
    .meta { display:flex; flex-direction:column; gap:0.5rem; }
    .meta .title { font-size:1.15rem; font-weight:600; }
    .meta .desc { color: #555; font-size:0.95rem; }
    .meta .badges { display:flex; gap:0.5rem; flex-wrap:wrap; margin-top:0.25rem; }
    .badge { background:#eef; color:#114; padding:0.25rem 0.5rem; border-radius:6px; font-size:0.85rem; }
    .links { margin-top:0.25rem; }
    .links a { text-decoration:none; color:#0b66c2; margin-right:0.5rem; font-size:0.9rem; }
    .tracks { margin-top:0.5rem; }
    .track { display:flex; justify-content:space-between; gap:1rem; padding:0.35rem 0; border-bottom:1px dashed #eee; align-items:center; }
    .track .left { display:flex; gap:0.75rem; align-items:center; }
    .track .pos { width:28px; text-align:center; color:#666; }
    .track .name { font-weight:500; }
    .small { color:#777; font-size:0.9rem; }
    footer { margin-top:2rem; color:#666; font-size:0.9rem; text-align:center; }
    @media (max-width:640px) {
      .album { grid-template-columns: 1fr; }
      header { flex-direction:column; align-items:flex-start; gap:0.25rem; }
    }
  </style>
</head>
<body class="{{slug}}">
  ${templatePagewithNewSections}
  ${humanize()}
</body>
</html>`

html = 

res.send(html)



    return
    /*
    const [pages] = await pool.query(
      'SELECT * FROM Page WHERE granted IN (?, ?) ORDER BY position ASC',
      ['published @public', 'shared']
    );
    */

  
    // Générer le HTML
  
    res.send(html);

  } catch (error) {
    console.error('Erreur lors du chargement de la page d\'accueil:', error);
    res.status(500).send('<h1>Erreur serveur</h1>');
  }
});

// scripts client pour humaniser les datas
function humanize ()  {
  return `<script>
    // Parse une durée ISO 8601 basique (PT#H#M#S) vers "H:MM:SS" ou "M:SS"
    function formatISODuration(iso) {
      if (!iso || typeof iso !== 'string') return '';
      // ex : PT42M59S ou PT1H2M3S
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!m) return iso;
      const h = parseInt(m[1] || 0, 10);
      const min = parseInt(m[2] || 0, 10);
      const sec = parseInt(m[3] || 0, 10);
      const parts = [];
      if (h > 0) {
        // H:MM:SS
        parts.push(String(h));
        parts.push(String(min).padStart(2,'0'));
        parts.push(String(sec).padStart(2,'0'));
        return parts.join(':');
      } else {
        // M:SS
        return String(min) + ':' + String(sec).padStart(2,'0');
      }
    }

    // Formate date ISO YYYY-MM-DD ou timestamps en locale fr
    function formatDateIso(value) {
      if (!value) return '';
      // si valeur contient T -> timestamp complet
      if (value.indexOf('T') !== -1) {
        const d = new Date(value);
        if (isNaN(d)) return value;
        return d.toLocaleDateString('fr-FR', { year:'numeric', month:'long', day:'numeric' });
      }
      // sinon on tente YYYY-MM-DD
      const d = new Date(value + 'T00:00:00Z');
      if (!isNaN(d)) return d.toLocaleDateString('fr-FR', { year:'numeric', month:'long', day:'numeric' });
      return value;
    }

    document.addEventListener('DOMContentLoaded', function () {
      // formate toutes les durées
      document.querySelectorAll('[data-duration]').forEach(function(el) {
        const raw = el.getAttribute('data-duration') || '';
        const pretty = formatISODuration(raw);
        el.textContent = pretty || raw;
      });

      // formate toutes les dates
      document.querySelectorAll('[data-date]').forEach(function(el) {
        const raw = el.getAttribute('data-date') || '';
        const pretty = formatDateIso(raw);
        el.textContent = pretty || raw;
      });
    });
  </script>`
}

// [#TC] canAccessPage() et canAccessSection() déplacées dans utils/services/entityService.js
// Remplacées par EntityService.canAccessEntity()

/**
 * GET /:page
 * Retourne le setup Page-Section de la page si autorisée
 * Inclut la page et ses sections avec toutes leurs configurations
 */
router.get('/:page', async (req, res) => {
  try {
    const { page: pageSlug } = req.params;
    const user = req.user;
    res.send(pageSlug)

    // Si l'utilisateur n'est pas connecté, utiliser un user par défaut avec rôle public
    const effectiveUser = user || { roles: 'public' };

    // Récupérer la page par son slug
    // [#TC] utiliser la schema.menu pour la table qui contient les pages
    

    const [pages] = await pool.query(
      'SELECT * FROM Page WHERE slug = ?',
      [pageSlug]
    );

    if (pages.length === 0) {
      return res.status(404).json({
        error: 'Page non trouvée',
        slug: pageSlug
      });
    }

    const pageData = pages[0];

    // Vérifier si l'utilisateur peut accéder à la page
    if (!EntityService.canAccessEntity(effectiveUser, pageData, 'Page')) {
      return res.status(403).json({
        error: 'Accès refusé à cette page',
        slug: pageSlug
      });
    }

    // Récupérer les sections de la page
    const [sections] = await pool.query(
      'SELECT * FROM Section WHERE idPage = ? ORDER BY position ASC',
      [pageData.id]
    );

    // Filtrer les sections selon les permissions
    const accessibleSections = [];
    for (const section of sections) {
      if (EntityService.canAccessEntity(effectiveUser, section, 'Section')) {
        // Vérifier si l'utilisateur a accès à la table mentionnée dans la section
        if (section.tableName) {
          if (hasPermission(effectiveUser, section.tableName, 'read')) {
            // Parser relations si c'est une chaîne JSON
            let relations = null;
            if (section.relations) {
              try {
                relations = typeof section.relations === 'string'
                  ? JSON.parse(section.relations)
                  : section.relations;
              } catch (e) {
                console.warn('Erreur lors du parsing des relations:', e);
              }
            }

            accessibleSections.push({
              id: section.id,
              name: section.name,
              description: section.description,
              tableName: section.tableName,
              whereClause: section.whereClause,
              orderBy: section.orderBy,
              limit: section.limit,
              relations: relations,
              presentationType: section.presentationType,
              mustache: section.mustache,
              position: section.position,
              granted: section.granted,
              createdAt: section.createdAt,
              updatedAt: section.updatedAt
            });
          } else {
            // L'utilisateur n'a pas accès à la table de cette section
            // On peut soit ignorer la section, soit indiquer qu'elle n'est pas accessible
            accessibleSections.push({
              id: section.id,
              name: section.name,
              description: section.description,
              tableName: section.tableName,
              accessible: false,
              reason: 'Accès refusé à la table',
              position: section.position
            });
          }
        } else {
          // Section sans table (contenu statique par exemple)
          accessibleSections.push({
            id: section.id,
            name: section.name,
            description: section.description,
            mustache: section.mustache,
            position: section.position,
            granted: section.granted,
            createdAt: section.createdAt,
            updatedAt: section.updatedAt
          });
        }
      }
    }

    // Construire la réponse
    const response = {
      success: true,
      page: {
        id: pageData.id,
        slug: pageData.slug,
        name: pageData.name,
        description: pageData.description,
        mustache: pageData.mustache,
        css: pageData.css,
        position: pageData.position,
        granted: pageData.granted,
        createdAt: pageData.createdAt,
        updatedAt: pageData.updatedAt
      },
      sections: accessibleSections,
      permissions: {
        canEdit: user && hasPermission(effectiveUser, 'Page', 'update') && (pageData.ownerId === user.id || hasPermission(effectiveUser, 'Page', 'update')),
        canDelete: user && hasPermission(effectiveUser, 'Page', 'delete') && (pageData.ownerId === user.id || hasPermission(effectiveUser, 'Page', 'delete')),
        canAddSection: user && hasPermission(effectiveUser, 'Section', 'create')
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Erreur lors de la récupération de la page:', error);
    res.status(500).json({
      error: 'Erreur serveur lors de la récupération de la page'
    });
  }
});

module.exports = router;
