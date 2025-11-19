const pool = require('../config/database');
const mustache = require('mustache');

/**
 * Service de gestion des newsletters
 *
 * Fonctionnalités :
 * - Récupération des newsletters avec leurs News associées
 * - Rendering Mustache avec personnalisation
 * - Génération de templates par défaut
 */
class NewsletterService {
  /**
   * Récupère une newsletter avec ses News associées
   * @param {number} newsletterId - ID de la newsletter
   * @returns {Promise<Object>} Newsletter avec news
   */
  static async getNewsletterWithNews(newsletterId) {
    try {
      // 1. Récupérer la newsletter
      const [newsletters] = await pool.query(
        'SELECT * FROM Newsletter WHERE id = ?',
        [newsletterId]
      );

      if (newsletters.length === 0) {
        throw new Error(`Newsletter ${newsletterId} not found`);
      }

      const newsletter = newsletters[0];

      // 2. Récupérer les News associées via NewsletterNews
      const [newsItems] = await pool.query(
        `SELECT n.*, nn.displayOrder
         FROM NewsletterNews nn
         INNER JOIN News n ON nn.newsId = n.id
         WHERE nn.newsletterId = ?
         ORDER BY nn.displayOrder ASC`,
        [newsletterId]
      );

      newsletter.news = newsItems;

      return {
        success: true,
        newsletter
      };
    } catch (error) {
      console.error('Error getting newsletter with news:', error);
      throw error;
    }
  }

  /**
   * Rend le template d'email avec Mustache
   * @param {number} newsletterId - ID de la newsletter
   * @param {Object} recipientData - Données du destinataire {givenName, familyName, email, ...}
   * @returns {Promise<string>} HTML rendu
   */
  static async renderEmailTemplate(newsletterId, recipientData) {
    try {
      // 1. Récupérer la newsletter avec ses news
      const { newsletter } = await this.getNewsletterWithNews(newsletterId);

      // 2. Préparer les données pour Mustache
      const templateData = {
        // Données du destinataire
        recipient: recipientData,
        givenName: recipientData.givenName || '',
        familyName: recipientData.familyName || '',
        fullName: recipientData.fullName || `${recipientData.givenName || ''} ${recipientData.familyName || ''}`.trim(),
        email: recipientData.email || '',

        // Données de la newsletter
        newsletter: {
          title: newsletter.title,
          subject: newsletter.subject
        },

        // News
        news: newsletter.news.map(item => ({
          id: item.id,
          title: item.title,
          content: item.content,
          image: item.image,
          url: item.url,
          publishedAt: item.publishedAt,
          hasImage: !!item.image,
          hasUrl: !!item.url
        })),

        // Helpers
        currentYear: new Date().getFullYear(),
        currentDate: new Date().toLocaleDateString('fr-FR')
      };

      // 3. Si pas de template, utiliser le template par défaut
      let template = newsletter.bodyTemplate;
      if (!template || template.trim() === '') {
        template = this.getDefaultTemplate();
      }

      // 4. Rendre avec Mustache
      const html = mustache.render(template, templateData);

      return html;
    } catch (error) {
      console.error('Error rendering email template:', error);
      throw error;
    }
  }

  /**
   * Prévisualise un email (avec données de test)
   * @param {number} newsletterId - ID de la newsletter
   * @param {Object} testRecipient - Données de test (optionnel)
   * @returns {Promise<string>} HTML rendu
   */
  static async previewEmail(newsletterId, testRecipient = null) {
    const defaultRecipient = {
      givenName: 'Prénom',
      familyName: 'Nom',
      fullName: 'Prénom Nom',
      email: 'test@example.com'
    };

    return await this.renderEmailTemplate(
      newsletterId,
      testRecipient || defaultRecipient
    );
  }

  /**
   * Retourne le template HTML par défaut pour les newsletters
   * @returns {string} Template Mustache
   */
  static getDefaultTemplate() {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{newsletter.subject}}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f4f4f4;">
  <!-- Main Container Table -->
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f4f4;">
    <tr>
      <td style="padding: 20px 0;">
        <!-- Content Table (max-width 600px) -->
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" align="center" style="background-color: #ffffff; max-width: 600px; margin: 0 auto;">

