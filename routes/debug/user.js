const express = require('express');
const router = express.Router();
const pool = require('../../config/database');
const { getUserAllRoles, getAllPermissions, getInheritedRoles } = require('../../utils/permissions');
const schema = require('../../schema.js');
const { generateDebugHTML } = require('./utils');

/**
 * GET /debug/user
 * Affiche la fiche complète de l'utilisateur connecté
 */
router.get('/user', async (req, res) => {
  try {
    // Vérifier si l'utilisateur est connecté
    if (!req.user) {
      return res.send(generateDebugHTML('Utilisateur non connecté', {
        message: 'Aucun utilisateur connecté',
        info: 'Veuillez vous connecter pour voir votre fiche utilisateur'
      }));
    }

    // Récupérer les informations complètes de l'utilisateur depuis la base de données
    const [users] = await pool.query(
      'SELECT * FROM Person WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).send(generateDebugHTML('Utilisateur introuvable', {
        error: 'Utilisateur introuvable dans la base de données'
      }));
    }

    const user = users[0];
    const allRoles = getUserAllRoles(user);

    // Masquer le mot de passe pour l'affichage
    const userDisplay = { ...user };
    if (userDisplay.password) {
      userDisplay.password = '********';
    }

    const data = {
      'ID': user.id,
      'Prénom': user.givenName || '-',
      'Nom': user.familyName || '-',
      'Email': user.email || '-',
      'Téléphone': user.telephone || '-',
      'Rôles directs': user.roles || 'public',
      'Tous les rôles (avec héritage)': allRoles.join(', '),
      'Actif': user.isActive ? 'Oui' : 'Non',
      'Créé le': user.createdAt || '-',
      'Mis à jour le': user.updatedAt || '-',
      'Propriétaire ID': user.ownerId || '-',
      'Granted': user.granted || '-'
    };

    res.send(generateDebugHTML('Fiche Utilisateur', data));

  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    res.status(500).send(generateDebugHTML('Erreur', {
      error: 'Erreur serveur lors de la récupération des données utilisateur'
    }));
  }
});

/**
 * GET /debug/user/grant
 * Affiche toutes les autorisations héritées de l'utilisateur
 */
router.get('/user/grant', async (req, res) => {
  try {
    // Vérifier si l'utilisateur est connecté
    if (!req.user) {
      return res.send(generateDebugHTML('Utilisateur non connecté', {
        message: 'Aucun utilisateur connecté',
        info: 'Veuillez vous connecter pour voir vos autorisations'
      }));
    }

    // Récupérer les informations de l'utilisateur depuis la base de données
    const [users] = await pool.query(
      'SELECT * FROM Person WHERE id = ?',
      [req.user.id]
    );

    if (users.length === 0) {
      return res.status(404).send(generateDebugHTML('Utilisateur introuvable', {
        error: 'Utilisateur introuvable dans la base de données'
      }));
    }

    const user = users[0];
    const allRoles = getUserAllRoles(user);
    const permissions = getAllPermissions(user);

    // Créer le HTML pour l'affichage des permissions
    let html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Autorisations - ${user.givenName || ''} ${user.familyName || ''}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      padding: 20px;
    }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    h1 { color: #333; margin-bottom: 10px; font-size: 24px; }
    .subtitle { color: #666; margin-bottom: 30px; }
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
    .section { margin-bottom: 30px; }
    .section h2 { color: #555; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #007bff; padding-bottom: 8px; }
    .roles-list { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 20px; }
    .role-badge {
      padding: 6px 12px;
      background: #e3f2fd;
      color: #1976d2;
      border-radius: 4px;
      font-size: 14px;
      font-weight: 500;
    }
    .permissions-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    .permissions-table th {
      background: #f8f9fa;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #dee2e6;
      color: #495057;
    }
    .permissions-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #dee2e6;
    }
    .permissions-table tbody tr:hover { background: #f8f9fa; }
    .permission-cell { text-align: center; }
    .permission-yes { color: #28a745; font-weight: bold; }
    .permission-no { color: #dc3545; }
    .role-inheritance { margin-top: 30px; }
    .inheritance-item {
      margin-bottom: 15px;
      padding: 15px;
      background: #f8f9fa;
      border-radius: 4px;
    }
    .inheritance-item h3 {
      color: #333;
      font-size: 16px;
      margin-bottom: 8px;
    }
    .inheritance-item p {
      color: #666;
      font-size: 14px;
    }
    .inheritance-chain {
      margin-top: 8px;
      font-size: 14px;
      color: #007bff;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Autorisations héritées</h1>
    <div class="subtitle">Utilisateur: ${user.givenName || ''} ${user.familyName || ''} (${user.email})</div>

    <div class="nav">
      <a href="/">← Accueil</a>
      <a href="/_debug/">Debug Index</a>
      <a href="/_debug/user">Fiche utilisateur</a>
    </div>

    <div class="section">
      <h2>Rôles de l'utilisateur</h2>
      <div class="roles-list">
        ${allRoles.map(role => `<span class="role-badge">${role}</span>`).join('')}
      </div>
    </div>

    <div class="section">
      <h2>Permissions par table</h2>
      <table class="permissions-table">
        <thead>
          <tr>
            <th>Table</th>
            <th class="permission-cell">Read</th>
            <th class="permission-cell">Create</th>
            <th class="permission-cell">Update</th>
            <th class="permission-cell">Delete</th>
            <th class="permission-cell">Publish</th>
          </tr>
        </thead>
        <tbody>
    `;

    // Ajouter les permissions pour chaque table
    for (const tableName in permissions) {
      const tablePerms = permissions[tableName];
      html += `
          <tr>
            <td><strong>${tableName}</strong></td>
            <td class="permission-cell ${tablePerms.read ? 'permission-yes' : 'permission-no'}">
              ${tablePerms.read ? '✓' : '✗'}
            </td>
            <td class="permission-cell ${tablePerms.create ? 'permission-yes' : 'permission-no'}">
              ${tablePerms.create ? '✓' : '✗'}
            </td>
            <td class="permission-cell ${tablePerms.update ? 'permission-yes' : 'permission-no'}">
              ${tablePerms.update ? '✓' : '✗'}
            </td>
            <td class="permission-cell ${tablePerms.delete ? 'permission-yes' : 'permission-no'}">
              ${tablePerms.delete ? '✓' : '✗'}
            </td>
            <td class="permission-cell ${tablePerms.publish ? 'permission-yes' : 'permission-no'}">
              ${tablePerms.publish ? '✓' : '✗'}
            </td>
          </tr>
      `;
    }

    html += `
        </tbody>
      </table>
    </div>

    <div class="section role-inheritance">
      <h2>Héritage des rôles</h2>
    `;

    // Afficher l'héritage pour chaque rôle
    for (const role of allRoles) {
      if (schema.roles[role]) {
        const inherited = getInheritedRoles(role);
        html += `
      <div class="inheritance-item">
        <h3>${role}</h3>
        <p>${schema.roles[role].description}</p>
        <div class="inheritance-chain">
          Hérite de: ${schema.roles[role].inherits.length > 0 ? schema.roles[role].inherits.join(', ') : 'aucun'}
        </div>
        <div class="inheritance-chain">
          Tous les rôles hérités: ${inherited.join(' → ')}
        </div>
      </div>
        `;
      }
    }

    html += `
    </div>
  </div>
</body>
</html>
    `;

    res.send(html);

  } catch (error) {
    console.error('Erreur lors de la récupération des autorisations:', error);
    res.status(500).send(generateDebugHTML('Erreur', {
      error: 'Erreur serveur lors de la récupération des autorisations'
    }));
  }
});

module.exports = router;
