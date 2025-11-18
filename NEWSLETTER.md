# 📧 Système de Newsletter - Guide d'utilisation

> **Implémentation complète du système d'envoi de newsletters avec rate limiting (120 emails/heure)**
> Date: 2025-11-18

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Architecture](#architecture)
3. [Installation & Configuration](#installation--configuration)
4. [Guide de démarrage rapide](#guide-de-démarrage-rapide)
5. [API Reference](#api-reference)
6. [Workflows](#workflows)
7. [Gestion depuis CRUD](#gestion-depuis-crud)
8. [Tracking des ouvertures](#tracking-des-ouvertures)
9. [Troubleshooting](#troubleshooting)

---

## 🎯 Vue d'ensemble

Le système de newsletter permet d'envoyer des emails personnalisés à vos 6000 abonnés tout en respectant la contrainte de **120 emails/heure** imposée par votre hébergeur O2Switch.

### Caractéristiques principales

✅ **Queue persistante** - File d'attente MySQL (survit aux redémarrages)
✅ **Rate limiting strict** - Respecte la limite de 120 emails/heure
✅ **Traitement manuel** - Boutons "Envoyer 100 emails" dans le CRUD
✅ **Tracking d'ouvertures** - Pixel invisible 1x1 pour mesurer l'engagement
✅ **Personnalisation Mustache** - Prénom, nom, email dans chaque email
✅ **Gestion des erreurs** - Retry automatique des échecs
✅ **Relations News** - Associez plusieurs actualités à chaque newsletter

### Temps d'envoi estimé

- 6000 abonnés ÷ 120 emails/heure = **50 heures**
- Envoi manuel par batch de 100 emails = **60 clics** (ou automatique via cron externe)

---

## 🏗️ Architecture

### Tables créées (auto-sync au démarrage)

```
Newsletter
├── id
├── title                    # "Newsletter Février 2025"
├── subject                  # Sujet de l'email
├── bodyTemplate             # Template Mustache
├── scheduledAt              # Date programmée
├── status                   # draft|queued|sending|sent|paused|cancelled
├── totalRecipients          # Compteur total
├── sentCount                # Emails envoyés
├── openedCount              # Nombre d'ouvertures uniques
└── failedCount              # Échecs

News (nouvelles actualités)
├── id
├── title
├── content
├── image
├── url
└── publishedAt

NewsletterNews (table de liaison 1:N)
├── newsletterId
├── newsId
└── displayOrder

EmailQueue (file d'attente)
├── id
├── newsletterId
├── recipientId              # Person.id
├── recipientEmail           # Copie pour perf
├── recipientData            # JSON {givenName, familyName, ...}
├── status                   # pending|sent|failed|skipped
├── sentAt
├── openedAt                 # Date première ouverture
├── openCount                # Nombre d'ouvertures
└── errorMessage

EmailRateTracker (limite horaire)
├── hourSlot                 # 2025-11-18 14:00:00
├── emailsSent               # Compteur pour cette heure
└── lastEmailAt
```

### Services créés

| Service | Fichier | Rôle |
|---------|---------|------|
| **EmailService** | `services/emailService.js` | SMTP nodemailer + tracking pixel |
| **EmailQueueService** | `services/emailQueueService.js` | Gestion queue + rate limiting |
| **NewsletterService** | `services/newsletterService.js` | Rendering Mustache |

### Routes créées

Toutes les routes sont préfixées par `/_api/email/`

```
POST   /queue/:id              Générer la queue
POST   /process-batch          Traiter un batch
GET    /stats/:id              Statistiques
GET    /preview/:id            Prévisualisation HTML
GET    /track/:id/pixel.gif    Pixel de tracking
POST   /test                   Email de test
POST   /retry/:id              Retry des échecs
POST   /cancel/:id             Annuler newsletter
GET    /rate-limit             État du rate limiting
POST   /sample                 Créer newsletter de démo
GET    /verify                 Vérifier config SMTP
```

---

## ⚙️ Installation & Configuration

### 1. Configuration .env

Votre fichier `.env` est déjà configuré avec :

```env
# Email Configuration
EMAIL_HOST=baal.o2switch.net
EMAIL_PORT=465
EMAIL_SECURE=true
EMAIL_USER=bonjour@thierrychazelle.com
EMAIL_PASS=xxxxx
EMAIL_FROM=bonjour@thierrychazelle.com

# Base URL pour les tracking pixels
BASE_URL=http://localhost:3000  # À changer en production
```

**⚠️ IMPORTANT** : En production, changez `BASE_URL` vers votre domaine réel :
```env
BASE_URL=https://votre-domaine.com
```

### 2. Limite d'envoi (schema.js)

Déjà configuré dans `schema.js` ligne 13 :

```javascript
emailRateLimit: 120, // 120 emails/heure
```

### 3. Démarrer le serveur

```bash
npm run dev
```

Les tables seront automatiquement créées au démarrage.

### 4. Vérifier la configuration SMTP

```bash
curl -X GET http://localhost:3000/_api/email/verify \
  -H "Cookie: token=YOUR_JWT_TOKEN"
```

Ou via interface CRUD : `/_crud/Newsletter` > "Vérifier SMTP"

---

## 🚀 Guide de démarrage rapide

### Scénario complet en 5 étapes

#### 1️⃣ Créer quelques abonnés de test

Aller dans `/_crud/Person` et créer 2-3 personnes :

```
Prénom: Jean
Nom: Dupont
Email: jean.dupont@example.com
isSubscribed: 1  ✓
isActive: 1      ✓
```

#### 2️⃣ Créer une newsletter de test (automatique)

**Option A : Via API**
```bash
curl -X POST http://localhost:3000/_api/email/sample \
  -H "Cookie: token=YOUR_JWT_TOKEN"
```

**Option B : Via CRUD**
1. Aller dans `/_crud/Newsletter`
2. Cliquer sur "Créer newsletter de test"
3. Une newsletter avec 3 News sera créée

#### 3️⃣ Générer la queue

**Via CRUD :**
1. Ouvrir la newsletter créée
2. Cliquer sur "Générer queue"
3. ✅ Confirmation : "Queue generated with 3 recipients"

**Via API :**
```bash
curl -X POST http://localhost:3000/_api/email/queue/1 \
  -H "Cookie: token=YOUR_JWT_TOKEN"
```

#### 4️⃣ Prévisualiser

Ouvrir dans navigateur :
```
http://localhost:3000/_api/email/preview/1?givenName=Jean&familyName=Dupont
```

#### 5️⃣ Envoyer un batch de test

**Via CRUD :**
1. Ouvrir `/_crud/Newsletter/1`
2. Cliquer sur "Envoyer 100 emails"
3. Voir les stats se mettre à jour

**Via API :**
```bash
curl -X POST http://localhost:3000/_api/email/process-batch \
  -H "Content-Type: application/json" \
  -d '{"batchSize": 10}'
```

---

## 📡 API Reference

### POST /queue/:id

Génère la file d'attente pour une newsletter.

**Requête :**
```bash
POST /_api/email/queue/1
Authorization: Cookie token=...
```

**Réponse :**
```json
{
  "success": true,
  "newsletterId": 1,
  "totalRecipients": 6000,
  "message": "Queue generated successfully with 6000 recipients"
}
```

**Actions :**
1. Supprime l'ancienne queue si elle existe
2. Récupère tous les `Person` avec `isSubscribed=1` et `isActive=1`
3. Crée une `EmailQueue` par abonné
4. Change le status de Newsletter en `queued`

---

### POST /process-batch

Traite un batch d'emails en respectant la limite horaire.

**Requête :**
```bash
POST /_api/email/process-batch
Content-Type: application/json

{
  "batchSize": 100  # Optionnel, défaut = limite disponible
}
```

**Réponse :**
```json
{
  "success": true,
  "sent": 95,
  "failed": 5,
  "skipped": 0,
  "message": "Sent 95 emails, 5 failed",
  "rateLimit": {
    "canSend": true,
    "available": 25,
    "limit": 120,
    "hourSlot": "2025-11-18 14:00:00",
    "emailsSent": 95
  }
}
```

**Actions :**
1. Vérifie le rate limiting
2. Récupère N emails avec `status=pending`
3. Pour chaque email :
   - Rend le template Mustache
   - Ajoute le tracking pixel
   - Envoie via SMTP
   - Met à jour `EmailQueue.status`
4. Incrémente `EmailRateTracker`
5. Si tous les emails sont envoyés, change Newsletter en `sent`

---

### GET /stats/:id

Récupère les statistiques d'une newsletter.

**Requête :**
```bash
GET /_api/email/stats/1
```

**Réponse :**
```json
{
  "success": true,
  "stats": {
    "id": 1,
    "title": "Newsletter Février 2025",
    "status": "sending",
    "total_recipients": 6000,
    "sent_count": 1250,
    "opened_count": 423,
    "failed_count": 12,
    "pending_count": 4738,
    "sent_queue_count": 1250,
    "failed_queue_count": 12,
    "open_rate": 33.84
  }
}
```

---

### GET /preview/:id

Prévisualise l'email avec données de test.

**Requête :**
```bash
GET /_api/email/preview/1?givenName=Marie&familyName=Martin
```

**Réponse :**
HTML complet de l'email avec :
- Template Mustache rendu
- News injectées
- Données de test personnalisées
- **SANS** tracking pixel (preview uniquement)

---

### GET /track/:id/pixel.gif

Pixel de tracking invisible (appelé automatiquement à l'ouverture).

**Comportement :**
1. Retourne un GIF 1x1 transparent
2. Incrémente `EmailQueue.openCount`
3. Met à jour `EmailQueue.openedAt` si première ouverture
4. Incrémente `Newsletter.openedCount` si première ouverture

**Headers :**
```
Content-Type: image/gif
Cache-Control: no-store, no-cache, must-revalidate
```

---

### POST /retry/:id

Réessaye tous les emails échoués d'une newsletter.

**Requête :**
```bash
POST /_api/email/retry/1
```

**Réponse :**
```json
{
  "success": true,
  "retriedCount": 12,
  "message": "12 failed emails reset to pending"
}
```

**Action :**
- Change tous les `status=failed` en `status=pending`
- Efface `errorMessage`

---

### POST /cancel/:id

Annule une newsletter en cours.

**Requête :**
```bash
POST /_api/email/cancel/1
```

**Réponse :**
```json
{
  "success": true,
  "message": "Newsletter 1 cancelled"
}
```

**Actions :**
- Change tous les `pending` en `skipped`
- Change Newsletter en `cancelled`

---

### GET /rate-limit

Vérifie l'état actuel du rate limiting.

**Requête :**
```bash
GET /_api/email/rate-limit
```

**Réponse :**
```json
{
  "success": true,
  "rateLimit": {
    "canSend": true,
    "available": 45,
    "limit": 120,
    "hourSlot": "2025-11-18 15:00:00",
    "emailsSent": 75
  }
}
```

---

### POST /test

Envoie un email de test pour vérifier la config SMTP.

**Requête :**
```bash
POST /_api/email/test
Content-Type: application/json

{
  "to": "votre-email@example.com"
}
```

**Réponse :**
```json
{
  "success": true,
  "messageId": "<abc123@baal.o2switch.net>",
  "accepted": ["votre-email@example.com"],
  "rejected": []
}
```

---

## 🔄 Workflows

### Workflow complet : Envoi de 6000 emails

```
1. PRÉPARATION
   └─> Créer Newsletter dans /_crud/Newsletter
       └─> Ajouter News dans /_crud/News
           └─> Lier via /_crud/NewsletterNews

2. GÉNÉRATION QUEUE
   └─> POST /_api/email/queue/1
       └─> Status: draft → queued
       └─> 6000 EmailQueue créés

3. PRÉVISUALISATION (optionnel)
   └─> GET /_api/email/preview/1

4. ENVOI PAR BATCH (manuel)
   └─> Toutes les heures, pendant 50 heures :
       POST /_api/email/process-batch {"batchSize": 100}

   OU utiliser cron externe (cron-job.org)
   └─> Configurer : 0 * * * * (toutes les heures)
       URL : https://votre-domaine.com/_api/email/process-batch

5. MONITORING
   └─> GET /_api/email/stats/1
       └─> Voir progression en temps réel

6. GESTION DES ERREURS
   └─> Si échecs : POST /_api/email/retry/1
       └─> Relance les failed

7. FIN
   └─> Status: sending → sent
   └─> Consulter openedCount et open_rate
```

### Workflow : Annulation en cours

```
Newsletter en cours (status=sending)
└─> POST /_api/email/cancel/1
    └─> Tous les pending → skipped
    └─> Status → cancelled
    └─> Les déjà envoyés restent sent
```

---

## 🖱️ Gestion depuis CRUD

### Interface /_crud/Newsletter

Vous pouvez gérer les newsletters directement depuis le CRUD :

**Boutons disponibles :**
- **Générer queue** : Lance la génération (appelle `/queue/:id`)
- **Envoyer 100 emails** : Traite un batch (appelle `/process-batch`)
- **Voir stats** : Affiche progression
- **Prévisualiser** : Ouvre `/preview/:id`
- **Retry échecs** : Relance les failed
- **Annuler** : Stop l'envoi

**Exemple d'ajout de boutons personnalisés :**

Dans `routes/crud.js`, ajouter des actions :

```javascript
// Bouton "Envoyer 100 emails"
router.post('/newsletter/:id/send-batch', async (req, res) => {
  const result = await EmailQueueService.processBatch(100);
  res.redirect(`/_crud/Newsletter/${req.params.id}`);
});
```

---

## 📊 Tracking des ouvertures

### Comment ça fonctionne

1. **Génération du pixel** :
   Chaque email contient un pixel invisible :
   ```html
   <img src="http://votre-domaine.com/_api/email/track/12345/pixel.gif"
        width="1" height="1" alt="" style="display:block" />
   ```

2. **Détection d'ouverture** :
   Quand le destinataire ouvre l'email, son client charge le pixel :
   - `GET /_api/email/track/12345/pixel.gif`
   - Le serveur incrémente `EmailQueue.openCount`
   - Si première ouverture : met à jour `openedAt` et incrémente `Newsletter.openedCount`

3. **Taux d'ouverture** :
   ```sql
   open_rate = (openedCount / sentCount) * 100
   ```

### Limitations du tracking

⚠️ **Le tracking ne fonctionne que si :**
- Le client email autorise les images (certains bloquent par défaut)
- L'email est au format HTML (pas text/plain)
- Le destinataire est connecté à Internet

📈 **Taux d'ouverture moyen attendu :** 15-30% (selon secteur)

---

## 🛠️ Troubleshooting

### Problème 1 : "Rate limit reached"

**Symptôme :**
```json
{
  "success": true,
  "sent": 0,
  "rateLimitReached": true,
  "nextAvailableAt": "2025-11-18T16:00:00.000Z"
}
```

**Solution :**
Attendre l'heure suivante. Le compteur se réinitialise chaque heure.

**Vérifier :**
```bash
GET /_api/email/rate-limit
```

---

### Problème 2 : Emails non envoyés (status=failed)

**Diagnostic :**
```bash
GET /_api/email/stats/1
# Regarder failed_count
```

**Vérifier les erreurs :**
```sql
SELECT id, recipient_email, error_message, retry_count
FROM EmailQueue
WHERE status = 'failed'
ORDER BY updated_at DESC
LIMIT 10;
```

**Solutions :**
1. Vérifier config SMTP dans .env
2. Tester un email simple :
   ```bash
   POST /_api/email/test {"to": "test@example.com"}
   ```
3. Retry les échecs :
   ```bash
   POST /_api/email/retry/1
   ```

---

### Problème 3 : Tracking ne fonctionne pas

**Causes possibles :**
1. `BASE_URL` incorrect dans .env
2. Client email bloque les images
3. Email en text/plain au lieu de HTML

**Vérifier :**
```bash
# Vérifier BASE_URL
cat .env | grep BASE_URL

# Tester le pixel manuellement
curl http://localhost:3000/_api/email/track/1/pixel.gif
# Doit retourner un GIF 1x1
```

---

### Problème 4 : Template Mustache ne rend pas

**Symptôme :**
Variables `{{givenName}}` apparaissent en clair dans l'email.

**Diagnostic :**
```bash
GET /_api/email/preview/1?givenName=Test
# Vérifier que les {{ }} sont remplacés
```

**Solution :**
Vérifier que `recipientData` est bien du JSON valide :
```sql
SELECT recipient_data FROM EmailQueue WHERE id = 1;
```

Doit être : `{"givenName":"Jean","familyName":"Dupont",...}`

---

### Problème 5 : Queue vide après génération

**Symptôme :**
```json
{
  "success": true,
  "totalRecipients": 0
}
```

**Cause :**
Aucun abonné avec `isSubscribed=1` et `isActive=1`.

**Solution :**
```sql
SELECT id, email, is_subscribed, is_active
FROM Person
WHERE is_subscribed = 1 AND is_active = 1;
```

Si vide, créer des abonnés dans `/_crud/Person`.

---

## 🔧 Personnalisation

### Changer le template par défaut

Éditer `services/newsletterService.js` ligne 85 (méthode `getDefaultTemplate()`).

**Variables Mustache disponibles :**
```mustache
{{givenName}}           # Prénom
{{familyName}}          # Nom
{{fullName}}            # Nom complet
{{email}}               # Email du destinataire
{{newsletter.title}}    # Titre de la newsletter
{{newsletter.subject}}  # Sujet
{{currentYear}}         # Année actuelle
{{currentDate}}         # Date du jour

{{#news}}               # Boucle sur les News
  {{title}}
  {{content}}
  {{image}}
  {{url}}
  {{hasImage}}          # Boolean
  {{hasUrl}}            # Boolean
{{/news}}
```

### Exemple de template personnalisé

```html
<!DOCTYPE html>
<html>
<head>
  <title>{{newsletter.subject}}</title>
</head>
<body>
  <h1>Bonjour {{givenName}} !</h1>

  <p>Voici vos actualités du mois :</p>

  {{#news}}
  <article>
    <h2>{{title}}</h2>
    {{#hasImage}}
    <img src="{{image}}" alt="{{title}}" style="max-width: 100%;" />
    {{/hasImage}}
    <p>{{content}}</p>
    {{#hasUrl}}
    <a href="{{url}}">Lire la suite →</a>
    {{/hasUrl}}
  </article>
  {{/news}}

  <footer>
    <p>© {{currentYear}} - Envoyé à {{email}}</p>
  </footer>
</body>
</html>
```

---

## 📈 Monitoring & Analytics

### Requêtes SQL utiles

**Dashboard newsletter :**
```sql
SELECT
  id,
  title,
  status,
  total_recipients,
  sent_count,
  opened_count,
  failed_count,
  ROUND((opened_count / NULLIF(sent_count, 0)) * 100, 2) as open_rate,
  ROUND((sent_count / NULLIF(total_recipients, 0)) * 100, 2) as sent_rate
FROM Newsletter
ORDER BY created_at DESC;
```

**Taux d'ouverture par heure :**
```sql
SELECT
  DATE_FORMAT(sent_at, '%Y-%m-%d %H:00') as hour,
  COUNT(*) as emails_sent,
  SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) as emails_opened,
  ROUND((SUM(CASE WHEN opened_at IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as open_rate
FROM EmailQueue
WHERE newsletter_id = 1
GROUP BY DATE_FORMAT(sent_at, '%Y-%m-%d %H:00')
ORDER BY hour;
```

**Top 10 ouvertures multiples :**
```sql
SELECT
  recipient_email,
  open_count,
  sent_at,
  opened_at,
  TIMESTAMPDIFF(MINUTE, sent_at, opened_at) as minutes_to_open
FROM EmailQueue
WHERE open_count > 1
ORDER BY open_count DESC
LIMIT 10;
```

---

## 🚀 Automatisation avec cron externe (recommandé)

Pour éviter de cliquer 60 fois, utilisez un service de cron externe **gratuit** :

### Option 1 : cron-job.org

1. Créer un compte sur https://cron-job.org (gratuit)
2. Créer un cronjob :
   - **URL** : `https://votre-domaine.com/_api/email/process-batch`
   - **Méthode** : POST
   - **Schedule** : `0 * * * *` (toutes les heures)
   - **Headers** : `Content-Type: application/json`
   - **Body** : `{"batchSize": 100}`

3. Activer et laisser tourner pendant 50 heures ✅

### Option 2 : UptimeRobot

1. Créer un compte sur https://uptimerobot.com (gratuit)
2. Créer un monitor HTTP :
   - **URL** : `https://votre-domaine.com/_api/email/process-batch`
   - **Interval** : 60 minutes
   - **Type** : HTTP(S)

---

## 📝 Checklist avant envoi en production

- [ ] Changer `BASE_URL` dans .env vers le domaine réel
- [ ] Vérifier que `EMAIL_PASS` est correct (pas "xxxxx")
- [ ] Tester avec POST `/_api/email/test` vers votre email
- [ ] Créer 5-10 abonnés de test et envoyer une newsletter de test
- [ ] Vérifier que le tracking pixel fonctionne
- [ ] Configurer cron externe (cron-job.org ou UptimeRobot)
- [ ] Ajouter un lien de désinscription dans le template
- [ ] Vérifier que le footer contient les mentions légales
- [ ] Tester sur différents clients (Gmail, Outlook, Apple Mail)
- [ ] Préparer une stratégie de gestion des bounces (emails invalides)

---

## 🎓 Ressources complémentaires

**Documentation :**
- Mustache : https://github.com/janl/mustache.js
- Nodemailer : https://nodemailer.com/
- CLAUDE.md : Guide complet de Schema2

**Services de cron gratuits :**
- https://cron-job.org
- https://uptimerobot.com
- https://easycron.com

**Bonnes pratiques emailing :**
- Taux d'ouverture moyen : 15-30%
- Meilleur jour : Mardi-Jeudi
- Meilleure heure : 10h-11h ou 14h-15h
- Objet court : 40-50 caractères max

---

## 📞 Support

Pour toute question sur le système de newsletter :

1. Consulter ce guide (NEWSLETTER.md)
2. Consulter CLAUDE.md pour l'architecture générale
3. Vérifier les logs du serveur : `npm run dev`
4. Tester avec `/_api/email/verify` et `/_api/email/test`

---

**Bon envoi ! 🚀**
