# Schema2 Backend - Node.js

Backend Node.js avec système d'authentification JWT et gestion des autorisations RBAC basé sur schema.js.

## Fonctionnalités

- ✅ Authentification JWT avec cookies
- ✅ Système RBAC (Role-Based Access Control) avec héritage des rôles
- ✅ Pool de connexions MySQL2
- ✅ Interface web minimaliste
- ✅ Menu hamburger dynamique (pages et tables selon autorisations)
- ✅ Menu utilisateur avec connexion/déconnexion
- ✅ Routes de debug pour visualiser les autorisations

## Structure du projet

```
schema2/
├── config/
│   └── database.js          # Configuration du pool MySQL2
├── routes/
│   ├── index.js             # Route principale (/)
│   ├── auth.js              # Routes d'authentification
│   └── debug.js             # Routes de debug
├── utils/
│   ├── auth.js              # Utilitaires JWT et cookies
│   └── permissions.js       # Gestion des permissions RBAC
├── public/                  # Fichiers statiques
├── schema.js                # Schéma de l'application
├── server.js                # Serveur Express principal
├── .env                     # Variables d'environnement
├── .gitignore              # Fichiers ignorés par git
└── package.json            # Dépendances npm

## Installation

1. Installer les dépendances :
```bash
npm install
```

2. Configurer le fichier `.env` (déjà créé) :
```env
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=schema2
DB_PORT=8889
DB_TIMEZONE=+00:00
JWT_SECRET=dev-secret-key-change-in-production
UPLOADS_DIR=./uploads
```

3. Vérifier que la base de données MySQL `schema2` est accessible avec la table `Person` existante.

**Note** : La table `Person` est déjà créée et renseignée. Les mots de passe sont stockés **en clair** pendant la phase de développement (pas de hash). Le système se connecte directement avec email/password sans bcrypt.

## Démarrage

### Mode développement (avec nodemon) :
```bash
npm run dev
```

### Mode production :
```bash
npm start
```

Le serveur démarre sur `http://localhost:3000`

## Routes disponibles

### Routes publiques

- `GET /` - Page d'accueil avec menu et authentification
- `POST /auth/login` - Connexion (JSON: {email, password})
- `POST /auth/logout` - Déconnexion

### Routes protégées

- `GET /auth/me` - Informations de l'utilisateur connecté
- `GET /debug/user` - Fiche détaillée de l'utilisateur
- `GET /debug/user/grant` - Autorisations héritées de l'utilisateur

## Système de rôles

Les rôles sont définis dans `schema.js` avec héritage :

```
dev → dir → admin → promo, road → premium → member → public
```

- **public** : Accès public
- **member** : Membres inscrits gratuits
- **premium** : Membres payants
- **promo** : Équipe promotion
- **road** : Équipe de tournée
- **admin** : Équipe administrative
- **dir** : Direction
- **dev** : Développeurs

## Autorisations

Les autorisations sont définies par table et par action :
- `read` : Lecture
- `create` : Création
- `update` : Modification
- `delete` : Suppression
- `publish` : Publication

Exemple pour la table `Person` :
```javascript
granted: {
  "admin": ["read", "create", "update", "delete", "publish"]
}
```

## Sécurité

⚠️ **Important - Phase de développement** :
- Les mots de passe sont actuellement stockés et comparés **en clair** (pas de hash)
- C'est volontaire pour faciliter le développement et les tests
- Le code vérifie directement : `if (user.password !== password)`

**Pour la production** :
1. Implémenter bcrypt pour hasher les mots de passe (déjà installé dans `package.json`)
2. Changer le `JWT_SECRET` dans `.env` par une clé sécurisée et unique
3. Activer HTTPS (les cookies sont en `secure: false` en développement)
4. Ajouter des validations et sanitisation des entrées
5. Ajouter un rate limiting pour les tentatives de connexion
6. Activer `secure: true` pour les cookies en HTTPS

## Technologies utilisées

- **Express** : Framework web
- **MySQL2** : Driver MySQL avec support des Promises
- **JWT** : Authentification par token
- **Cookie-parser** : Gestion des cookies
- **Bcrypt** : Hash des mots de passe (à activer)
- **Dotenv** : Variables d'environnement

## Développement futur

- [ ] Hash des mots de passe avec bcrypt (pour la production)
- [ ] Gestion complète des pages dynamiques
- [ ] CRUD complet pour les tables
- [ ] Upload de fichiers (système d'attachments)
- [ ] API REST complète
- [ ] Tests unitaires et d'intégration
- [ ] Rate limiting et protection contre les attaques
- [ ] Gestion des sessions et refresh tokens
