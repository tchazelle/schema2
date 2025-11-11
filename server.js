const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();

// Import des utilitaires
const { authMiddleware } = require('./utils/auth');
const pool = require('./config/database');
const schema = require('./schema.js');

// Import des routes
const indexRouter = require('./routes/index');
const authRouter = require('./routes/auth');
const debugRouter = require('./routes/debug');

// Création de l'application Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Middleware d'authentification global
app.use(authMiddleware);

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', indexRouter);
app.use('/auth', authRouter);
app.use('/debug', debugRouter);

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).send(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Page non trouvée</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      text-align: center;
      background: white;
      padding: 60px 40px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      font-size: 72px;
      color: #007bff;
      margin-bottom: 20px;
    }
    p {
      font-size: 18px;
      color: #666;
      margin-bottom: 30px;
    }
    a {
      display: inline-block;
      padding: 12px 24px;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 600;
    }
    a:hover { background: #0056b3; }
  </style>
</head>
<body>
  <div class="container">
    <h1>404</h1>
    <p>Page non trouvée</p>
    <a href="/">Retour à l'accueil</a>
  </div>
</body>
</html>
  `);
});

// Gestion des erreurs globales
app.use((err, req, res, next) => {
  console.error('Erreur serveur:', err);
  res.status(500).send(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Erreur serveur</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
    }
    .container {
      text-align: center;
      background: white;
      padding: 60px 40px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      font-size: 48px;
      color: #dc3545;
      margin-bottom: 20px;
    }
    p {
      font-size: 18px;
      color: #666;
      margin-bottom: 30px;
    }
    a {
      display: inline-block;
      padding: 12px 24px;
      background: #007bff;
      color: white;
      text-decoration: none;
      border-radius: 4px;
      font-weight: 600;
    }
    a:hover { background: #0056b3; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Erreur serveur</h1>
    <p>Une erreur est survenue lors du traitement de votre requête</p>
    <a href="/">Retour à l'accueil</a>
  </div>
</body>
</html>
  `);
});

// Démarrage du serveur
app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✓ ${schema.appName} - Version ${schema.version}`);
  console.log(`✓ Serveur démarré sur http://localhost:${PORT}`);
  console.log(`✓ Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log('═══════════════════════════════════════════════════════');
});

// Gestion de l'arrêt propre du serveur
process.on('SIGINT', async () => {
  console.log('\n\nArrêt du serveur...');
  await pool.end();
  console.log('✓ Connexions MySQL fermées');
  process.exit(0);
});
