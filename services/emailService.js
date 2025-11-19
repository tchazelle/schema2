const nodemailer = require('nodemailer');
const pool = require('../config/database');

/**
 * Service d'envoi d'emails avec support SMTP et tracking
 *
 * Fonctionnalités :
 * - Envoi d'emails via SMTP (configuration .env)
 * - Tracking pixel pour mesurer les ouvertures
 * - Gestion des erreurs et retry
 */
class EmailService {
  /**
   * Crée et configure le transporteur SMTP
   * @returns {Object} Transporteur nodemailer configuré
   */
  static createTransporter() {
    return nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587'),
      secure: process.env.EMAIL_SECURE === 'true', // true pour port 465
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      },
      // Options supplémentaires pour compatibilité
      tls: {
        rejectUnauthorized: false // Pour éviter les erreurs de certificat en dev
      }
    });
  }

  /**
   * Génère l'URL du pixel de tracking pour une queue email
   * @param {number} emailQueueId - ID de l'EmailQueue
   * @returns {string} URL complète du pixel de tracking
   */
  static getTrackingPixelUrl(emailQueueId) {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    return `${baseUrl}/_api/email/track/${emailQueueId}/pixel.gif`;
  }

  /**
   * Génère le code HTML du pixel de tracking
   * @param {number} emailQueueId - ID de l'EmailQueue
   * @returns {string} HTML du pixel invisible
   */
  static generateTrackingPixel(emailQueueId) {
    const pixelUrl = this.getTrackingPixelUrl(emailQueueId);
    return `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:block" />`;
  }

  /**
   * Enregistre l'ouverture d'un email (appelé quand le pixel est chargé)
   * @param {number} emailQueueId - ID de l'EmailQueue
   * @returns {Promise<Object>} Résultat de l'update
   */
  static async trackEmailOpen(emailQueueId) {
    try {
      const connection = await pool.getConnection();

      try {
        // Vérifier si c'est la première ouverture
        const [rows] = await connection.query(
          'SELECT openedAt, openCount FROM EmailQueue WHERE id = ?',
          [emailQueueId]
        );

        if (rows.length === 0) {
          throw new Error(`EmailQueue ${emailQueueId} not found`);
        }

        const isFirstOpen = !rows[0].openedAt;

        // Incrémenter le compteur d'ouvertures
        await connection.query(
          `UPDATE EmailQueue
           SET openCount = openCount + 1,
               openedAt = COALESCE(openedAt, NOW()),
               updatedAt = NOW()
           WHERE id = ?`,
          [emailQueueId]
        );

        // Si première ouverture, incrémenter le compteur dans Newsletter
        if (isFirstOpen) {
          await connection.query(
            `UPDATE Newsletter n
             INNER JOIN EmailQueue eq ON n.id = eq.newsletterId
             SET n.openedCount = n.openedCount + 1
             WHERE eq.id = ?`,
            [emailQueueId]
          );
        }

        return {
          success: true,
          isFirstOpen,
          timestamp: new Date()
        };
      } finally {
        connection.release();
      }
    } catch (error) {
      console.error('Error tracking email open:', error);
      throw error;
    }
  }

  /**
   * Envoie un email avec tracking
   * @param {Object} options - Options d'envoi
   * @param {string} options.to - Email du destinataire
   * @param {string} options.subject - Sujet de l'email
   * @param {string} options.html - Corps HTML de l'email
   * @param {number} options.emailQueueId - ID de l'EmailQueue (pour tracking)
   * @param {string} options.from - Email expéditeur (optionnel, défaut = EMAIL_USER)
   * @returns {Promise<Object>} Résultat de l'envoi
   */
  static async sendEmail({ to, subject, html, emailQueueId, from }) {
    try {
      const transporter = this.createTransporter();

      // Ajouter le pixel de tracking au HTML si emailQueueId fourni
      let finalHtml = html;
      if (emailQueueId) {
        const trackingPixel = this.generateTrackingPixel(emailQueueId);
        // Insérer le pixel juste avant la fermeture du </body> si présent
        if (html.includes('</body>')) {
          finalHtml = html.replace('</body>', `${trackingPixel}</body>`);
        } else {
          finalHtml = html + trackingPixel;
        }
      }

      // Envoyer l'email
      const info = await transporter.sendMail({
        from: from || process.env.EMAIL_USER,
        to,
        subject,
        html: finalHtml
      });

      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected
      };
    } catch (error) {
      console.error('Error sending email:', error);
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  /**
   * Envoie un email de test (sans tracking)
   * @param {string} to - Email du destinataire
   * @returns {Promise<Object>} Résultat de l'envoi
   */
  static async sendTestEmail(to) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Email de test</h1>
          </div>
          <div class="content">
            <p>Ceci est un email de test envoyé depuis Schema2.</p>
            <p>Si vous recevez cet email, cela signifie que la configuration SMTP fonctionne correctement ✓</p>
            <p><strong>Configuration :</strong></p>
            <ul>
              <li>Host: ${process.env.EMAIL_HOST}</li>
              <li>Port: ${process.env.EMAIL_PORT}</li>
              <li>Secure: ${process.env.EMAIL_SECURE}</li>
              <li>User: ${process.env.EMAIL_USER}</li>
            </ul>
            <p>Date: ${new Date().toLocaleString('fr-FR')}</p>
          </div>
          <div class="footer">
            <p>Schema2 Email Service - Test automatisé</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to,
      subject: '✓ Test Email - Schema2',
      html
    });
  }

  /**
   * Vérifie la configuration SMTP
   * @returns {Promise<Object>} Résultat de la vérification
   */
  static async verifyConfiguration() {
    try {
      const transporter = this.createTransporter();
      await transporter.verify();

      return {
        success: true,
        message: 'SMTP configuration is valid',
        config: {
          host: process.env.EMAIL_HOST,
          port: process.env.EMAIL_PORT,
          secure: process.env.EMAIL_SECURE,
          user: process.env.EMAIL_USER
        }
      };
    } catch (error) {
      return {
        success: false,
        message: 'SMTP configuration is invalid',
        error: error.message
      };
    }
  }
}

module.exports = EmailService;
