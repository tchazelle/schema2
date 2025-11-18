# Fonctionnalité de Notification par Email

> **Date de création**: 2025-11-18
> **Version**: 1.0.0

## Vue d'ensemble

La fonctionnalité de notification permet d'envoyer un email avec le contenu d'une fiche et un lien pour y revenir à toutes les personnes qui ont accès à cette fiche.

## Fonctionnalités

- ✅ Bouton "Notifier" dans l'interface de détail d'une fiche
- ✅ Prévisualisation des destinataires avant envoi
- ✅ Option d'inclure ou non l'expéditeur dans les destinataires
- ✅ Message personnalisé optionnel
- ✅ Email formaté avec le contenu de la fiche et un lien direct
- ✅ Respect des permissions d'accès (row-level et table-level)

## Architecture

### Backend

#### 1. NotificationService (`services/notificationService.js`)

Service principal gérant toute la logique de notification :

**Méthodes principales :**

- `getRecipients(tableName, recordId, sender, options)` : Détermine qui peut accéder à une fiche selon son `granted`
- `formatRecordEmail(tableName, record, sender, customMessage)` : Génère le HTML de l'email
- `sendEmail(to, subject, html)` : Envoie un email via nodemailer
- `notifyRecord(tableName, recordId, sender, options)` : Méthode principale pour envoyer les notifications
- `getRecipientsPreview(tableName, recordId, sender, options)` : Prévisualisation des destinataires

**Logique de détermination des destinataires :**

```javascript
Selon la valeur du champ `granted` :

1. "draft" → Uniquement le propriétaire (ownerId)

2. "shared" → Tous les utilisateurs avec permission de lecture sur la table
   - Basé sur les rôles et l'héritage
   - Utilise PermissionService.getUserAllRoles()

3. "published @role" → Tous les utilisateurs avec ce rôle ou descendants
   - Par exemple : "published @member" → member, premium, promo, road, admin, dir, dev

4. NULL ou "" → Tous les utilisateurs (public)
```

#### 2. API Endpoints (`routes/api.js`)

**GET `/_api/:table/:id/notify/preview`**
- Prévisualise les destinataires qui recevront la notification
- Query params : `includeSender` (true/false)
- Retourne : `{ success: true, recipients: [...], count: N }`

**POST `/_api/:table/:id/notify`**
- Envoie les notifications
- Body : `{ includeSender: boolean, customMessage: string }`
- Retourne : `{ success: true, sent: N, total: M, recipients: [...] }`

### Frontend

#### 1. Bouton Notify (`public/js/components/details/RowDetailModal.js`)

Ajouté dans l'en-tête de la modale de détail, à côté du bouton de duplication :

```javascript
// Ligne 307-323
!editMode && permissions && permissions.canRead && e('button', {
  className: 'btn-notify',
  onClick: this.handleNotifyClick,
  title: 'Envoyer une notification par email',
  disabled: this.state.notifying,
  // ...
}, this.state.notifying ? '⏳ Envoi...' : '📧 Notifier')
```

#### 2. NotifyModal (`public/js/components/dialogs/NotifyModal.js`)

Composant modal pour configurer et envoyer la notification :

**Fonctionnalités :**
- Chargement automatique de la liste des destinataires
- Checkbox pour inclure l'expéditeur
- Zone de texte pour message personnalisé
- Affichage du nombre de destinataires
- Bouton d'envoi avec validation

**États :**
- `loading` : Chargement des destinataires
- `recipients` : Liste des destinataires
- `includeSender` : Inclure l'expéditeur
- `customMessage` : Message personnalisé
- `error` : Erreur éventuelle

## Configuration Email

### Variables d'environnement (.env)

Ajouter ces variables dans votre fichier `.env` :

```env
# Email Configuration
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-password-or-app-password
EMAIL_FROM=notifications@example.com
BASE_URL=http://localhost:3000
```

### Exemples de configuration

#### Gmail

```env
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

**Note :** Pour Gmail, vous devez générer un "App Password" :
1. Allez sur https://myaccount.google.com/apppasswords
2. Créez un nouveau mot de passe d'application
3. Utilisez-le comme `EMAIL_PASS`

#### Outlook/Hotmail

```env
EMAIL_HOST=smtp-mail.outlook.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@outlook.com
EMAIL_PASS=your-password
```

#### SMTP personnalisé

```env
EMAIL_HOST=smtp.yourdomain.com
EMAIL_PORT=587  # ou 465 pour SSL
EMAIL_SECURE=true  # true pour port 465
EMAIL_USER=your-email@yourdomain.com
EMAIL_PASS=your-password
```

## Utilisation

### 1. Depuis l'interface utilisateur

1. Ouvrir une fiche en cliquant dessus dans la liste CRUD
2. Dans la modale de détail, cliquer sur le bouton **"📧 Notifier"**
3. La modale de notification s'ouvre avec :
   - La liste des destinataires (calculée automatiquement)
   - Une option pour vous inclure dans les destinataires
   - Un champ pour ajouter un message personnalisé
4. Cliquer sur **"📧 Envoyer (N)"** pour envoyer les notifications

### 2. Depuis l'API

**Prévisualiser les destinataires :**

```bash
GET /_api/Person/123/notify/preview?includeSender=true
```

**Envoyer les notifications :**

```bash
POST /_api/Person/123/notify
Content-Type: application/json

