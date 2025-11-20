const express = require('express');
const router = express.Router();
const EmailService = require('../services/emailService');
const EmailQueueService = require('../services/emailQueueService');
const NewsletterService = require('../services/newsletterService');
const AuthService = require('../services/authService');

/**
 * Routes pour la gestion des emails et newsletters
 *
 * Endpoints :
 * - POST /queue/:id - Générer la queue pour une newsletter
 * - POST /process-batch - Traiter un batch d'emails
 * - GET /stats/:id - Statistiques d'une newsletter
 * - GET /preview/:id - Prévisualiser une newsletter
 * - GET /track/:id/pixel.gif - Tracking pixel (ouverture)
 * - POST /test - Envoyer un email de test
 * - POST /retry/:id - Réessayer les emails échoués
 * - POST /cancel/:id - Annuler une newsletter
 * - GET /rate-limit - Vérifier la limite horaire
 * - POST /sample - Créer une newsletter de test
 */

// ========================================
// GÉNÉRATION DE LA QUEUE
// ========================================

/**
 * POST /_api/email/queue/:id
 * Génère la file d'attente pour une newsletter
 * Crée une EmailQueue pour chaque abonné (isSubscribed=1)
 */
router.post('/queue/:id', AuthService.authMiddleware, async (req, res) => {
  try {
    const newsletterId = parseInt(req.params.id);

    if (isNaN(newsletterId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid newsletter ID'
      });
    }

    const result = await EmailQueueService.generateQueue(newsletterId);
    res.json(result);
  } catch (error) {
    console.error('Error generating queue:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// TRAITEMENT PAR BATCH
// ========================================

/**
 * POST /_api/email/process-batch
 * Traite un batch d'emails en attente
 * Respecte la limite horaire (emailRateLimit du schema)
 *
 * Body (optionnel):
 * - batchSize: nombre max d'emails à envoyer (défaut: limite disponible)
 */
router.post('/process-batch', async (req, res) => {
  try {
    const batchSize = req.body.batchSize ? parseInt(req.body.batchSize) : null;

    const result = await EmailQueueService.processBatch(batchSize);
    res.json(result);
  } catch (error) {
    console.error('Error processing batch:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// STATISTIQUES
// ========================================

/**
 * GET /_api/email/stats/:id
 * Récupère les statistiques d'une newsletter
 */
router.get('/stats/:id', AuthService.authMiddleware, async (req, res) => {
  try {
    const newsletterId = parseInt(req.params.id);

    if (isNaN(newsletterId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid newsletter ID'
      });
    }

    const result = await EmailQueueService.getNewsletterStats(newsletterId);
    res.json(result);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// PRÉVISUALISATION
// ========================================

/**
 * GET /_api/email/preview/:id
 * Prévisualise une newsletter avec données de test
 *
 * Query params (optionnels):
 * - givenName, familyName, email pour personnaliser
 */
router.get('/preview/:id', AuthService.authMiddleware, async (req, res) => {
  try {
    const newsletterId = parseInt(req.params.id);

    if (isNaN(newsletterId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid newsletter ID'
      });
    }

    // Données de test personnalisables via query params
    const testRecipient = {
      givenName: req.query.givenName || 'Prénom',
      familyName: req.query.familyName || 'Nom',
      email: req.query.email || 'test@example.com'
    };

    const html = await NewsletterService.previewEmail(newsletterId, testRecipient);

    // Retourner le HTML directement (pour affichage dans le navigateur)
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    console.error('Error previewing email:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/template', AuthService.authMiddleware, async (req, res) => {
  try {
  
    function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    const html = await NewsletterService.getDefaultTemplate();
    // Retourner le HTML directement (pour affichage dans le navigateur)
    res.setHeader('Content-Type', 'text/html');
    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>getDefaultTemplate</title>
</head><body>
  <pre><code class="html">
    ${escapeHTML(html)}
  </code></pre>
  <link rel="stylesheet" href="//cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/default.min.css">
  <script src="//cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script>hljs.highlightAll();</script>
</body></html>

`);
  } catch (error) {
    console.error('Error template:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// TRACKING PIXEL
// ========================================

/**
 * GET /_api/email/track/:id/pixel.gif
 * Pixel de tracking invisible (1x1 gif)
 * Enregistre l'ouverture de l'email
 */
router.get('/track/:id/pixel.gif', async (req, res) => {
  try {
    const emailQueueId = parseInt(req.params.id);

    if (!isNaN(emailQueueId)) {
      // Enregistrer l'ouverture (async, ne pas bloquer la réponse)
      EmailService.trackEmailOpen(emailQueueId).catch(err => {
        console.error('Error tracking email open:', err);
      });
    }

    // Retourner un GIF transparent 1x1
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );

    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Content-Length', pixel.length);
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.send(pixel);
  } catch (error) {
    console.error('Error serving tracking pixel:', error);
    // Retourner quand même le pixel pour ne pas casser l'email
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    res.setHeader('Content-Type', 'image/gif');
    res.send(pixel);
  }
});

// ========================================
// EMAIL DE TEST
// ========================================

/**
 * POST /_api/email/test
 * Envoie un email de test pour vérifier la configuration SMTP
 *
 * Body:
 * - to: adresse email du destinataire
 */
router.post('/test', AuthService.authMiddleware, async (req, res) => {
  try {
    const { to } = req.body;

    if (!to) {
      return res.status(400).json({
        success: false,
        error: 'Missing "to" parameter'
      });
    }

    const result = await EmailService.sendTestEmail(to);
    res.json(result);
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// VÉRIFICATION CONFIG SMTP
// ========================================

/**
 * GET /_api/email/verify
 * Vérifie la configuration SMTP
 */
router.get('/verify', AuthService.authMiddleware, async (req, res) => {
  try {
    const result = await EmailService.verifyConfiguration();
    res.json(result);
  } catch (error) {
    console.error('Error verifying config:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// RETRY DES ÉCHECS
// ========================================

/**
 * POST /_api/email/retry/:id
 * Réessaye tous les emails échoués d'une newsletter
 * Remet les status "failed" en "pending"
 */
router.post('/retry/:id', AuthService.authMiddleware, async (req, res) => {
  try {
    const newsletterId = parseInt(req.params.id);

    if (isNaN(newsletterId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid newsletter ID'
      });
    }

    const result = await EmailQueueService.retryFailed(newsletterId);
    res.json(result);
  } catch (error) {
    console.error('Error retrying failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// ANNULATION
// ========================================

/**
 * POST /_api/email/cancel/:id
 * Annule une newsletter
 * Marque tous les pending comme "skipped" et la newsletter comme "cancelled"
 */
router.post('/cancel/:id', AuthService.authMiddleware, async (req, res) => {
  try {
    const newsletterId = parseInt(req.params.id);

    if (isNaN(newsletterId)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid newsletter ID'
      });
    }

    const result = await EmailQueueService.cancelNewsletter(newsletterId);
    res.json(result);
  } catch (error) {
    console.error('Error cancelling newsletter:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// RATE LIMIT
// ========================================

/**
 * GET /_api/email/rate-limit
 * Vérifie l'état actuel de la limite horaire
 */
router.get('/rate-limit', async (req, res) => {
  try {
    const result = await EmailQueueService.checkRateLimit();
    res.json({
      success: true,
      rateLimit: result
    });
  } catch (error) {
    console.error('Error checking rate limit:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// CRÉER NEWSLETTER DE TEST
// ========================================

/**
 * POST /_api/email/sample
 * Crée une newsletter de test avec News de démo
 */
router.post('/sample', AuthService.authMiddleware, async (req, res) => {
  try {
    const result = await NewsletterService.createSampleNewsletter();
    res.json(result);
  } catch (error) {
    console.error('Error creating sample newsletter:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
