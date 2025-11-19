const pool = require('../config/database');
const schema = require('../schema');
const EmailService = require('./emailService');
const NewsletterService = require('./newsletterService');

/**
 * Service de gestion de la file d'attente d'emails
 *
 * Fonctionnalités :
 * - Génération de la queue à partir des abonnés
 * - Traitement par batch avec respect de la limite horaire
 * - Rate limiting (120 emails/heure par défaut)
 * - Gestion des erreurs et retry
 */
class EmailQueueService {
  /**
   * Génère la file d'attente pour une newsletter
   * Crée une entrée EmailQueue pour chaque abonné (Person.isSubscribed = 1)
   *
   * @param {number} newsletterId - ID de la newsletter
   * @returns {Promise<Object>} Résultat avec nombre de destinataires
   */
  static async generateQueue(newsletterId) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Vérifier que la newsletter existe et est en draft
      const [newsletters] = await connection.query(
        'SELECT id, status FROM Newsletter WHERE id = ?',
        [newsletterId]
      );

      if (newsletters.length === 0) {
        throw new Error(`Newsletter ${newsletterId} not found`);
      }

      const newsletter = newsletters[0];
      if (newsletter.status !== 'draft') {
        throw new Error(`Newsletter ${newsletterId} is not in draft status (current: ${newsletter.status})`);
      }

      // 2. Supprimer les anciennes entrées de queue si elles existent
      await connection.query(
        'DELETE FROM EmailQueue WHERE newsletterId = ?',
        [newsletterId]
      );

      // 3. Récupérer tous les abonnés actifs
      const [subscribers] = await connection.query(
        `SELECT id, email, givenName, familyName, fullName
         FROM Person
         WHERE isSubscribed = 1
           AND isActive = 1
           AND email IS NOT NULL
           AND email != ''
         ORDER BY id ASC`
      );

      if (subscribers.length === 0) {
        throw new Error('No subscribers found');
      }

      // 4. Créer les entrées EmailQueue
      const values = subscribers.map(sub => [
        newsletterId,
        sub.id,
        sub.email,
        JSON.stringify({
          givenName: sub.givenName || '',
          familyName: sub.familyName || '',
          fullName: sub.fullName || '',
          email: sub.email
        }),
        'pending'
      ]);

      await connection.query(
        `INSERT INTO EmailQueue (newsletterId, recipientId, recipientEmail, recipientData, status)
         VALUES ?`,
        [values]
      );

      // 5. Mettre à jour le statut de la newsletter
      await connection.query(
        `UPDATE Newsletter
         SET status = 'queued',
             totalRecipients = ?,
             updatedAt = NOW()
         WHERE id = ?`,
        [subscribers.length, newsletterId]
      );

      await connection.commit();

