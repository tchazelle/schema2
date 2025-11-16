const express = require('express');
const mustache = require('mustache');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();


// Import des utilitaires
const { authMiddleware, userEnrichMiddleware } = require('./services/authService');
const pool = require('./config/database');
const schema = require('./schema.js');
const { syncDatabase } = require('./services/dbSyncService');

// Import des routes

const authRouter = require('./routes/auth');
const crudRouter = require('./routes/crud');
const apiRouter = require('./routes/api');
const attachmentsRouter = require('./routes/attachments');
const calendarRouter = require('./routes/calendar');
const pagesRouter = require('./routes/pages');

// Création de l'application Express
const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Middleware d'authentification global
app.use(authMiddleware);

// Middleware d'enrichissement de l'utilisateur
app.use(userEnrichMiddleware);

// Servir les fichiers statiques
app.use(express.static(path.join(__dirname, 'public')));

// Servir les fichiers uploadés (protégés par authentification)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes

app.use('/_user', authRouter);
app.use('/_crud', crudRouter);
app.use('/_api', attachmentsRouter);
app.use('/_api', apiRouter);
app.use('/_calendar', calendarRouter);
// Route /:page doit être en dernier car c'est un catch-all
app.use('/', pagesRouter);

// Gestion des erreurs 404
app.use((req, res) => {
  res.status(404).send(`
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Page non trouvée</title>
  <link rel="stylesheet" href="/css/error-pages.css">
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
  <link rel="stylesheet" href="/css/error-pages.css">
</head>
<body>
  <div class="container">
    <h1 class="error-500">Erreur serveur</h1>
    <p>Une erreur est survenue lors du traitement de votre requête</p>
    <a href="/">Retour à l'accueil</a>
  </div>
</body>
</html>
  `);
});

// Démarrage du serveur
app.listen(PORT, async () => {
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✓ ${schema.appName} - Version ${schema.version}`);
  console.log(`✓ Serveur démarré sur http://localhost:${PORT}`);
  console.log(`✓ Environnement: ${process.env.NODE_ENV || 'development'}`);
  console.log('═══════════════════════════════════════════════════════');

  // Vérifier et synchroniser la structure de la base de données
  await syncDatabase();
});

// Gestion de l'arrêt propre du serveur
process.on('SIGINT', async () => {
  console.log('\n\nArrêt du serveur...');
  await pool.end();
  console.log('✓ Connexions MySQL fermées');
  process.exit(0);
});