{
  "includeSender": false,
  "customMessage": "Merci de vérifier ces informations"
}
```

## Format de l'email

L'email envoyé contient :

1. **En-tête** : Nom de l'expéditeur
2. **Message personnalisé** (si fourni)
3. **Contenu de la fiche** :
   - Titre (basé sur displayFields)
   - Table et ID
   - Tous les champs non-système
4. **Bouton d'action** : Lien vers la fiche
5. **Footer** : Nom de l'application et URL de base

**Exemple d'email :**

```
┌─────────────────────────────────────┐
│ 📧 Notification                     │
│ Jean Dupont vous partage cette fiche│
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Message :                           │
│ Merci de vérifier ces informations  │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Marie Martin                        │
│ Person #123                         │
│                                     │
│ givenName    │ Marie                │
│ familyName   │ Martin               │
│ email        │ marie@example.com    │
│ telephone    │ 06 12 34 56 78       │
└─────────────────────────────────────┘

        [🔗 Voir la fiche]

─────────────────────────────────────
Cet email a été envoyé depuis Crudable Site
http://localhost:3000
```

## Permissions

### Qui peut envoyer des notifications ?

Tout utilisateur ayant accès en lecture à une fiche peut envoyer une notification sur celle-ci.

### Qui reçoit les notifications ?

Les destinataires sont déterminés automatiquement selon le champ `granted` de la fiche :

| Granted | Destinataires |
|---------|---------------|
| `draft` | Uniquement le propriétaire (ownerId) |
| `shared` | Tous les utilisateurs avec permission de lecture sur la table |
| `published @role` | Tous les utilisateurs avec ce rôle ou descendants |
| `NULL` ou `""` | Tous les utilisateurs |

**Filtres appliqués :**
- Seuls les utilisateurs avec un email valide reçoivent les notifications
- L'expéditeur peut choisir de s'inclure ou non dans les destinataires

## Gestion des erreurs

### Email non configuré

Si les variables d'environnement email ne sont pas configurées :

```json
{
  "success": false,
  "error": "Email non configuré. Veuillez contacter l'administrateur."
}
```

### Aucun destinataire

Si aucun utilisateur n'a accès à la fiche :

```json
{
  "success": true,
  "message": "Aucun destinataire trouvé",
  "sent": 0,
  "recipients": []
}
```

### Erreur d'envoi partielle

Si certains emails échouent :

```json
{
  "success": false,
  "message": "2/5 email(s) envoyé(s), 3 erreur(s)",
  "sent": 2,
  "total": 5,
  "recipients": [
    { "email": "user1@example.com", "name": "User 1", "success": true },
    { "email": "user2@example.com", "name": "User 2", "success": false, "error": "..." },
    ...
  ]
}
```

## Sécurité

### Validations

1. **Authentification** : L'utilisateur doit être connecté
2. **Permission de lecture** : Vérifiée au niveau table
3. **Accès à la fiche** : Vérifié via le système `granted`
4. **Email valide** : Seuls les utilisateurs avec email reçoivent les notifications

### Protection contre l'abus

**Recommandations pour la production :**

1. **Rate limiting** : Limiter le nombre de notifications par utilisateur/heure
2. **Queue système** : Utiliser une queue (ex: Bull, Bee-Queue) pour les envois massifs
3. **Logs** : Enregistrer toutes les notifications envoyées
4. **Quota** : Limiter le nombre de destinataires par notification

## Développement

### Tester localement

Pour tester sans configurer d'email réel, vous pouvez utiliser :

**1. Mailtrap (https://mailtrap.io)**

```env
EMAIL_HOST=smtp.mailtrap.io
EMAIL_PORT=2525
EMAIL_USER=your-mailtrap-username
EMAIL_PASS=your-mailtrap-password
```

**2. Ethereal Email (https://ethereal.email)**

```javascript
// Génère des credentials temporaires
const testAccount = await nodemailer.createTestAccount();
```

### Fichiers modifiés

```
services/notificationService.js          [NOUVEAU] Service de notification
routes/api.js                            [MODIFIÉ] +2 endpoints
public/js/components/details/RowDetailModal.js  [MODIFIÉ] +bouton Notify
public/js/components/dialogs/NotifyModal.js     [NOUVEAU] Modal de notification
services/templateService.js              [MODIFIÉ] +script NotifyModal
.env.example                             [NOUVEAU] Variables d'environnement
package.json                             [MODIFIÉ] +nodemailer
```

## Limitations connues

1. **Envoi synchrone** : Les emails sont envoyés de manière synchrone
   - Pour un grand nombre de destinataires, envisager une queue
2. **Pas de template personnalisable** : Le format d'email est fixe
   - Peut être étendu pour supporter des templates Mustache
3. **Pas de tracking** : Aucun tracking d'ouverture ou de clic
4. **Pas d'historique** : Les notifications envoyées ne sont pas enregistrées

## Améliorations futures

- [ ] Queue d'envoi pour traitement asynchrone
- [ ] Templates d'email personnalisables (Mustache)
- [ ] Historique des notifications envoyées (table Notification)
- [ ] Préférences utilisateur (opt-in/opt-out)
- [ ] Notifications groupées (digest)
- [ ] Support des pièces jointes
- [ ] Tracking d'ouverture/clic
- [ ] Envoi en BCC pour grands groupes
- [ ] Rate limiting automatique
- [ ] Retry automatique en cas d'échec

## Support

Pour toute question ou problème :

1. Vérifier la configuration email dans `.env`
2. Consulter les logs serveur pour les erreurs
3. Tester avec un service comme Mailtrap
4. Vérifier les permissions d'accès à la fiche

## Références

- [Nodemailer Documentation](https://nodemailer.com/)
- [Schema2 CLAUDE.md](../CLAUDE.md)
- [Schema2 Permissions](../constants/permissions.js)
- [Schema2 Services API](./SERVICES_API.md)