      return {
        success: true,
        newsletterId,
        totalRecipients: subscribers.length,
        message: `Queue generated successfully with ${subscribers.length} recipients`
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error generating queue:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Vérifie si on peut envoyer des emails (rate limiting)
   * Respecte la limite emailRateLimit du schema (par défaut 120/heure)
   *
   * @returns {Promise<Object>} { canSend: boolean, available: number, hourSlot: string }
   */
  static async checkRateLimit() {
    try {
      const limit = schema.emailRateLimit || 120;

      // Calculer le slot horaire actuel (arrondi à l'heure)
      const now = new Date();
      const hourSlot = new Date(now);
      hourSlot.setMinutes(0, 0, 0);
      const hourSlotStr = hourSlot.toISOString().slice(0, 19).replace('T', ' ');

      // Récupérer ou créer le tracker pour cette heure
      const [rows] = await pool.query(
        `SELECT emailsSent
         FROM EmailRateTracker
         WHERE hourSlot = ?`,
        [hourSlotStr]
      );

      let emailsSent = 0;
      if (rows.length > 0) {
        emailsSent = rows[0].emailsSent;
      }

      const available = Math.max(0, limit - emailsSent);
      const canSend = available > 0;

      return {
        canSend,
        available,
        limit,
        hourSlot: hourSlotStr,
        emailsSent
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      throw error;
    }
  }

  /**
   * Incrémente le compteur de rate limiting
   * @param {number} count - Nombre d'emails envoyés
   * @returns {Promise<void>}
   */
  static async incrementRateLimit(count = 1) {
    try {
      const now = new Date();
      const hourSlot = new Date(now);
      hourSlot.setMinutes(0, 0, 0);
      const hourSlotStr = hourSlot.toISOString().slice(0, 19).replace('T', ' ');

      await pool.query(
        `INSERT INTO EmailRateTracker (hourSlot, emailsSent, lastEmailAt)
         VALUES (?, ?, NOW())
         ON DUPLICATE KEY UPDATE
           emailsSent = emailsSent + ?,
           lastEmailAt = NOW()`,
        [hourSlotStr, count, count]
      );
    } catch (error) {
      console.error('Error incrementing rate limit:', error);
      throw error;
    }
  }

  /**
   * Traite un batch d'emails en attente
   * Respecte la limite horaire et envoie les emails
   *
   * @param {number} batchSize - Nombre maximum d'emails à envoyer (optionnel)
   * @returns {Promise<Object>} Statistiques d'envoi
   */
  static async processBatch(batchSize = null) {
    const connection = await pool.getConnection();

    try {
      // 1. Vérifier la limite horaire
      const rateLimit = await this.checkRateLimit();
      if (!rateLimit.canSend) {
        return {
          success: true,
          sent: 0,
          failed: 0,
          skipped: 0,
          message: `Rate limit reached (${rateLimit.emailsSent}/${rateLimit.limit} for hour ${rateLimit.hourSlot})`,
          rateLimitReached: true,
          nextAvailableAt: this.getNextHourSlot()
        };
      }

      // 2. Calculer le nombre d'emails à envoyer
      const maxToSend = batchSize || rateLimit.available;
      const toSend = Math.min(maxToSend, rateLimit.available);

      if (toSend === 0) {
        return {
          success: true,
          sent: 0,
          failed: 0,
          skipped: 0,
          message: 'No emails to send'
        };
      }

      // 3. Récupérer les emails en attente
      const [pendingEmails] = await connection.query(
        `SELECT eq.id, eq.newsletterId, eq.recipientEmail, eq.recipientData, eq.retryCount,
                n.subject, n.bodyTemplate
         FROM EmailQueue eq
         INNER JOIN Newsletter n ON eq.newsletterId = n.id
         WHERE eq.status = 'pending'
           AND n.status IN ('queued', 'sending')
         ORDER BY eq.createdAt ASC
         LIMIT ?`,
        [toSend]
      );

      if (pendingEmails.length === 0) {
        return {
          success: true,
          sent: 0,
          failed: 0,
          skipped: 0,
          message: 'No pending emails found'
        };
      }

      // 4. Marquer la newsletter comme "sending" si elle était "queued"
      const newsletterIds = [...new Set(pendingEmails.map(e => e.newsletterId))];
      for (const nid of newsletterIds) {
        await connection.query(
          `UPDATE Newsletter
           SET status = 'sending'
           WHERE id = ? AND status = 'queued'`,
          [nid]
        );
      }

      // 5. Envoyer les emails
      let sent = 0;
      let failed = 0;
      let skipped = 0;

      for (const emailQueue of pendingEmails) {
        try {
          // Désérialiser les données du destinataire
          const recipientData = JSON.parse(emailQueue.recipientData);

          // Rendre le template avec Mustache
          const html = await NewsletterService.renderEmailTemplate(
            emailQueue.newsletterId,
            recipientData
          );

          // Envoyer l'email
          const result = await EmailService.sendEmail({
            to: emailQueue.recipientEmail,
            subject: emailQueue.subject,
            html,
            emailQueueId: emailQueue.id
          });

          if (result.success) {
            // Marquer comme envoyé
            await connection.query(
              `UPDATE EmailQueue
               SET status = 'sent',
                   sentAt = NOW(),
                   updatedAt = NOW()
               WHERE id = ?`,
              [emailQueue.id]
            );

            // Incrémenter le compteur dans Newsletter
            await connection.query(
              `UPDATE Newsletter
               SET sentCount = sentCount + 1,
                   updatedAt = NOW()
               WHERE id = ?`,
              [emailQueue.newsletterId]
            );

            sent++;
          } else {
            throw new Error(result.error || 'Unknown error');
          }
        } catch (error) {
          console.error(`Error sending email ${emailQueue.id}:`, error);

          // Marquer comme failed
          await connection.query(
            `UPDATE EmailQueue
             SET status = 'failed',
                 errorMessage = ?,
                 retryCount = retryCount + 1,
                 updatedAt = NOW()
             WHERE id = ?`,
            [error.message, emailQueue.id]
          );

          // Incrémenter le compteur d'échecs dans Newsletter
          await connection.query(
            `UPDATE Newsletter
             SET failedCount = failedCount + 1,
                 updatedAt = NOW()
             WHERE id = ?`,
            [emailQueue.newsletterId]
          );

          failed++;
        }
      }

      // 6. Incrémenter le rate limiter
      await this.incrementRateLimit(sent);

      // 7. Vérifier si la newsletter est terminée
      for (const nid of newsletterIds) {
        const [stats] = await connection.query(
          `SELECT
             (SELECT COUNT(*) FROM EmailQueue WHERE newsletterId = ? AND status = 'pending') as pending,
             (SELECT COUNT(*) FROM EmailQueue WHERE newsletterId = ?) as total
           FROM dual`,
          [nid, nid]
        );

        if (stats[0].pending === 0) {
          // Toutes les emails ont été traités
          await connection.query(
            `UPDATE Newsletter
             SET status = 'sent',
                 updatedAt = NOW()
             WHERE id = ?`,
            [nid]
          );
        }
      }

      // 8. Récupérer les nouvelles stats de rate limit
      const newRateLimit = await this.checkRateLimit();

      return {
        success: true,
        sent,
        failed,
        skipped,
        message: `Sent ${sent} emails, ${failed} failed`,
        rateLimit: newRateLimit
      };
    } catch (error) {
      console.error('Error processing batch:', error);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Retourne le timestamp du prochain slot horaire
   * @returns {string} ISO timestamp
   */
  static getNextHourSlot() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(next.getHours() + 1);
    next.setMinutes(0, 0, 0);
    return next.toISOString();
  }

  /**
   * Récupère les statistiques d'une newsletter
   * @param {number} newsletterId - ID de la newsletter
   * @returns {Promise<Object>} Statistiques
   */
  static async getNewsletterStats(newsletterId) {
    try {
      const [stats] = await pool.query(
        `SELECT
           n.id,
           n.title,
           n.status,
           n.totalRecipients,
           n.sentCount,
           n.openedCount,
           n.failedCount,
           (SELECT COUNT(*) FROM EmailQueue WHERE newsletterId = n.id AND status = 'pending') as pendingCount,
           (SELECT COUNT(*) FROM EmailQueue WHERE newsletterId = n.id AND status = 'sent') as sentQueueCount,
           (SELECT COUNT(*) FROM EmailQueue WHERE newsletterId = n.id AND status = 'failed') as failedQueueCount,
           ROUND((n.openedCount / NULLIF(n.sentCount, 0)) * 100, 2) as openRate
         FROM Newsletter n
         WHERE n.id = ?`,
        [newsletterId]
      );

      if (stats.length === 0) {
        throw new Error(`Newsletter ${newsletterId} not found`);
      }

      return {
        success: true,
        stats: stats[0]
      };
    } catch (error) {
      console.error('Error getting newsletter stats:', error);
      throw error;
    }
  }

  /**
   * Réinitialise la queue d'une newsletter (remet tous les failed en pending)
   * @param {number} newsletterId - ID de la newsletter
   * @returns {Promise<Object>} Résultat
   */
  static async retryFailed(newsletterId) {
    try {
      const [result] = await pool.query(
        `UPDATE EmailQueue
         SET status = 'pending',
             errorMessage = NULL,
             updatedAt = NOW()
         WHERE newsletterId = ?
           AND status = 'failed'`,
        [newsletterId]
      );

      return {
        success: true,
        retriedCount: result.affectedRows,
        message: `${result.affectedRows} failed emails reset to pending`
      };
    } catch (error) {
      console.error('Error retrying failed:', error);
      throw error;
    }
  }

  /**
   * Annule une newsletter et sa queue
   * @param {number} newsletterId - ID de la newsletter
   * @returns {Promise<Object>} Résultat
   */
  static async cancelNewsletter(newsletterId) {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // Marquer tous les pending comme skipped
      await connection.query(
        `UPDATE EmailQueue
         SET status = 'skipped',
             updatedAt = NOW()
         WHERE newsletterId = ?
           AND status = 'pending'`,
        [newsletterId]
      );

      // Marquer la newsletter comme cancelled
      await connection.query(
        `UPDATE Newsletter
         SET status = 'cancelled',
             updatedAt = NOW()
         WHERE id = ?`,
        [newsletterId]
      );

      await connection.commit();

      return {
        success: true,
        message: `Newsletter ${newsletterId} cancelled`
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error cancelling newsletter:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = EmailQueueService;