          <!-- Header -->
          <tr>
            <td style="background-color: #667eea; color: #ffffff; padding: 30px 20px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px; font-weight: bold; color: #ffffff;">{{newsletter.title}}</h1>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding: 20px; font-size: 16px; color: #555555; line-height: 1.6;">
              Bonjour <strong style="color: #333333;">{{givenName}}</strong>,
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 0 20px 20px 20px;">
              <!-- News Items -->
              {{#news}}
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 30px; border-bottom: 1px solid #eeeeee; padding-bottom: 20px;">
                <tr>
                  <td>
                    <!-- News Title -->
                    <h2 style="color: #667eea; font-size: 22px; margin: 0 0 10px 0; font-weight: bold;">{{title}}</h2>

                    <!-- News Image (if exists) -->
                    {{#hasImage}}
                    <img src="{{image}}" alt="{{title}}" style="max-width: 100%; height: auto; display: block; margin-bottom: 15px;" />
                    {{/hasImage}}

                    <!-- News Content -->
                    <p style="margin: 10px 0; color: #555555; line-height: 1.8; font-size: 16px;">{{content}}</p>

                    <!-- News Link (if exists) -->
                    {{#hasUrl}}
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin-top: 10px;">
                      <tr>
                        <td style="background-color: #667eea; padding: 10px 20px;">
                          <a href="{{url}}" target="_blank" style="color: #ffffff; text-decoration: none; font-weight: bold; display: inline-block;">En savoir plus →</a>
                        </td>
                      </tr>
                    </table>
                    {{/hasUrl}}
                  </td>
                </tr>
              </table>
              {{/news}}

              <!-- No News Message -->
              {{^news}}
              <p style="color: #999999; text-align: center; padding: 40px 20px; font-size: 16px;">
                Aucune actualité pour le moment.
              </p>
              {{/news}}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 5px 0; font-size: 12px; color: #777777;">&copy; {{currentYear}} - Tous droits réservés</p>
              <p style="margin: 5px 0; font-size: 12px; color: #777777;">
                Vous recevez cet email car vous êtes abonné à notre newsletter.<br>
                <a href="#" style="color: #667eea; text-decoration: none;">Se désabonner</a>
              </p>
              <p style="margin: 15px 0 5px 0; font-size: 12px; color: #999999;">
                Envoyé à : {{email}}
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  /**
   * Crée une newsletter de test avec des News de démo
   * @returns {Promise<Object>} Newsletter créée
   */
  static async createSampleNewsletter() {
    const connection = await pool.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Créer la newsletter
      const [nlResult] = await connection.query(
        `INSERT INTO Newsletter (title, subject, bodyTemplate, scheduledAt, status)
         VALUES (?, ?, ?, NOW(), 'draft')`,
        [
          'Newsletter de test',
          'Votre newsletter mensuelle - ' + new Date().toLocaleDateString('fr-FR'),
          this.getDefaultTemplate()
        ]
      );

      const newsletterId = nlResult.insertId;

      // 2. Créer quelques News de démonstration
      const newsData = [
        {
          title: 'Bienvenue dans notre newsletter',
          content: 'Nous sommes ravis de vous compter parmi nos abonnés. Découvrez chaque mois nos dernières actualités, nos nouveautés et nos conseils exclusifs.',
          image: 'https://via.placeholder.com/600x300/667eea/ffffff?text=Newsletter',
          url: 'https://example.com/article1'
        },
        {
          title: 'Nouveauté du mois',
          content: 'Ce mois-ci, nous avons le plaisir de vous annoncer le lancement de notre nouveau service. Une solution innovante qui va révolutionner votre quotidien.',
          image: null,
          url: 'https://example.com/article2'
        },
        {
          title: 'Conseil de la semaine',
          content: 'Saviez-vous que vous pouvez personnaliser entièrement vos newsletters avec des templates Mustache ? C\'est simple, rapide et très efficace !',
          image: null,
          url: null
        }
      ];

      for (let i = 0; i < newsData.length; i++) {
        const news = newsData[i];

        // Créer la News
        const [newsResult] = await connection.query(
          `INSERT INTO News (title, content, image, url, publishedAt, granted)
           VALUES (?, ?, ?, ?, NOW(), 'published @public')`,
          [news.title, news.content, news.image, news.url]
        );

        const newsId = newsResult.insertId;

        // Lier à la newsletter
        await connection.query(
          `INSERT INTO NewsletterNews (newsletterId, newsId, displayOrder)
           VALUES (?, ?, ?)`,
          [newsletterId, newsId, i]
        );
      }

      await connection.commit();

      return {
        success: true,
        newsletterId,
        message: 'Sample newsletter created successfully'
      };
    } catch (error) {
      await connection.rollback();
      console.error('Error creating sample newsletter:', error);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = NewsletterService;
